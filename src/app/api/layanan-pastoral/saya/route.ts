import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Tidak terautentikasi' }, { status: 401 });
    }

    const jemaatPemohonId = caller.jemaat_id;
    if (!jemaatPemohonId) {
      return NextResponse.json({ success: false, message: 'Akun Anda tidak terhubung ke data jemaat.' }, { status: 403 });
    }

    // Sedotin history riwayat permohonan si jemaat tsb.
    const query = `
      SELECT 
        p.id, p.nomor_tiket, p.untuk_siapa, p.nama_target_luar, 
        p.status_permohonan, p.waktu_diterima, p.jadwal_harapan, 
        jk.nama_jenis_kegiatan,
        jt.nama_lengkap as nama_target_jemaat,
        pemohon.nama_lengkap as nama_pemohon
      FROM public.permohonan_layanan_pastoral p
      JOIN public.jenis_kegiatan jk ON p.jenis_kegiatan_id = jk.id
      LEFT JOIN public.jemaat jt ON p.jemaat_target_id = jt.id
      JOIN public.jemaat pemohon ON p.jemaat_pemohon_id = pemohon.id
      WHERE p.jemaat_pemohon_id = $1
      ORDER BY p.waktu_diterima DESC
    `;

    const result = await pool.query(query, [jemaatPemohonId]);

    // Rapihin respons biar mulus dapetnya
    const formattedData = result.rows.map(row => {
      // Tentukan dengan matang nama panggung siapa yang bakal muncul di layar UI
      let displayTarget = '';
      if (row.untuk_siapa === 'Saya Sendiri') {
        displayTarget = row.nama_pemohon; // Nama asli, konsisten dengan halaman detail
      } else if (row.nama_target_jemaat) {
        displayTarget = row.nama_target_jemaat;
      } else if (row.nama_target_luar) {
        displayTarget = row.nama_target_luar;
      } else {
        displayTarget = '-';
      }

      return {
        id: row.id,
        nomor_tiket: row.nomor_tiket,
        jenis_layanan: row.nama_jenis_kegiatan,
        target_pelayanan: displayTarget,
        status: row.status_permohonan,
        tanggal_pengajuan: row.waktu_diterima,
        jadwal_harapan: row.jadwal_harapan
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedData
    });

  } catch (error: any) {
    console.error('API Error [GET /layanan-pastoral/saya]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
