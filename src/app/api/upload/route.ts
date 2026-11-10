import { NextResponse } from 'next/server';
import { getCallerFromRequest, CallerInfo } from '@/server/utils/getCallerFromRequest';

const ALLOWED_DELETE_BUCKETS = ['jemaat-photos', 'inventaris', 'bukti-bayar'];

function isAuthorizedToDeleteOldFile(
  bucket: string,
  filename: string,
  caller: CallerInfo
): boolean {
  if (caller.is_super_admin) {
    return true;
  }

  if (bucket === 'jemaat-photos') {
    if (caller.permissions?.includes('jemaat_edit')) {
      return true;
    }
    if (
      caller.jemaat_id != null &&
      (filename.startsWith(`${caller.jemaat_id}_`) || filename.startsWith(`${caller.jemaat_id}.`))
    ) {
      return true;
    }
    return false;
  }

  if (bucket === 'inventaris') {
    return !!caller.permissions?.includes('inventaris_manage');
  }

  if (bucket === 'bukti-bayar') {
    if (caller.permissions?.includes('kegiatan_manage')) {
      return true;
    }
    if (caller.jemaat_id != null && filename.startsWith(`${caller.jemaat_id}_`)) {
      return true;
    }
    return false;
  }

  return false;
}

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

    // ── Hapus foto lama jika ada (mencegah foto numpuk di bucket) ─────────────
    // PENTING: harus `await` — di serverless (Vercel), unwaited promise bisa
    // terbunuh sebelum selesai karena fungsi langsung exit setelah response dikirim.
    const oldUrl = data.get('old_url') as string | null;
    if (oldUrl) {
      try {
        const rawBucket = (data.get('bucket') as string) || 'jemaat-photos';
        const targetBucketForDelete = rawBucket.trim();

        if (!ALLOWED_DELETE_BUCKETS.includes(targetBucketForDelete)) {
          console.warn(`[Upload] Penghapusan old_url ditolak: bucket '${targetBucketForDelete}' tidak ada di whitelist.`);
        } else {
          const publicPathPrefix = `/storage/v1/object/public/${targetBucketForDelete}/`;
          const parsedUrl = new URL(oldUrl);
          const urlPath = parsedUrl.pathname;
          const prefixIndex = urlPath.indexOf(publicPathPrefix);

          if (prefixIndex === -1) {
            console.warn(`[Upload] Penghapusan old_url ditolak: URL path '${urlPath}' tidak sesuai dengan bucket '${targetBucketForDelete}'.`);
          } else {
            const oldFilename = urlPath.slice(prefixIndex + publicPathPrefix.length);
            const decodedFilename = oldFilename ? decodeURIComponent(oldFilename) : '';

            const isTraversal =
              !oldFilename ||
              oldFilename.includes('..') ||
              oldFilename.startsWith('/') ||
              decodedFilename.includes('..') ||
              decodedFilename.startsWith('/');

            if (isTraversal) {
              console.warn(`[Upload] Penghapusan old_url ditolak: path traversal atau nama file tidak valid: '${oldFilename}'`);
            } else if (!isAuthorizedToDeleteOldFile(targetBucketForDelete, oldFilename, caller)) {
              console.warn(
                `[Upload] Penghapusan old_url ditolak: caller ${caller.user_id} tidak berwenang menghapus '${oldFilename}' di bucket '${targetBucketForDelete}'.`
              );
            } else {
              const deleteUrl = `${supabaseUrl}/storage/v1/object/${targetBucketForDelete}/${oldFilename}`;
              // await — pastikan delete selesai sebelum fungsi exit
              const deleteRes = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${supabaseKey}`,
                  'apikey': supabaseKey,
                },
              });
              if (!deleteRes.ok) {
                console.warn(`[Upload] Foto lama gagal dihapus (${deleteRes.status}), tapi upload baru tetap jalan.`);
              } else {
                console.log(`[Upload] Foto lama berhasil dihapus: ${oldFilename}`);
              }
            }
          }
        }
      } catch (err) {
        // Jika parsing URL gagal, abaikan saja — jangan blok upload baru
        console.warn('[Upload] Tidak bisa parse old_url (non-fatal):', err);
      }
    }

    const targetBucket = (data.get('bucket') as string) || 'jemaat-photos';
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${targetBucket}/${filename}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

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
      
      // Beri pesan yang lebih actionable kalau bucket tidak ditemukan
      let userMessage = `Gagal upload ke Supabase: ${response.statusText}`;
      try {
        const errJson = JSON.parse(errorText);
        if (errJson?.error === 'Bucket not found') {
          userMessage = `Bucket storage "${targetBucket}" belum dibuat. Buat bucket ini di Supabase Dashboard → Storage lalu set sebagai Public.`;
        } else if (errJson?.message) {
          userMessage = errJson.message;
        }
      } catch { /* errorText bukan JSON */ }
      
      throw new Error(userMessage);
    }

    // Mendapatkan bentuk URL public dari Supabase
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${targetBucket}/${filename}`;
    
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Gagal mengunggah file' }, { status: 500 });
  }
}

