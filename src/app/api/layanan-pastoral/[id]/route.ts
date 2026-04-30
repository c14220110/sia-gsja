import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || caller.role_name?.toLowerCase() !== 'jemaat') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if kegiatan_id column exists
    let kegiatanSelect = '';
    let kegiatanJoin = '';
    const checkCol = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='permohonan_layanan_pastoral' AND column_name='kegiatan_id'`);
    if (checkCol.rows.length > 0) {
      kegiatanSelect = ', k.tanggal_mulai as jadwal_tanggal, k.waktu_mulai as jadwal_waktu';
      kegiatanJoin = 'LEFT JOIN public.kegiatan k ON p.kegiatan_id = k.id';
    }

    // 1. Fetch Master Permohonan
    const queryMaster = `
      SELECT 
        p.id, p.nomor_tiket, p.untuk_siapa, p.nama_target_luar, 
        p.status_permohonan, p.waktu_diterima, p.keterangan, p.catatan_penyelesaian,
        jk.nama_jenis_kegiatan,
        jt.nama_lengkap as nama_target_jemaat,
        pemohon.nama_lengkap as nama_pemohon,
        pj_jemaat.nama_lengkap as nama_penanggung_jawab,
        jab.nama_jabatan as role_penanggung_jawab
        ${kegiatanSelect}
      FROM public.permohonan_layanan_pastoral p
      JOIN public.jenis_kegiatan jk ON p.jenis_kegiatan_id = jk.id
      JOIN public.jemaat pemohon ON p.jemaat_pemohon_id = pemohon.id
      LEFT JOIN public.jemaat jt ON p.jemaat_target_id = jt.id
      LEFT JOIN public.pengurus pj ON p.penanggung_jawab_id = pj.id
      LEFT JOIN public.jemaat pj_jemaat ON pj.jemaat_id = pj_jemaat.id
      LEFT JOIN public.detail_kepengurusan dk ON dk.pengurus_id = pj.id AND dk.status_jabatan = 'Aktif'
      LEFT JOIN public.jabatan jab ON dk.jabatan_id = jab.id
      ${kegiatanJoin}
      WHERE p.id = $1 AND p.jemaat_pemohon_id = $2
      LIMIT 1
    `;
    const resMaster = await pool.query(queryMaster, [id, caller.jemaat_id]);

    if (resMaster.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    const master = resMaster.rows[0];

    // Tentukan display target pemohon
    let displayTarget = '';
    if (master.untuk_siapa === 'Saya Sendiri') {
      displayTarget = master.nama_pemohon; 
    } else if (master.nama_target_jemaat) {
      displayTarget = master.nama_target_jemaat;
    } else if (master.nama_target_luar) {
      displayTarget = master.nama_target_luar;
    } else {
      displayTarget = master.nama_pemohon;
    }

    // 2. Fetch Audit Logs untuk Timeline
    const queryLogs = `
      SELECT 
        status_baru,
        created_at
      FROM public.permohonan_layanan_audit_log
      WHERE permohonan_id = $1
      ORDER BY created_at ASC
    `;
    const resLogs = await pool.query(queryLogs, [id]);

    return NextResponse.json({
      success: true,
      data: {
        id: master.id,
        nomor_tiket: master.nomor_tiket,
        status_permohonan: master.status_permohonan,
        jenis_layanan: master.nama_jenis_kegiatan,
        nama_pemohon: master.nama_pemohon,
        target_pelayanan: displayTarget,
        keterangan: master.keterangan,
        catatan_penyelesaian: master.catatan_penyelesaian,
        jadwal_tanggal: master.jadwal_tanggal || null,
        jadwal_waktu: master.jadwal_waktu || null,
        penanggung_jawab: master.nama_penanggung_jawab ? {
          nama: master.nama_penanggung_jawab,
          role: master.role_penanggung_jawab || 'Pelayan Pastoral'
        } : null,
        logs: resLogs.rows.map(log => ({
          status: log.status_baru,
          waktu: log.created_at
        }))
      }
    });

  } catch (error: any) {
    console.error('API Error [GET /layanan-pastoral/[id]]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
