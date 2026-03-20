import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE public.kegiatan 
      ADD COLUMN IF NOT EXISTS komisi_id integer null references public.komisi(id);
    `);
    console.log('Successfully added komisi_id to kegiatan table.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

main();
