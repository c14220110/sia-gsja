import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || caller.role_name?.toLowerCase() === 'jemaat') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 1. Fetch Main Ticket
    const queryMaster = `
      SELECT 
        p.*,
        jk.nama_jenis_kegiatan,
        pemohon.nama_lengkap as nama_pemohon,
        pemohon.no_hp as no_hp_pemohon,
        pemohon.foto_url as foto_pemohon,
        jt.nama_lengkap as nama_target_jemaat,
        jt.foto_url as foto_target_jemaat,
        pj_jemaat.nama_lengkap as nama_penanggung_jawab,
        pj_jemaat.foto_url as foto_penanggung_jawab,
        kg.nama_kegiatan as kegiatan_nama,
        kg.tanggal_mulai as kegiatan_tanggal,
        kg.waktu_mulai as kegiatan_waktu,
        kg.lokasi_kegiatan as kegiatan_lokasi,
        kg.status_kegiatan as kegiatan_status
      FROM public.permohonan_layanan_pastoral p
      JOIN public.jenis_kegiatan jk ON p.jenis_kegiatan_id = jk.id
      JOIN public.jemaat pemohon ON p.jemaat_pemohon_id = pemohon.id
      LEFT JOIN public.jemaat jt ON p.jemaat_target_id = jt.id
      LEFT JOIN public.pengurus pj ON p.penanggung_jawab_id = pj.id
      LEFT JOIN public.jemaat pj_jemaat ON pj.jemaat_id = pj_jemaat.id
      LEFT JOIN public.kegiatan kg ON p.kegiatan_id = kg.id
      WHERE p.id = $1
    `;
    const resMaster = await pool.query(queryMaster, [id]);
    
    if (resMaster.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    const ticket = resMaster.rows[0];

    // Determine target name
    let targetDisplay = ticket.nama_pemohon;
    if (ticket.untuk_siapa !== 'Saya Sendiri') {
      if (ticket.nama_target_jemaat) targetDisplay = ticket.nama_target_jemaat;
      else if (ticket.nama_target_luar) targetDisplay = ticket.nama_target_luar;
    }

    ticket.target_pelayanan = targetDisplay;
    ticket.foto_target = ticket.untuk_siapa !== 'Saya Sendiri' && ticket.nama_target_jemaat ? ticket.foto_target_jemaat : ticket.foto_pemohon;

    // 2. Fetch Audit Logs
    const logQuery = `
      SELECT 
        l.*,
        j.nama_lengkap as nama_pengubah
      FROM public.permohonan_layanan_audit_log l
      LEFT JOIN public.pengguna u ON l.diubah_oleh_id = u.id
      LEFT JOIN public.jemaat j ON u.jemaat_id = j.id
      WHERE l.permohonan_id = $1
      ORDER BY l.created_at ASC
    `;
    const resLogs = await pool.query(logQuery, [id]);

    return NextResponse.json({
      success: true,
      data: {
        ticket,
        logs: resLogs.rows
      }
    });

  } catch (error: any) {
    console.error('API Error [GET /kegiatan/pastoral/[id]]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal server', error: error.message }, { status: 500 });
  }
}
