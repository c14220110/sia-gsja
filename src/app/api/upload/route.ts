import { NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function POST(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    
    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }
    
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: 'Ukuran file maksimal 10MB' }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `${uniqueSuffix}-${safeName}`;
    
    // Konfigurasi Supabase
    const dbUrl = process.env.DATABASE_URL || '';
    const match = dbUrl.match(/postgres\.([^:]+):/);
    const projectId = match ? match[1] : 'stqsbfmhdemyxtyltivs'; // Ekstrak Project Ref dari DATABASE_URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${projectId}.supabase.co`;
    
    // Coba gunakan SERVICE_ROLE_KEY atau ANON_KEY yang ada di Environtment Variables Vercel
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseKey) {
      return NextResponse.json({ 
        success: false, 
        message: 'Kunci API Supabase (SUPABASE_SERVICE_ROLE_KEY) belum disetel di Environment Variables Vercel.' 
      }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const targetBucket = (data.get('bucket') as string) || 'jemaat-photos';
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${targetBucket}/${filename}`;

    // Upload ke Supabase menggunakan REST API standar
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: buffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase upload error:', errorText);
      throw new Error(`Gagal upload ke Supabase: ${response.statusText} - ${errorText}`);
    }

    // Mendapatkan bentuk URL public dari Supabase
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${targetBucket}/${filename}`;
    
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Gagal mengunggah file' }, { status: 500 });
  }
}

