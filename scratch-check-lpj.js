const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://postgres.stqsbfmhdemyxtyltivs:rDLmkVZkz1UPnU9l@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" });

async function check() {
  try {
    const res = await pool.query('SELECT * FROM public.kegiatan_lpj WHERE kegiatan_id = 81');
    console.log('Record for ID 81:', res.rows);
    const detail = await pool.query('SELECT * FROM public.kegiatan_lpj_detail WHERE kegiatan_id = 81');
    console.log('Details for ID 81 count:', detail.rows.length);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
check();
