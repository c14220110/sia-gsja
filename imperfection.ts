import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // 6. Mess up KPI-6 (Efisiensi Anggaran)
    // Over budget by 10%
    await pool.query(`
      UPDATE kegiatan_lpj
      SET total_pengeluaran = total_pengeluaran * 1.20
      WHERE kegiatan_id IN (
        SELECT kegiatan_id FROM kegiatan_lpj
        LIMIT 1
      )
    `);

    console.log('Imperfections applied successfully!');
  } catch (error) {
    console.error('Error applying imperfections:', error);
  } finally {
    pool.end();
  }
}
run();
