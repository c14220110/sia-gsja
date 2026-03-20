import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const satelitId = searchParams.get('satelit_id') || '';
  const departemenId = searchParams.get('departemen_id') || '';
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    let whereClauses: string[] = [];
    let values: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(`(k.nama_kegiatan ILIKE $${paramIndex} OR k.kode_kegiatan ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (satelitId) {
      whereClauses.push(`k.satelit_id = $${paramIndex}`);
      values.push(satelitId);
      paramIndex++;
    }

    if (departemenId) {
      whereClauses.push(`k.departemen_id = $${paramIndex}`);
      values.push(departemenId);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Fetch total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM public.kegiatan k ${whereString}`,
      values
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Fetch data with JOINs
    const query = `
      SELECT 
        k.id,
        k.kode_kegiatan,
        k.nama_kegiatan,
        k.tanggal_mulai,
        k.waktu_mulai,
        k.lokasi_kegiatan,
        k.status_kegiatan,
        jk.nama_jenis_kegiatan,
        s.nama_satelit,
        d.nama_departemen
      FROM public.kegiatan k
      LEFT JOIN public.jenis_kegiatan jk ON k.jenis_kegiatan_id = jk.id
      LEFT JOIN public.satelit s ON k.satelit_id = s.id
      LEFT JOIN public.departemen d ON k.departemen_id = d.id
      ${whereString}
      ORDER BY k.tanggal_mulai DESC, k.waktu_mulai DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await pool.query(query, [...values, limit, offset]);

    // Fetch counts for cards
    // 1. Total kegiatan bulan ini
    const countBulanIniResult = await pool.query(`
      SELECT COUNT(*) as total FROM public.kegiatan 
      WHERE date_trunc('month', tanggal_mulai) = date_trunc('month', CURRENT_DATE)
    `);
    const totalBulanIni = parseInt(countBulanIniResult.rows[0].total, 10);

    // 2. Kegiatan mendatang 7 hari
    const count7HariResult = await pool.query(`
      SELECT COUNT(*) as total FROM public.kegiatan 
      WHERE tanggal_mulai BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
    `);
    const total7Hari = parseInt(count7HariResult.rows[0].total, 10);

    // 3. Menunggu LPJ
    const countMenungguLpjResult = await pool.query(`
      SELECT COUNT(*) as total FROM public.kegiatan k
      LEFT JOIN public.kegiatan_lpj l ON k.id = l.kegiatan_id
      WHERE k.tanggal_selesai < CURRENT_DATE AND l.kegiatan_id IS NULL AND k.status_kegiatan != 'Draft'
    `);
    const totalMenungguLpj = parseInt(countMenungguLpjResult.rows[0].total, 10);

    return NextResponse.json({
      success: true,
      data: dataResult.rows,
      meta: {
        total: totalCount,
        bulan_ini: totalBulanIni,
        minggu_ini: total7Hari,
        menunggu_lpj: totalMenungguLpj
      }
    });

  } catch (error) {
    console.error('Error fetching kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
