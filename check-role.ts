import { Pool } from 'pg';
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    const res = await pool.query(`SELECT id FROM public.role_pelayan WHERE nama_role = 'Staf Pastoral'`);
    console.log('Staf Pastoral role ID:', res.rows.length ? res.rows[0].id : 'NOT FOUND');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
