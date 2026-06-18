import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

const ROLE_LABEL: Record<string, string> = {
  MAJELIS: 'Majelis',
  GEMBALA_SIDANG: 'Gembala Sidang',
  GEMBALA_SATELIT: 'Gembala Satelit',
};

export async function GET(request: Request) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || caller.role_name?.toLowerCase() === 'jemaat') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    let queryParams: any[] = [];
    let whereSearch = '';

    if (search) {
      whereSearch = `AND j.nama_lengkap ILIKE $1`;
      queryParams.push(`%${search}%`);
    }

    // Sumber data: user_role dengan peran MAJELIS / GEMBALA_SIDANG / GEMBALA_SATELIT
    // Pakai GROUP BY buat jaga-jaga kalau ada yang merangkap 2 peran (misal jadi Majelis sekaligus Gembala),
    // namanya cukup muncul sekali di daftar (biar React gak error karena key dobel)
    const query = `
      SELECT 
        pn.id as pengguna_id,
        j.nama_lengkap,
        string_agg(r.nama_role, ', ') as roles
      FROM public.user_role ur
      JOIN public.role r ON r.id = ur.role_id
      JOIN public.pengguna pn ON pn.id = ur.user_id AND pn.is_active = true
      JOIN public.jemaat j ON j.id = pn.jemaat_id
      WHERE r.nama_role IN ('MAJELIS', 'GEMBALA_SIDANG', 'GEMBALA_SATELIT')
        AND ur.is_active = true
        AND (ur.tanggal_selesai IS NULL OR ur.tanggal_selesai >= CURRENT_DATE)
        ${whereSearch}
      GROUP BY pn.id, j.nama_lengkap
      ORDER BY j.nama_lengkap ASC
    `;

    const result = await pool.query(query, queryParams);

    const data = result.rows.map(row => {
      // Rapikan format peran, misalnya dari "MAJELIS, GEMBALA_SATELIT" disulap jadi "Majelis, Gembala Satelit"
      const formattedRoles = row.roles
        .split(', ')
        .map((r: string) => ROLE_LABEL[r] || r)
        .join(', ');

      return {
        pengguna_id: row.pengguna_id,
        nama: row.nama_lengkap,
        role: formattedRoles,
      };
    });

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('API Error [GET /kegiatan/pastoral/pic-options]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal server', error: error.message }, { status: 500 });
  }
}
