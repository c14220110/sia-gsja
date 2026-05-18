import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

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

    const query = `
      SELECT 
        p.id as pengurus_id,
        j.nama_lengkap,
        STRING_AGG(
          jab.nama_jabatan || 
          COALESCE(' - ' || dep.nama_departemen, '') || 
          COALESCE(' - ' || kom.nama_komisi, ''), 
          ', '
        ) as role_display
      FROM public.pengurus p
      JOIN public.jemaat j ON p.jemaat_id = j.id
      JOIN public.pelayan pel ON j.id = pel.jemaat_id
      JOIN public.pelayan_role prole ON pel.id = prole.pelayan_id
      LEFT JOIN public.detail_kepengurusan dk ON dk.pengurus_id = p.id AND dk.status_jabatan = 'Aktif'
      LEFT JOIN public.jabatan jab ON dk.jabatan_id = jab.id
      LEFT JOIN public.departemen dep ON dk.departemen_id = dep.id
      LEFT JOIN public.komisi kom ON dk.komisi_id = kom.id
      WHERE p.is_active = true 
        AND pel.status_pelayan = 'Aktif'
        AND prole.role_id = (SELECT id FROM public.role_pelayan WHERE nama_role = 'Staf Pastoral')
        AND prole.status_role = 'Aktif'
        ${whereSearch}
      GROUP BY p.id, j.nama_lengkap
      ORDER BY j.nama_lengkap ASC
    `;

    const result = await pool.query(query, queryParams);

    const data = result.rows.map(row => {
      return {
        pengurus_id: row.pengurus_id,
        nama: row.nama_lengkap,
        role: row.role_display || 'Staf Pastoral',
        jabatan_id: null
      };
    });

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('API Error [GET /kegiatan/pastoral/pic-options]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal server', error: error.message }, { status: 500 });
  }
}
