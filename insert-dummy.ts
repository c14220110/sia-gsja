import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    await pool.query(`
      INSERT INTO public.kegiatan_jadwal_pelayan (kegiatan_id, pelayan_id, status_konfirmasi, role_id) 
      VALUES 
      (84, 2, 'Hadir', 6),
      (84, 3, 'Bersedia', 12),
      (84, 7, 'Berhalangan', 13),
      (84, 8, 'Menunggu Konfirmasi', 14),
      (84, 9, 'Hadir', 12),
      (84, 11, 'Hadir', 6);
    `);
    console.log("Dummy pelayan inserted successfully for kegiatan 84.");
  } catch (e) {
    console.error("Error inserting:", e);
  } finally {
    await pool.end();
  }
}

main();
