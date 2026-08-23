import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// R2 client — KHUSUS inventaris, TIDAK mengubah /api/upload yang sudah ada
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Hanya user dengan permission inventaris yang boleh upload
  if (!caller.is_super_admin && !caller.permissions.includes('inventaris_create') && !caller.permissions.includes('inventaris_edit')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Tidak ada file yang diupload' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: 'Ukuran file maksimal 10MB' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'Format file harus JPG, PNG, atau WebP' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Simpan di folder inventaris/ dengan nama unik
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `inventaris/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000',
    }));

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: 'Foto berhasil diupload',
    });

  } catch (error) {
    console.error('R2 upload error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengupload foto ke storage' }, { status: 500 });
  }
}
