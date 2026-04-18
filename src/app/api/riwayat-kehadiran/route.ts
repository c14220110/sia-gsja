import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Ambil jemaat_id
    let jemaat_id = caller.jemaat_id;
    if (!jemaat_id) {
        const u = await pool.query('SELECT jemaat_id FROM pengguna WHERE id = $1', [caller.user_id]);
        jemaat_id = u.rows[0]?.jemaat_id;
    }

    if (!jemaat_id) {
        return NextResponse.json({ success: true, data: [] });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'Semua';

    // 1. Dapatkan Daftar Riwayat Absensi
    const query = `
      SELECT 
        ka.id as absensi_id,
        ka.role_kehadiran,
        ka.waktu_hadir,
        k.id as kegiatan_id,
        k.nama_kegiatan,
        k.kategori,
        k.waktu_mulai,
        k.lokasi_kegiatan,
        k.nama_jenis_kegiatan
      FROM public.kegiatan_absensi ka
      JOIN public.kegiatan k ON ka.kegiatan_id = k.id
      WHERE ka.jemaat_id = $1 AND ka.status_kehadiran = 'Hadir'
      ORDER BY ka.waktu_hadir DESC
    `;

    const result = await pool.query(query, [jemaat_id]);
    const allRecords = result.rows;

    return NextResponse.json({ 
      success: true, 
      data: allRecords
    });
  } catch (error) {
    console.error('Error fetching riwayat kehadiran:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
