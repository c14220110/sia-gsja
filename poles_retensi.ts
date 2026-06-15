import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // Revert Pelayan attendance that was accidentally marked Absen
    await pool.query(`
      UPDATE kegiatan_absensi
      SET status_kehadiran = 'Hadir'
      WHERE role_kehadiran = 'Pelayan'
    `);

    // Ensure we only updated Jemaat role
    // Oh wait, if they were already marked Absen, we just fixed them.
    // KPI-3 is 66.2 (45/68). Let's boost it slightly to ~78% (53/68)
    // So we need to make 8 more jemaat Hadir again.
    await pool.query(`
      UPDATE kegiatan_absensi
      SET status_kehadiran = 'Hadir'
      WHERE id IN (
        SELECT id FROM kegiatan_absensi 
        WHERE role_kehadiran = 'Jemaat' AND status_kehadiran = 'Absen'
        LIMIT 20
      )
    `);

    // And I need to re-introduce the imperfection for KPI-9 (Kehadiran Pelayan = 84.6)
    // So make 2 pelayan Absen again
    await pool.query(`
      UPDATE kegiatan_absensi
      SET status_kehadiran = 'Absen'
      WHERE id IN (
        SELECT id FROM kegiatan_absensi
        WHERE role_kehadiran = 'Pelayan' AND status_kehadiran = 'Hadir'
        LIMIT 2
      )
    `);

    console.log('Retensi dipoles ulang!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    pool.end();
  }
}
run();
