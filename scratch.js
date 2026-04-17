const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT k.id, k.nama_kegiatan, k.satelit_id, k.komisi_id, kom.nama_komisi FROM kegiatan k LEFT JOIN komisi kom ON k.komisi_id = kom.id ORDER BY k.id DESC LIMIT 5;', (err, res) => {
  if (err) throw err;
  console.log(res.rows);
  pool.end();
});
