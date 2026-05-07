import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/kegiatan/validasi-pembayaran
export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const query = `
      SELECT 
        r.*,
        j.nama_lengkap as nama_peserta,
        j.no_hp,
        k.nama_kegiatan
      FROM public.kegiatan_registrasi r
      JOIN public.jemaat j ON r.jemaat_id = j.id
      JOIN public.kegiatan k ON r.kegiatan_id = k.id
      WHERE (r.status_pembayaran = 'Unpaid' OR r.status_pembayaran = 'Pending') 
        AND r.url_bukti_bayar IS NOT NULL 
        AND r.url_bukti_bayar != ''
      ORDER BY r.tanggal_daftar ASC
    `;

    const result = await pool.query(query);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching validasi pembayaran:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
