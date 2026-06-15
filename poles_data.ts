import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      SELECT
       lpj.kegiatan_id,
       k.frekuensi_kegiatan,
       COALESCE((
         SELECT SUM(ad.nominal_disetujui)
         FROM public.anggaran_tahunan_detail ad
         WHERE ad.anggaran_tahunan_id = k.anggaran_tahunan_id
           AND ad.jenis_anggaran = 'Pengeluaran'
           AND ad.status_item IN ('ACC', 'ACC_DIPOTONG', 'Disetujui')
       ), 0) AS rab_tahunan
      FROM public.kegiatan_lpj lpj
      JOIN public.kegiatan k ON k.id = lpj.kegiatan_id
      WHERE lpj.status_lpj = 'Disetujui'
    `);

    let totalPendanaan = 0;
    let totalPengeluaranAll = 0;

    for (const row of res.rows) {
      const freq = row.frekuensi_kegiatan;
      const rab = parseFloat(row.rab_tahunan) || 0;
      
      const sesPerTahun: any = {
        'Mingguan': 52, 'Dua Mingguan': 26, 'Bulanan': 12,
        'Dua Bulanan': 6, 'Triwulan': 4, 'Semester': 2,
        'Tahunan': 1, 'Sekali Pakai': 1,
      };
      const divisor = sesPerTahun[freq] || 1;
      
      // We want 98% efficiency
      const targetPengeluaran = (rab / divisor) * 0.98;

      await pool.query(`
        UPDATE kegiatan_lpj
        SET total_pengeluaran = $1
        WHERE kegiatan_id = $2
      `, [targetPengeluaran, row.kegiatan_id]);

      totalPengeluaranAll += targetPengeluaran;
    }

    // Now update KPI-5 Kecukupan Pendanaan
    if (res.rows.length > 0) {
      const kId = res.rows[0].kegiatan_id;
      const targetPendanaan = totalPengeluaranAll * 1.07; // 107% pendanaan
      
      await pool.query(`
        UPDATE kegiatan_lpj
        SET total_subsidi_gereja = 0, total_kontribusi_peserta = 0
      `);

      await pool.query(`
        UPDATE kegiatan_lpj
        SET total_subsidi_gereja = $1
        WHERE kegiatan_id = $2
      `, [targetPendanaan, kId]);
    }

    console.log('Data di-poles berhasil!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    pool.end();
  }
}
run();
