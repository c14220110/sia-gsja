// Migration: Create bsc_perspektif + bsc_kpi tables and seed hardcoded values
// Run with: node --env-file=.env.local scripts/migrate-bsc-config.mjs

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Create bsc_perspektif ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bsc_perspektif (
        id SERIAL PRIMARY KEY,
        kode VARCHAR(20) UNIQUE NOT NULL,
        nama VARCHAR(100) NOT NULL,
        nama_singkat VARCHAR(50) NOT NULL,
        icon VARCHAR(50) DEFAULT 'category',
        warna VARCHAR(20) DEFAULT 'indigo',
        bobot NUMERIC(5,2) NOT NULL DEFAULT 25,
        urutan INT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Tabel bsc_perspektif created');

    // ── 2. Create bsc_kpi ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bsc_kpi (
        id SERIAL PRIMARY KEY,
        perspektif_id INT NOT NULL REFERENCES bsc_perspektif(id) ON DELETE CASCADE,
        kode VARCHAR(10) UNIQUE NOT NULL,
        nama VARCHAR(150) NOT NULL,
        icon VARCHAR(50) DEFAULT 'analytics',
        bobot NUMERIC(5,2) NOT NULL DEFAULT 100,
        target NUMERIC(10,2) NOT NULL,
        satuan VARCHAR(20) DEFAULT '%',
        higher_is_better BOOLEAN DEFAULT true,
        threshold_hijau NUMERIC(10,2),
        threshold_kuning NUMERIC(10,2),
        rekomendasi TEXT,
        urutan INT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Tabel bsc_kpi created');

    // ── 3. Seed bsc_perspektif ────────────────────────────────────────────
    const perspektifSeed = [
      { kode: 'jemaat',       nama: 'Jemaat & Pemangku Kepentingan', nama_singkat: 'Jemaat',           icon: 'groups',          warna: 'indigo',  bobot: 35, urutan: 1 },
      { kode: 'keuangan',     nama: 'Pengelolaan Keuangan',          nama_singkat: 'Keuangan',         icon: 'account_balance', warna: 'emerald', bobot: 25, urutan: 2 },
      { kode: 'proses',       nama: 'Proses Bisnis Internal',        nama_singkat: 'Proses Internal',  icon: 'settings',        warna: 'amber',   bobot: 25, urutan: 3 },
      { kode: 'pembelajaran', nama: 'Pembelajaran & Pertumbuhan',    nama_singkat: 'Pertumbuhan',      icon: 'school',          warna: 'violet',  bobot: 15, urutan: 4 },
    ];

    for (const p of perspektifSeed) {
      await client.query(
        `INSERT INTO bsc_perspektif (kode, nama, nama_singkat, icon, warna, bobot, urutan)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (kode) DO UPDATE SET
           nama = EXCLUDED.nama, nama_singkat = EXCLUDED.nama_singkat,
           icon = EXCLUDED.icon, warna = EXCLUDED.warna,
           bobot = EXCLUDED.bobot, urutan = EXCLUDED.urutan,
           updated_at = NOW()`,
        [p.kode, p.nama, p.nama_singkat, p.icon, p.warna, p.bobot, p.urutan]
      );
    }
    console.log('✅ Seed bsc_perspektif: 4 rows');

    // ── 4. Get perspektif IDs ──────────────────────────────────────────────
    const pRes = await client.query(`SELECT id, kode FROM bsc_perspektif ORDER BY urutan`);
    const pMap = Object.fromEntries(pRes.rows.map(r => [r.kode, r.id]));

    // ── 5. Seed bsc_kpi ───────────────────────────────────────────────────
    const kpiSeed = [
      // Jemaat (4 KPIs, 25% each)
      { perspektif: 'jemaat', kode: 'kpi1', nama: 'Rasio Presensi Jemaat', icon: 'how_to_reg', bobot: 25, target: 80, satuan: '%', higher_is_better: true, threshold_hijau: 80, threshold_kuning: 50, rekomendasi: 'Sosialisasikan kembali pentingnya pencatatan presensi mandiri lewat QR Code di setiap ibadah.', urutan: 1 },
      { perspektif: 'jemaat', kode: 'kpi2', nama: 'Skor Kepuasan Rata-rata', icon: 'star', bobot: 25, target: 4.5, satuan: 'dari 5.0', higher_is_better: true, threshold_hijau: 4.5, threshold_kuning: 4.0, rekomendasi: 'Lakukan evaluasi berkala terhadap umpan balik jemaat mengenai ibadah dan fasilitas.', urutan: 2 },
      { perspektif: 'jemaat', kode: 'kpi3', nama: 'Tingkat Retensi Kehadiran Jemaat', icon: 'loyalty', bobot: 25, target: 85, satuan: '%', higher_is_better: true, threshold_hijau: 85, threshold_kuning: 65, rekomendasi: 'Evaluasi jemaat yang tidak hadir ≥ 1 bulan, aktifkan kunjungan pastoral proaktif, dan perkuat program kelompok kecil.', urutan: 3 },
      { perspektif: 'jemaat', kode: 'kpi4', nama: 'Tingkat Ketepatan Respons Pastoral', icon: 'support_agent', bobot: 25, target: 90, satuan: '%', higher_is_better: true, threshold_hijau: 90, threshold_kuning: 70, rekomendasi: 'Evaluasi beban kerja tim pastoral dan optimalkan alur penugasan kunjungan jemaat.', urutan: 4 },
      // Keuangan (2 KPIs, 50% each)
      { perspektif: 'keuangan', kode: 'kpi5', nama: 'Tingkat Kecukupan Pendanaan', icon: 'account_balance_wallet', bobot: 50, target: 100, satuan: '%', higher_is_better: true, threshold_hijau: 100, threshold_kuning: 80, rekomendasi: 'Pastikan proyeksi pendapatan (subsidi & kontribusi) disusun secara matang agar seluruh kegiatan terdanai penuh tanpa mengalami defisit (≥ 100%).', urutan: 1 },
      { perspektif: 'keuangan', kode: 'kpi6', nama: 'Efisiensi Anggaran', icon: 'request_quote', bobot: 50, target: 100, satuan: '%', higher_is_better: true, threshold_hijau: 90, threshold_kuning: 80, rekomendasi: 'Berikan bimbingan teknis penyusunan proposal kegiatan agar estimasi biaya lebih presisi.', urutan: 2 },
      // Proses (2 KPIs, 50% each)
      { perspektif: 'proses', kode: 'kpi7', nama: 'Rasio Penyelesaian Tindak Lanjut', icon: 'task_alt', bobot: 50, target: 100, satuan: '%', higher_is_better: true, threshold_hijau: 100, threshold_kuning: 80, rekomendasi: 'Adakan koordinasi rutin untuk segera menyelesaikan dan menindaklanjuti keluhan dari jemaat.', urutan: 1 },
      { perspektif: 'proses', kode: 'kpi8', nama: 'Kelengkapan Data Presensi Bernama', icon: 'fact_check', bobot: 50, target: 95, satuan: '%', higher_is_better: true, threshold_hijau: 95, threshold_kuning: 80, rekomendasi: 'Tugaskan pelayan pintu (usher) ekstra untuk membantu jemaat melakukan QR scan saat masuk.', urutan: 2 },
      // Pembelajaran (4 KPIs, 25% each)
      { perspektif: 'pembelajaran', kode: 'kpi9', nama: 'Rasio Kehadiran Pelayan', icon: 'volunteer_activism', bobot: 25, target: 90, satuan: '%', higher_is_better: true, threshold_hijau: 90, threshold_kuning: 70, rekomendasi: 'Kirimkan pengingat jadwal otomatis lebih awal dan lakukan pembinaan komitmen pelayan.', urutan: 1 },
      { perspektif: 'pembelajaran', kode: 'kpi10', nama: 'Ketepatan Waktu Konfirmasi Jadwal', icon: 'schedule_send', bobot: 25, target: 85, satuan: '%', higher_is_better: true, threshold_hijau: 85, threshold_kuning: 65, rekomendasi: 'Sederhanakan proses konfirmasi jadwal pelayan melalui aplikasi seluler atau WhatsApp bot.', urutan: 2 },
      { perspektif: 'pembelajaran', kode: 'kpi11', nama: 'Kedisiplinan Waktu Kedatangan Pelayan', icon: 'alarm_on', bobot: 25, target: 95, satuan: '%', higher_is_better: true, threshold_hijau: 95, threshold_kuning: 80, rekomendasi: 'Berikan apresiasi kepada pelayan yang disiplin dan adakan briefing sebelum ibadah dimulai.', urutan: 3 },
      { perspektif: 'pembelajaran', kode: 'kpi12', nama: 'Tingkat Respons Pelayanan Pastoral', icon: 'timer', bobot: 25, target: 72, satuan: 'jam', higher_is_better: false, threshold_hijau: 72, threshold_kuning: 96, rekomendasi: 'Gunakan sistem notifikasi instan agar permohonan kunjungan pastoral segera ditindaklanjuti.', urutan: 4 },
    ];

    for (const k of kpiSeed) {
      const pid = pMap[k.perspektif];
      if (!pid) throw new Error(`Perspektif "${k.perspektif}" not found`);
      await client.query(
        `INSERT INTO bsc_kpi (perspektif_id, kode, nama, icon, bobot, target, satuan, higher_is_better, threshold_hijau, threshold_kuning, rekomendasi, urutan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (kode) DO UPDATE SET
           perspektif_id = EXCLUDED.perspektif_id, nama = EXCLUDED.nama, icon = EXCLUDED.icon,
           bobot = EXCLUDED.bobot, target = EXCLUDED.target, satuan = EXCLUDED.satuan,
           higher_is_better = EXCLUDED.higher_is_better, threshold_hijau = EXCLUDED.threshold_hijau,
           threshold_kuning = EXCLUDED.threshold_kuning, rekomendasi = EXCLUDED.rekomendasi,
           urutan = EXCLUDED.urutan, updated_at = NOW()`,
        [pid, k.kode, k.nama, k.icon, k.bobot, k.target, k.satuan, k.higher_is_better, k.threshold_hijau, k.threshold_kuning, k.rekomendasi, k.urutan]
      );
    }
    console.log('✅ Seed bsc_kpi: 12 rows');

    await client.query('COMMIT');
    console.log('\n🎉 Migration complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
