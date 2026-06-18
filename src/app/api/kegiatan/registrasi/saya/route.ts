import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// Ambil data pendaftaran kegiatan milik saya
export async function GET(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!caller.jemaat_id && !caller.is_super_admin) {
      return NextResponse.json({ success: true, data: [] }); // Akun ini belum ditautkan ke jemaat_id manapun
    }

    const targetJemaatId = caller.jemaat_id;

    const query = `
      SELECT 
        r.*,
        k.nama_kegiatan,
        k.kode_kegiatan,
        k.tanggal_mulai,
        k.waktu_mulai,
        k.lokasi_kegiatan,
        k.url_banner,
        s.nama_satelit
      FROM public.kegiatan_registrasi r
      JOIN public.kegiatan k ON r.kegiatan_id = k.id
      LEFT JOIN public.satelit s ON k.satelit_id = s.id
      WHERE r.jemaat_id = $1
      ORDER BY r.tanggal_daftar DESC
    `;

    const result = await pool.query(query, [targetJemaatId]);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching my registrations:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
