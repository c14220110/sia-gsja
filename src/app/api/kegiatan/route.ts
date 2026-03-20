import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const satelitId = searchParams.get('satelit_id') || '';
  const penyelenggara = searchParams.get('penyelenggara') || '';
  const statusKegiatan = searchParams.get('status') || '';
  const jenisKegiatan = searchParams.get('jenis_kegiatan_id') || '';
  const filterTanggal = searchParams.get('tanggal') || 'Bulan Ini';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    let whereClauses: string[] = [];
    let values: any[] = [];
    let paramIndex = 1;

    // 1. Search Query
    if (search) {
      whereClauses.push(`(k.nama_kegiatan ILIKE $${paramIndex} OR k.kode_kegiatan ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    // 2. Satelit
    if (satelitId) {
      whereClauses.push(`k.satelit_id = $${paramIndex}`);
      values.push(satelitId);
      paramIndex++;
    }

    // 3. Penyelenggara (Merge Komisi & Departemen)
    if (penyelenggara) {
      if (penyelenggara.startsWith('dept_')) {
        whereClauses.push(`k.departemen_id = $${paramIndex}`);
        values.push(penyelenggara.replace('dept_', ''));
        paramIndex++;
      } else if (penyelenggara.startsWith('komisi_')) {
        whereClauses.push(`k.komisi_id = $${paramIndex}`);
        values.push(penyelenggara.replace('komisi_', ''));
        paramIndex++;
      }
    }

    // 4. Jenis Kegiatan
    if (jenisKegiatan) {
      whereClauses.push(`k.jenis_kegiatan_id = $${paramIndex}`);
      values.push(jenisKegiatan);
      paramIndex++;
    }

    // 5. Rentang Waktu (Tanggal)
    if (filterTanggal === 'Bulan Ini') {
      whereClauses.push(`date_trunc('month', k.tanggal_mulai) = date_trunc('month', CURRENT_DATE)`);
    } else if (filterTanggal === 'Minggu Ini') {
      whereClauses.push(`k.tanggal_mulai >= date_trunc('week', CURRENT_DATE) AND k.tanggal_mulai < date_trunc('week', CURRENT_DATE) + interval '7 days'`);
    } else if (filterTanggal === 'Hari Ini') {
      whereClauses.push(`k.tanggal_mulai = CURRENT_DATE`);
    } else if (filterTanggal === 'Custom' && startDate && endDate) {
      whereClauses.push(`k.tanggal_mulai >= $${paramIndex} AND k.tanggal_mulai <= $${paramIndex + 1}`);
      values.push(startDate, endDate);
      paramIndex += 2;
    }

    // 6. Filter Berdasarkan Status Kegiatan Murni
    if (statusKegiatan) {
      whereClauses.push(`k.status_kegiatan = $${paramIndex}`);
      values.push(statusKegiatan);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Fetch total count for pagination (Need left join lpj if Menunggu LPJ is checked, but safely we can join lpj for count too)
    const joinClauses = `
      LEFT JOIN public.jenis_kegiatan jk ON k.jenis_kegiatan_id = jk.id
      LEFT JOIN public.satelit s ON k.satelit_id = s.id
      LEFT JOIN public.departemen d ON k.departemen_id = d.id
      LEFT JOIN public.komisi kom ON k.komisi_id = kom.id
      LEFT JOIN public.kegiatan_lpj lpj ON k.id = lpj.kegiatan_id
    `;

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT k.id) FROM public.kegiatan k ${joinClauses} ${whereString}`,
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
        d.nama_departemen,
        kom.nama_komisi,
        lpj.kegiatan_id AS is_lpj_submitted
      FROM public.kegiatan k
      ${joinClauses}
      ${whereString}
      ORDER BY k.tanggal_mulai ASC, k.waktu_mulai ASC
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
      SELECT COUNT(*) as total FROM public.kegiatan
      WHERE status_kegiatan = 'Menunggu LPJ'
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
