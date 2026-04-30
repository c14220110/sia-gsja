const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// We need to bypass the ipv6 ENOTFOUND issue for supabase if it happens
let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('aws-1-ap-southeast-1.pooler.supabase.com')) {
    connectionString = connectionString.replace('aws-1-ap-southeast-1.pooler.supabase.com', 'db.zvyvnvkswedmjwmdnngz.supabase.co');
}

const pool = new Pool({ connectionString: connectionString });

async function test() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('pelayan', 'pelayan_role', 'kegiatan', 'kegiatan_jadwal_pelayan', 'permohonan_layanan_pastoral')
      ORDER BY table_name, ordinal_position;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}
test();
