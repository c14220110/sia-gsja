import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function POST(request: Request) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { roster_id, status_konfirmasi, alasan_absen } = body;

    // Cek dulu nih apa pengguna ini beneran terdaftar resmi sebagai pelayan di sistem
    let jemaat_id = caller.jemaat_id;
    if (!jemaat_id) {
        const u = await pool.query('SELECT jemaat_id FROM pengguna WHERE id = $1', [caller.user_id]);
        jemaat_id = u.rows[0]?.jemaat_id;
    }
    
    if (!jemaat_id) return NextResponse.json({ success: false, message: 'Not a member' }, { status: 403 });

    // Pastiin jadwal roster ini emang beneran punyanya jemaat yang ini
    const resCheck = await pool.query(`
        SELECT kjp.id 
        FROM kegiatan_jadwal_pelayan kjp 
        JOIN pelayan p ON kjp.pelayan_id = p.id 
        WHERE kjp.id = $1 AND p.jemaat_id = $2
    `, [roster_id, jemaat_id]);

    if(resCheck.rowCount === 0) {
        return NextResponse.json({ success: false, message: 'Unauthorized / Invalid Roster' }, { status: 403 });
    }

    // Nanti tinggal ditambahin aja kolom alasan_absen di tabel database-nya.
    // Sambil nunggu kolomnya ada, kita pasang perisai try-catch khusus pas update biar query-nya gak mbledos.
    
    try {
        await pool.query(
            `UPDATE kegiatan_jadwal_pelayan SET status_konfirmasi = $1, alasan_absen = $2, confirmed_at = CASE WHEN $4::text IN ('Bersedia', 'Hadir') THEN COALESCE(confirmed_at, NOW()) ELSE confirmed_at END WHERE id = $3`,
            [status_konfirmasi, alasan_absen || null, roster_id, status_konfirmasi]
        );
    } catch(err: any) {
        // Kalau ternyata kolomnya emang belum nangkring, mending melipir balik pakai query biasa tanpa alasan_absen
        if(err.message && err.message.includes('column "alasan_absen" of relation "kegiatan_jadwal_pelayan" does not exist')) {
            console.log('User belum menambah kolom alasan_absen, skip alasan_absen');
            await pool.query(
                `UPDATE kegiatan_jadwal_pelayan SET status_konfirmasi = $1, confirmed_at = CASE WHEN $3::text IN ('Bersedia', 'Hadir') THEN COALESCE(confirmed_at, NOW()) ELSE confirmed_at END WHERE id = $2`,
                [status_konfirmasi, roster_id, status_konfirmasi]
            );
        } else {
            throw err;
        }
    }

    return NextResponse.json({ success: true, message: 'Berhasil konfirmasi jadwal!' });
  } catch (error: any) {
    console.error('Konfirmasi jadwal error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
