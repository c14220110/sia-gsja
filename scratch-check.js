const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const res = await pool.query(`
    SELECT r.id, r.nama_role, 
           array_agg(p.nama_permission) as perms
    FROM role r
    LEFT JOIN role_permission rp ON r.id = rp.role_id
    LEFT JOIN permission p ON rp.permission_id = p.id
    GROUP BY r.id, r.nama_role
    ORDER BY r.id
  `);
  res.rows.forEach(r => {
    console.log(`=== ${r.nama_role} (${r.perms.length}) ===`);
    console.log(r.perms.sort().join(', '));
  });
  process.exit(0);
}
check();
