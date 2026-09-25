import { NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!caller.is_super_admin && !caller.permissions?.includes('jemaat_create')) {
    return NextResponse.json({ success: false, message: 'Akses ditolak' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'menunggu';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const values: any[] = [status, limit, offset];
    let satelitFilter = '';

    // Sekretaris Satelit: only see their own satelit
    // Sekretaris Pusat (satelit_id=1) and SuperAdmin: see all
    if (!caller.is_super_admin && caller.satelit_id && caller.satelit_id !== 1) {
      satelitFilter = `AND p.satelit_id = $${values.length + 1}`;
      values.push(caller.satelit_id);
    }

    const query = `
      SELECT
        p.id, p.nama_lengkap, p.jenis_kelamin, p.tanggal_lahir,
        p.no_hp, p.email, p.satelit_id, s.nama_satelit,
        p.status, p.created_at, p.reviewed_at, p.foto_url,
        p.kota, p.status_jemaat
      FROM pendaftaran_jemaat p
      LEFT JOIN satelit s ON p.satelit_id = s.id
      WHERE p.status = $1
      ${satelitFilter}
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM pendaftaran_jemaat p
      WHERE p.status = $1
      ${satelitFilter}
    `;

    const [dataRes, countRes] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, satelitFilter ? 2 : 1)),
    ]);

    return NextResponse.json({
      success: true,
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].total, 10),
    });
  } catch (error: any) {
    console.error('[pendaftaran-jemaat GET]', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
