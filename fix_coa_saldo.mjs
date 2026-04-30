import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  await pool.query("UPDATE public.buku_besar_coa SET saldo_normal = 'Debit' WHERE kode_akun LIKE '51%' OR kode_akun = 'H1-BIA-69' OR kode_akun LIKE 'H2-51%';");
  console.log("Updated saldo normal");
  process.exit(0);
}
run();
