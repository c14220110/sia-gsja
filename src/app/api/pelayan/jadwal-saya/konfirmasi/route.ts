import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function POST(request: Request) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { roster_id, status_konfirmasi, alasan_absen } = body;

    // Check if user is pelayan natively
    let jemaat_id = caller.jemaat_id;
    if (!jemaat_id) {
        const u = await pool.query('SELECT jemaat_id FROM pengguna WHERE id = $1', [caller.user_id]);
        jemaat_id = u.rows[0]?.jemaat_id;
    }
    
    if (!jemaat_id) return NextResponse.json({ success: false, message: 'Not a member' }, { status: 403 });

    // Ensure the roster belongs to this jemaat
    const resCheck = await pool.query(`
        SELECT kjp.id 
        FROM kegiatan_jadwal_pelayan kjp 
        JOIN pelayan p ON kjp.pelayan_id = p.id 
        WHERE kjp.id = $1 AND p.jemaat_id = $2
    `, [roster_id, jemaat_id]);

    if(resCheck.rowCount === 0) {
        return NextResponse.json({ success: false, message: 'Unauthorized / Invalid Roster' }, { status: 403 });
    }

    // Nanti ditambahkan kolom alasan_absen di database secara manual oleh user.
    // Sementara, untuk mencegah error saat query jika kolom belum ada, kita bisa gunakan try-catch spesifik untuk query update.
    
    try {
        await pool.query(
            `UPDATE kegiatan_jadwal_pelayan SET status_konfirmasi = $1, alasan_absen = $2 WHERE id = $3`,
            [status_konfirmasi, alasan_absen || null, roster_id]
        );
    } catch(err: any) {
        // Jika kolom belum ada, fall back ke query tanpa alasan_absen
        if(err.message && err.message.includes('column "alasan_absen" of relation "kegiatan_jadwal_pelayan" does not exist')) {
            console.log('User belum menambah kolom alasan_absen, skip alasan_absen');
            await pool.query(
                `UPDATE kegiatan_jadwal_pelayan SET status_konfirmasi = $1 WHERE id = $2`,
                [status_konfirmasi, roster_id]
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
