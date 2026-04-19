import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const res = await pool.query('SELECT user_id, endpoint, created_at FROM public.push_subscriptions');
    console.log(`FOUND ${res.rows.length} subscriptions in DB:`);
    console.log(res.rows);
  } catch(e) {
    console.error('ERROR:', e);
  } finally {
    pool.end();
  }
}
run();
