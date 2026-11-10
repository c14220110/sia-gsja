import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    // Only allow image files for public upload
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, message: 'Hanya file gambar yang diperbolehkan' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: 'Ukuran maksimal foto 5MB' }, { status: 400 });
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const match = dbUrl.match(/postgres\.([^:]+):/);
    const projectId = match ? match[1] : '';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${projectId}.supabase.co`;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseKey) {
      return NextResponse.json({ success: false, message: 'Storage tidak terkonfigurasi' }, { status: 500 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `${uniqueSuffix}-${safeName}`;
    const targetBucket = 'pendaftaran-photos';
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${targetBucket}/${filename}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[public/upload] Supabase error:', errorText);
      let userMessage = `Gagal upload foto`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson?.error === 'Bucket not found') {
          userMessage = `Bucket "${targetBucket}" belum dibuat di Supabase Storage.`;
        } else if (errJson?.message) {
          userMessage = errJson.message;
        }
      } catch { /* not JSON */ }
      return NextResponse.json({ success: false, message: userMessage }, { status: 500 });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${targetBucket}/${filename}`;
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('[public/upload] Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Gagal mengunggah foto' }, { status: 500 });
  }
}
