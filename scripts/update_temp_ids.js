const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Ambil semua jemaat dengan jemaat_id yang dimulai dengan TEMP
    const jemaatRes = await client.query('SELECT id, satelit_id, tanggal_lahir FROM jemaat WHERE jemaat_id LIKE $1 ORDER BY id ASC', ['TEMP%']);
    
    console.log(`Found ${jemaatRes.rows.length} records to update.`);

    // Ambil semua satelit untuk tau kode_satelitnya
    const satelitRes = await client.query('SELECT id, kode_satelit FROM satelit');
    const satelitMap = {};
    for (const s of satelitRes.rows) {
      satelitMap[s.id] = s.kode_satelit ? s.kode_satelit.substring(0, 2).padStart(2, '0') : '00';
    }

    for (const row of jemaatRes.rows) {
      let satelitCode = satelitMap[row.satelit_id] || '00';
      
      let dateCode = '000000';
      if (row.tanggal_lahir) {
        const d = new Date(row.tanggal_lahir);
        if (!isNaN(d.getTime())) {
          const dd = d.getDate().toString().padStart(2, '0');
          const mm = (d.getMonth() + 1).toString().padStart(2, '0');
          const yy = d.getFullYear().toString().slice(-2);
          dateCode = `${dd}${mm}${yy}`;
        }
      }

      const idPrefix = `${satelitCode}${dateCode}`;

      // Hitung increment untuk idPrefix ini (cari max counter yang sudah ada, atau yang baru digenerate)
      const countRes = await client.query(
        `SELECT jemaat_id FROM jemaat WHERE jemaat_id LIKE $1 AND jemaat_id NOT LIKE 'TEMP%' ORDER BY jemaat_id DESC LIMIT 1`,
        [`${idPrefix}%`]
      );

      let nextNum = 0;
      if (countRes.rows.length > 0) {
        const lastId = countRes.rows[0].jemaat_id; 
        if (lastId && lastId.length >= 10) {
           const lastCounter = parseInt(lastId.slice(-2), 10);
           if (!isNaN(lastCounter)) {
             nextNum = lastCounter + 1;
           }
        }
      }
      
      const newJemaatId = `${idPrefix}${nextNum.toString().padStart(2, '0')}`;
      
      await client.query('UPDATE jemaat SET jemaat_id = $1 WHERE id = $2', [newJemaatId, row.id]);
      console.log(`Updated ID ${row.id} -> ${newJemaatId} (DOB: ${row.tanggal_lahir ? new Date(row.tanggal_lahir).toISOString().split('T')[0] : 'N/A'})`);
    }

    await client.query('COMMIT');
    console.log('Update successful!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

main();
