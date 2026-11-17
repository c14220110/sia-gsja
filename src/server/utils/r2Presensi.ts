import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadBase64ImageToR2(
  base64DataUrl: string,
  folder: 'selfies' | 'enroll' | 'visits'
): Promise<string> {
  const match = base64DataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error('Format foto selfie tidak valid');
  }
  const contentType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const ext = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.byteLength > 5 * 1024 * 1024) {
    throw new Error('Ukuran foto melebihi batas 5MB');
  }

  const key = `presensi/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    })
  );

  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}

export async function uploadFileToR2(file: File, folder: 'attachments'): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran lampiran maksimal 5MB');
  }

  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Format lampiran harus JPG, PNG, WebP, atau PDF');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const key = `presensi/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: 'public, max-age=31536000',
    })
  );

  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}
