const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const res = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('permohonan_layanan_pastoral', 'pelayan', 'pelayan_role', 'kegiatan_jadwal_pelayan', 'kegiatan')
    ORDER BY table_name, ordinal_position;
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  pool.end();
}
check();
