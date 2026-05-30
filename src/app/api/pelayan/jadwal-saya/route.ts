import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

/**
 * GET /api/pelayan/jadwal-saya
 * Mengembalikan:
 *  - is_pelayan: apakah jemaat yang login terdaftar sebagai pelayan aktif
 *  - pending: daftar penugasan dengan status 'Menunggu Konfirmasi'
 *  - confirmed: daftar penugasan dengan status 'Hadir' (atau 'Diterima' dsb)
 *  - all_schedules: gabungan semua jadwal pelayan untuk dirender di kalender
 *  - total: jumlah pending
 */
export async function GET(request: Request) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, is_pelayan: false, pending: [], total: 0 });
    }

    // Gunakan user_id (selalu ada di JWT) untuk lookup jemaat_id dari DB
    // Lebih reliable daripada caller.jemaat_id yang mungkin tidak ada di token lama
    let jemaat_id = caller.jemaat_id ?? null;

    if (!jemaat_id) {
      // Fallback: ambil jemaat_id dari tabel pengguna menggunakan user_id yang selalu ada di JWT
      const userRow = await pool.query(
        `SELECT jemaat_id FROM public.pengguna WHERE id = $1 LIMIT 1`,
        [caller.user_id]
      );
      jemaat_id = userRow.rows[0]?.jemaat_id ?? null;
    }

    console.log('[JadwalSaya] user_id =', caller.user_id, '| jemaat_id (resolved) =', jemaat_id);

    if (!jemaat_id) {
      // User tidak punya jemaat_id → pasti bukan pelayan
      return NextResponse.json({ success: true, is_pelayan: false, pending: [], total: 0 });
    }

    // 1. Cek apakah jemaat ini terdaftar sebagai pelayan aktif
    const pelayanCheck = await pool.query(
      `SELECT id, status_pelayan
       FROM public.pelayan
       WHERE jemaat_id = $1
       LIMIT 5`,
      [jemaat_id]
    );

    console.log('[JadwalSaya] pelayanCheck rows =', pelayanCheck.rows);
    const isPelayan = pelayanCheck.rows.some(r => r.status_pelayan === 'Aktif');

    // 2. Ambil daftar jadwal yang menunggu konfirmasi DAN semua jadwal (jika pelayan)
    let pendingRows: any[] = [];
    let allSchedules: any[] = [];
    
    if (isPelayan) {
      const resultAll = await pool.query(
        `SELECT
           kjp.id                    AS roster_id,
           kjp.status_konfirmasi,
           rp.nama_role              AS nama_peran,
           k.nama_kegiatan,
           k.tanggal_mulai,
           k.waktu_mulai,
           k.lokasi_kegiatan,
           k.status_kegiatan
         FROM public.kegiatan_jadwal_pelayan kjp
         JOIN public.pelayan p        ON kjp.pelayan_id   = p.id
         JOIN public.role_pelayan rp  ON kjp.role_id      = rp.id
         JOIN public.kegiatan k       ON kjp.kegiatan_id  = k.id
         WHERE p.jemaat_id = $1
           AND k.status_kegiatan IN ('Akan Datang', 'Ongoing')
           AND kjp.status_konfirmasi IN ('Menunggu Konfirmasi', 'Bersedia', 'Hadir') -- Menampilkan semua status jadwal yang valid
         ORDER BY k.tanggal_mulai ASC`,
        [jemaat_id]
      );
      
      allSchedules = resultAll.rows;
      pendingRows = allSchedules.filter(r => r.status_konfirmasi === 'Menunggu Konfirmasi');
    }

    return NextResponse.json({
      success: true,
      is_pelayan: isPelayan,
      pending: pendingRows,
      all_schedules: allSchedules,
      total: pendingRows.length
    });
  } catch (error) {
    console.error('[JadwalSaya] GET error:', error);
    return NextResponse.json({ success: false, is_pelayan: false, pending: [], total: 0 }, { status: 500 });
  }
}
