import * as dotenv from 'dotenv';
dotenv.config({ path: '/Users/sam/Desktop/GSJA/sia-gsja/gsja/.env.local' });
dotenv.config({ path: '/Users/sam/Desktop/GSJA/sia-gsja/gsja/.env' });
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
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
      LEFT JOIN public.pengurus pj ON p.penanggung_jawab_id = pj.id
      LEFT JOIN public.jemaat pj_jemaat ON pj.jemaat_id = pj_jemaat.id
      ORDER BY p.waktu_diterima DESC
      LIMIT 10 OFFSET 0
    `;
    const res = await pool.query(queryMaster);
    console.log("Data count:", res.rows.length);

    const statsQuery = `
      SELECT 
        SUM(CASE WHEN status_permohonan = 'Menunggu' THEN 1 ELSE 0 END) as total_menunggu,
        SUM(CASE WHEN status_permohonan IN ('Ditugaskan', 'Ditindaklanjuti') THEN 1 ELSE 0 END) as total_diproses,
        SUM(CASE WHEN status_permohonan = 'Selesai' AND date_trunc('month', waktu_selesai) = date_trunc('month', current_date) THEN 1 ELSE 0 END) as selesai_bulan_ini
      FROM public.permohonan_layanan_pastoral
    `;
    const resStats = await pool.query(statsQuery);
    console.log("Stats count:", resStats.rows);
  } catch (e) {
    console.error("Query Error:", e);
  } finally {
    await pool.end();
  }
}

run();
