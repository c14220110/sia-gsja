import { Pool } from 'pg';
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT p.id as pengurus_id, j.nama_lengkap, pel.id as pelayan_id
      FROM public.pengurus p
      JOIN public.jemaat j ON p.jemaat_id = j.id
      LEFT JOIN public.pelayan pel ON j.id = pel.jemaat_id
      WHERE j.nama_lengkap ILIKE '%Andreas%' OR j.nama_lengkap ILIKE '%Thomas%'
    `);
    console.table(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
