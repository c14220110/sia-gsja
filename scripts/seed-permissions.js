const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' }); // Or .env

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const permissionMap = {
  jemaat_view: 1, jemaat_create: 2, jemaat_edit: 3,
  pelayan_view: 4, pelayan_manage: 5,
  pengurus_view: 6, pengurus_manage: 7,
  kegiatan_view: 8, kegiatan_create: 9, kegiatan_edit: 10,
  absensi_input: 11, absensi_edit: 12,
  kas_view: 13, kas_input: 14,
  proposal_create: 15, proposal_approve_majelis: 16, proposal_approve_bendahara: 17,
  lpj_input: 18, lpj_approve: 19,
  akses_sementara_manage: 20,
  master_data_manage: 21,
  audit_log_view: 22,
  user_access_manage: 23,
};

const roleMatrix = {
  'SUPER_ADMIN': Object.values(permissionMap),

  'SEKRETARIS_PUSAT': [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
  ],
  'SEKRETARIS_SATELIT': [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
  ],
  
  'MAJELIS': [
    1, 6, 7, 13, 16, 19, 8
  ],
  'GEMBALA_SIDANG': [
    1, 6, 7, 13, 16, 19, 8
  ],
  'GEMBALA_SATELIT': [
    1, 4, 6, 7, 13, 16, 19, 8
  ],

  'BENDAHARA_PUSAT': [
    1, 13, 14, 17, 19, 20, 8
  ],
  'BENDAHARA_SATELIT': [
    1, 13, 14, 17, 20, 8
  ],
  
  'KETUA_KOMISI': [
    1, 13, 15, 18, 8, 9, 10, 11
  ],
  'KETUA_DEPARTEMEN': [
    1, 13, 15, 18, 8, 9, 10, 11
  ],
  
  'PIC_KEGIATAN': [
    1, 4, 8, 11
  ],
  
  'BENDAHARA_PANITIA': [
    13, 14, 18, 8
  ],
  
  'JEMAAT': [
    1, 8
  ]
};

async function seedPermissions() {
  const client = await pool.connect();
  try {
    console.log("Memulai proses seeder role_permission...");
    await client.query('BEGIN');
    
    // Get roles from mapped names first
    const rolesResult = await client.query('SELECT id, nama_role FROM role');
    const dbRoles = rolesResult.rows;

    // Bersihkan dulu
    await client.query('DELETE FROM role_permission');
    console.log("Data lama role_permission berhasil dihapus.");

    let insertValues = [];
    let queryParams = [];
    let valueCount = 1;

    for (const [roleNameStr, permissions] of Object.entries(roleMatrix)) {
      // mapping name to id
      const dbRole = dbRoles.find(r => r.nama_role === roleNameStr);
      if (!dbRole) {
        console.warn(`Role ${roleNameStr} tidak ditemukan di DB. Di-skip.`);
        continue;
      }
      
      const roleId = dbRole.id;
      for (const permId of permissions) {
        insertValues.push(`($${valueCount++}, $${valueCount++})`);
        queryParams.push(roleId, permId);
      }
    }

    if (insertValues.length > 0) {
      const queryStr = `INSERT INTO role_permission (role_id, permission_id) VALUES ${insertValues.join(', ')}`;
      await client.query(queryStr, queryParams);
    }
    
    await client.query('COMMIT');
    console.log(`SUKSES: ${queryParams.length / 2} relasi role_permission dimasukkan ke database.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("GAGAL. Rollback dilakukan. Error: ", error);
  } finally {
    client.release();
    pool.end();
  }
}

seedPermissions();
