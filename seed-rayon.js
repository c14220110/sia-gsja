const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const data = {
  "Rayon 1": {
    ketua: "Bpk.Robert Sitourus",
    kelompok: [
      { nama: "Kelompok 1", ketua: "Ibu Rahayu" },
      { nama: "Kelompok 2", ketua: "Ibu Maria S" }
    ]
  },
  "Rayon 2": {
    ketua: "Bpk.Ignatius",
    kelompok: [
      { nama: "Kelompok 1", ketua: "Bpk.Ignatius" },
      { nama: "Kelompok 2", ketua: "Bpk.Gatot Purwarianto" }
    ]
  },
  "Rayon 3": {
    ketua: "Pdt.Stefanus Siuwignyo",
    kelompok: [
      { nama: "Kelompok 1", ketua: "Bpk.Edy" },
      { nama: "Kelompok 2", ketua: "Bpk.Gun Numleny" },
      { nama: "Kelompok 3", ketua: "Bpk.Agus Susanto" }
    ]
  },
  "Rayon 4": {
    ketua: "Bpk.Daniel Setiono",
    kelompok: [
      { nama: "Kelompok 1", ketua: "Bpk.Wawan setiawan" }
    ]
  },
  "Rayon 5": {
    ketua: "Bpk.Eko Lasono",
    kelompok: [
      { nama: "Kelompok 1", ketua: "Ibu Helmy" }
    ]
  },
  "Rayon 6": {
    ketua: "Bpk. Darmaji",
    kelompok: [
      { nama: "Kelompok 1", ketua: "Ibu Wasananingrum" },
      { nama: "Kelompok 2", ketua: "Ibu Nova" }
    ]
  }
};

async function seed() {
  try {
    // 1. Get satelit Getsemani
    const satelitRes = await pool.query("SELECT id FROM satelit WHERE nama_satelit ILIKE '%Getsemani%' LIMIT 1");
    if (satelitRes.rows.length === 0) {
      console.log("Satelit Getsemani not found!");
      return;
    }
    const satelitId = satelitRes.rows[0].id;
    console.log("Satelit ID:", satelitId);

    // 2. Helper to get or create pengurus
    async function getOrCreatePengurus(nama) {
      if (!nama) return null;
      nama = nama.trim();
      
      // Try to find existing pengurus by name
      const pRes = await pool.query(`
        SELECT p.id 
        FROM pengurus p 
        JOIN jemaat j ON p.jemaat_id = j.id 
        WHERE j.nama_lengkap ILIKE $1 AND p.satelit_id = $2
        LIMIT 1
      `, ['%' + nama + '%', satelitId]);
      
      if (pRes.rows.length > 0) return pRes.rows[0].id;

      // Create jemaat dummy
      const noAnggota = 'DUMMY-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const jRes = await pool.query(`
        INSERT INTO jemaat (nama_lengkap, nomor_anggota, satelit_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [nama, noAnggota, satelitId]);
      const jId = jRes.rows[0].id;

      // Create pengurus dummy
      const idPengurus = 'P-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const newPRes = await pool.query(`
        INSERT INTO pengurus (id_pengurus, jemaat_id, satelit_id, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING id
      `, [idPengurus, jId, satelitId]);
      
      return newPRes.rows[0].id;
    }

    // 3. Process data
    for (const [rayonName, rayonData] of Object.entries(data)) {
      console.log("Processing", rayonName);
      const ketuaRayonId = await getOrCreatePengurus(rayonData.ketua);
      
      const rRes = await pool.query(`
        INSERT INTO rayon (satelit_id, nama_rayon, ketua_pengurus_id, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING id
      `, [satelitId, rayonName, ketuaRayonId]);
      const rId = rRes.rows[0].id;

      for (const kel of rayonData.kelompok) {
        const ketuaKelId = await getOrCreatePengurus(kel.ketua);
        await pool.query(`
          INSERT INTO kelompok_sel (rayon_id, nama_kelompok, ketua_pengurus_id, is_active)
          VALUES ($1, $2, $3, true)
        `, [rId, kel.nama, ketuaKelId]);
        console.log("  Added", kel.nama);
      }
    }

    console.log("Done seeding!");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

seed();
