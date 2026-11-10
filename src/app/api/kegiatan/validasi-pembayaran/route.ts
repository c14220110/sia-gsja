import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// Ambil status validasi pembayarannya
export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Filtering berbasis permission — tidak hardcode role name agar customizable di pengaturan software.
    // Jika user punya multi_satelit_view (atau is_super_admin) → lihat semua satelit.
    // Jika tidak → hanya lihat pembayaran dari kegiatan di satelit user sendiri.
    const canViewAllSatelit = caller.is_super_admin || caller.permissions.includes('multi_satelit_view');

    const baseSelect = `
      SELECT 
        r.*,
        j.nama_lengkap as nama_peserta,
        j.no_hp,
        k.nama_kegiatan,
        k.satelit_id,
        s.nama_satelit
      FROM public.kegiatan_registrasi r
      JOIN public.jemaat j ON r.jemaat_id = j.id
      JOIN public.kegiatan k ON r.kegiatan_id = k.id
      LEFT JOIN public.satelit s ON k.satelit_id = s.id
      WHERE (r.status_pembayaran = 'Unpaid' OR r.status_pembayaran = 'Pending') 
        AND r.url_bukti_bayar IS NOT NULL 
        AND r.url_bukti_bayar != ''
    `;

    const query = canViewAllSatelit
      ? `${baseSelect} ORDER BY r.tanggal_daftar ASC`
      : `${baseSelect} AND k.satelit_id = $1 ORDER BY r.tanggal_daftar ASC`;

    const params = canViewAllSatelit ? [] : [caller.satelit_id];
    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      // Info untuk frontend: apakah data sudah difilter per satelit?
      filtered_satelit: !canViewAllSatelit,
    });
  } catch (error) {
    console.error('Error fetching validasi pembayaran:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
