import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  try {
    const caller = getCallerFromRequest(request);
    // Basic Auth Check
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    // TODO: Add proper permission check for admin/sekretaris
    if (caller.role_name?.toLowerCase() === 'jemaat') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const jenisLayanan = searchParams.get('jenis_layanan') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let whereClauses: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Search by Ticket Number or Jemaat Name
    if (search) {
      whereClauses.push(`(p.nomor_tiket ILIKE $${paramIndex} OR pemohon.nama_lengkap ILIKE $${paramIndex} OR p.nama_target_luar ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Filter by Status
    if (status) {
      whereClauses.push(`p.status_permohonan = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    // Filter by Jenis Layanan
    if (jenisLayanan) {
      whereClauses.push(`p.jenis_kegiatan_id = $${paramIndex}`);
      queryParams.push(jenisLayanan);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Main Query
    const queryMaster = `
      SELECT 
        p.id, p.nomor_tiket, p.untuk_siapa, p.nama_target_luar, 
        p.status_permohonan, p.waktu_diterima, p.keterangan, p.is_urgent,
        jk.nama_jenis_kegiatan,
        jt.nama_lengkap as nama_target_jemaat,
        pemohon.nama_lengkap as nama_pemohon,
        pj_jemaat.nama_lengkap as nama_penanggung_jawab
      FROM public.permohonan_layanan_pastoral p
      JOIN public.jenis_kegiatan jk ON p.jenis_kegiatan_id = jk.id
      JOIN public.jemaat pemohon ON p.jemaat_pemohon_id = pemohon.id
      LEFT JOIN public.jemaat jt ON p.jemaat_target_id = jt.id
      LEFT JOIN public.pengguna pj_pn ON p.penanggung_jawab_id = pj_pn.id
      LEFT JOIN public.jemaat pj_jemaat ON pj_jemaat.id = pj_pn.jemaat_id
      ${whereString}
      ORDER BY 
        CASE p.status_permohonan
          WHEN 'Menunggu' THEN 1
          WHEN 'Ditugaskan' THEN 2
          WHEN 'Ditindaklanjuti' THEN 3
          WHEN 'Selesai' THEN 4
          WHEN 'Dibatalkan' THEN 5
          ELSE 6
        END ASC,
        p.is_urgent DESC,
        p.waktu_diterima ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM public.permohonan_layanan_pastoral p
      JOIN public.jemaat pemohon ON p.jemaat_pemohon_id = pemohon.id
      ${whereString}
    `;

    const statsQuery = `
      SELECT 
        SUM(CASE WHEN status_permohonan = 'Menunggu' THEN 1 ELSE 0 END) as total_menunggu,
        SUM(CASE WHEN status_permohonan IN ('Ditugaskan', 'Ditindaklanjuti') THEN 1 ELSE 0 END) as total_diproses,
        SUM(CASE WHEN status_permohonan = 'Selesai' AND date_trunc('month', waktu_selesai) = date_trunc('month', current_date) THEN 1 ELSE 0 END) as selesai_bulan_ini
      FROM public.permohonan_layanan_pastoral
    `;

    // Execute queries
    const [resMaster, resCount, resStats] = await Promise.all([
      pool.query(queryMaster, [...queryParams, limit, offset]),
      pool.query(countQuery, queryParams),
      pool.query(statsQuery)
    ]);

    const total = parseInt(resCount.rows[0].total, 10);
    const stats = resStats.rows[0];

    const data = resMaster.rows.map(row => {
       // Evaluate display status (e.g., SLA Breached)
       let displayStatus = row.status_permohonan;
       if (row.status_permohonan === 'Menunggu') {
         const diajukan = new Date(row.waktu_diterima);
         const sekarang = new Date();
         const diffHours = (sekarang.getTime() - diajukan.getTime()) / (1000 * 60 * 60);
         if (diffHours > 24) {
           displayStatus = 'Belum Ditangani';
         }
       }

       // Determine Target Name
       let target = '';
       if (row.untuk_siapa === 'Saya Sendiri') {
         target = row.nama_pemohon;
       } else if (row.nama_target_jemaat) {
         target = row.nama_target_jemaat;
       } else if (row.nama_target_luar) {
         target = row.nama_target_luar;
       } else {
         target = row.nama_pemohon;
       }

       return {
         ...row,
         displayStatus,
         target_pelayanan: target
       };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        menunggu: parseInt(stats.total_menunggu || '0', 10),
        diproses: parseInt(stats.total_diproses || '0', 10),
        selesai_bulan_ini: parseInt(stats.selesai_bulan_ini || '0', 10),
        caller_role: caller.role_name || '',
      }
    });

  } catch (error: any) {
    console.error('API Error [GET /kegiatan/pastoral]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal server', error: error.message }, { status: 500 });
  }
}
