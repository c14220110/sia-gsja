import { NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

/**
 * GET /api/inventaris/diag — temporary diagnostic endpoint
 * Checks if R2 env vars are set in this deployment.
 * REMOVE AFTER USE.
 */
export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller || !caller.is_super_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    R2_ENDPOINT: process.env.R2_ENDPOINT ? `SET (${process.env.R2_ENDPOINT})` : 'MISSING',
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'MISSING',
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? `SET (len=${process.env.R2_ACCESS_KEY_ID.length})` : 'MISSING',
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? `SET (len=${process.env.R2_SECRET_ACCESS_KEY.length})` : 'MISSING',
    NEXT_PUBLIC_R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'MISSING',
    NODE_ENV: process.env.NODE_ENV,
  });
}
