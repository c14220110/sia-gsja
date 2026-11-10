import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// Reuse same R2 client as upload route
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * GET /api/inventaris/image?key=inventaris/xxx.png
 * Proxies R2 objects — requires valid login session.
 * Only serves files under the inventaris/ prefix.
 */
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  // Validate key — only allow inventaris/ prefix, no path traversal
  if (!key || !key.startsWith('inventaris/') || key.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    });

    const r2Response = await r2Client.send(command);

    if (!r2Response.Body) {
      return new NextResponse('Not found', { status: 404 });
    }

    // private: browser caches but CDN/shared proxies cannot cache authenticated responses
    const headers: Record<string, string> = {
      'Content-Type': r2Response.ContentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
    };
    if (r2Response.ContentLength) {
      headers['Content-Length'] = r2Response.ContentLength.toString();
    }

    return new NextResponse(r2Response.Body as ReadableStream, { headers });

  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      return new NextResponse('Not found', { status: 404 });
    }
    console.error('[R2 Image Proxy] Error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
