import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    
    if (!file) {
      return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }
    
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: 'Ukuran file maksimal 10MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `${uniqueSuffix}-${safeName}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    
    // Ensure dir exists
    await mkdir(uploadDir, { recursive: true });
    
    const filePath = join(uploadDir, filename);
    await writeFile(filePath, buffer);
    
    return NextResponse.json({ success: true, url: '/uploads/' + filename });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Gagal mengunggah file' }, { status: 500 });
  }
}
