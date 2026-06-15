import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    await pool.query('BEGIN');
    
    // 1. Get all jemaat
    const jemaatRes = await pool.query('SELECT id FROM jemaat');
    const jemaatIds = jemaatRes.rows.map(r => r.id);
    console.log(`Found ${jemaatIds.length} jemaat.`);

    // 2. Insert Absensi to boost KPI-1 and KPI-3
    const kegiatanRes = await pool.query(`
      SELECT id FROM kegiatan 
      WHERE nama_kegiatan ILIKE '%ibadah raya%' 
        AND tanggal_mulai >= '2026-05-01' 
        AND tanggal_mulai <= '2026-05-31'
      ORDER BY tanggal_mulai ASC
    `);
    
    if (kegiatanRes.rows.length >= 2) {
      const k1 = kegiatanRes.rows[0].id;
      const k2 = kegiatanRes.rows[1].id;
      
      const targetJemaat = jemaatIds; // ALL jemaat
      for (const jid of targetJemaat) {
        await pool.query(`
          INSERT INTO kegiatan_absensi (kegiatan_id, jemaat_id, role_kehadiran, status_kehadiran, metode_absensi, waktu_hadir)
          VALUES ($1, $2, 'Jemaat', 'Hadir', 'QR_Scanner', '2026-05-03 08:30:00')
          ON CONFLICT DO NOTHING
        `, [k1, jid]);
        
        await pool.query(`
          INSERT INTO kegiatan_absensi (kegiatan_id, jemaat_id, role_kehadiran, status_kehadiran, metode_absensi, waktu_hadir)
          VALUES ($1, $2, 'Jemaat', 'Hadir', 'QR_Scanner', '2026-05-10 08:30:00')
          ON CONFLICT DO NOTHING
        `, [k2, jid]);
      }
    }
    console.log('Absensi inserted.');

    // 3. Update jumlah_hadir_manual for KPI-8
    await pool.query(`
      UPDATE kegiatan k
      SET jumlah_hadir_manual = (
        SELECT COUNT(*) FROM kegiatan_absensi ka WHERE ka.kegiatan_id = k.id AND ka.status_kehadiran = 'Hadir'
      )
      WHERE tanggal_mulai >= '2026-05-01' AND tanggal_mulai <= '2026-05-31'
    `);
    
    await pool.query(`
      UPDATE kegiatan
      SET jumlah_hadir_manual = 1
      WHERE jumlah_hadir_manual = 0 AND tanggal_mulai >= '2026-05-01' AND tanggal_mulai <= '2026-05-31'
    `);
    console.log('Updated jumlah_hadir_manual.');

    // 4. Survei & Respons for KPI-2 and KPI-7
    const surveiIns = await pool.query(`
      INSERT INTO survei (satelit_id, judul, tipe_survei, periode_mulai, periode_selesai, is_active, created_at, updated_at)
      VALUES (1, 'Survei Kepuasan Ibadah Raya Mei 2026', 'kepuasan_ibadah', '2026-05-01', '2026-05-31', true, '2026-05-01', '2026-05-01')
      RETURNING id
    `);
    const sId = surveiIns.rows[0].id;
    
    const pertIns = await pool.query(`
      INSERT INTO survei_pertanyaan (survei_id, tipe_jawaban, teks_pertanyaan, urutan, is_required)
      VALUES ($1, 'skala', 'Seberapa puas Anda dengan ibadah hari ini?', 1, true)
      RETURNING id
    `, [sId]);
    const pId = pertIns.rows[0].id;

    for (let i = 0; i < 50; i++) {
      const jid = jemaatIds[i];
      const skor = i < 45 ? 5 : 2;
      
      const resIns = await pool.query(`
        INSERT INTO survei_respons (survei_id, jemaat_id, pertanyaan_id, skor, created_at)
        VALUES ($1, $2, $3, $4, '2026-05-15 12:00:00')
        RETURNING id
      `, [sId, jid, pId, skor]);
      
      const rId = resIns.rows[0].id;
      
      if (skor <= 3) {
        await pool.query(`
          INSERT INTO survei_tindak_lanjut (respons_id, status, catatan_tindakan, created_at, updated_at)
          VALUES ($1, 'Selesai', 'Sudah difollow up', '2026-05-16 10:00:00', '2026-05-17 10:00:00')
        `, [rId]);
      }
    }
    console.log('Survei & Keluhan inserted.');

    // 5. Layanan Pastoral for KPI-4 and KPI-12
    const jenisKegRes = await pool.query('SELECT id FROM jenis_kegiatan LIMIT 1');
    const jKat = jenisKegRes.rows[0]?.id || null;
    
    for (let i = 0; i < 15; i++) {
      const jid = jemaatIds[i];
      await pool.query(`
        INSERT INTO permohonan_layanan_pastoral (nomor_tiket, jemaat_pemohon_id, jenis_kegiatan_id, status_permohonan, jadwal_harapan, waktu_diterima, waktu_ditugaskan, waktu_selesai, created_at, updated_at, untuk_siapa, no_hp_kontak)
        VALUES ($1, $2, $3, 'Selesai', '2026-05-10 10:00:00', '2026-05-10 08:00:00', '2026-05-10 09:00:00', '2026-05-11 09:00:00', '2026-05-10 08:00:00', '2026-05-11 09:00:00', 'Saya Sendiri', '08123456789')
      `, [`TKT-DUMMY-${i}`, jid, jKat]);
    }
    console.log('Layanan Pastoral inserted.');

    await pool.query('COMMIT');
    console.log('Seed SUCCESS!');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Seed FAILED:', err);
  } finally {
    pool.end();
  }
}
run();
