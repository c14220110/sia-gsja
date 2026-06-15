import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const r = await pool.query(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'permohonan_layanan_pastoral_untuk_siapa_check'`);
  console.log('Constraint:', r.rows[0]);
  process.exit(0);
}
run();
