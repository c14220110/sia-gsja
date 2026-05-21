const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testAllKpis() {
  const dari = '2026-05-01';
  const sampai = '2026-05-31';
  const satelitId = null;

  const kpiKeys = ['kpi1', 'kpi2', 'kpi3', 'kpi4', 'kpi5', 'kpi6', 'kpi7', 'kpi8', 'kpi9', 'kpi10', 'kpi11', 'kpi12'];

  for (const key of kpiKeys) {
    try {
      console.log(`Testing ${key}...`);

      // KPI-1
      if (key === 'kpi1') {
        const p1 = [dari, sampai];
        const rHadir = await pool.query(
          `SELECT COUNT(ka.id) AS hadir
           FROM public.kegiatan_absensi ka
           JOIN public.kegiatan k ON k.id = ka.kegiatan_id
           WHERE ka.role_kehadiran = 'Jemaat'
             AND ka.status_kehadiran = 'Hadir'
             AND ka.metode_absensi LIKE 'QR%'
             AND k.tanggal_mulai BETWEEN $1 AND $2`,
          p1
        );
        const rAktif = await pool.query(
          `SELECT COUNT(id) AS aktif
           FROM public.jemaat
           WHERE status_jemaat = 'Aktif'
             AND is_deleted = false`,
          []
        );
        console.log(`  KPI-1: hadir=${rHadir.rows[0].hadir}, aktif=${rAktif.rows[0].aktif}`);
      }

      // KPI-3
      if (key === 'kpi3') {
        const r = await pool.query(
          `SELECT COUNT(id) AS jiwa_baru
           FROM public.jemaat
           WHERE status_jemaat = 'Aktif'
             AND is_deleted = false
             AND tanggal_bergabung BETWEEN $1 AND $2`,
          [dari, sampai]
        );
        console.log(`  KPI-3: jiwa_baru=${r.rows[0].jiwa_baru}`);
      }

      // KPI-4
      if (key === 'kpi4') {
        const r = await pool.query(
          `SELECT
             COUNT(*) FILTER (
               WHERE p.waktu_ditugaskan IS NOT NULL
                 AND p.waktu_selesai    IS NOT NULL
                 AND (p.waktu_ditugaskan - p.waktu_diterima)  <= INTERVAL '24 hours'
                 AND (p.waktu_selesai   - p.waktu_ditugaskan) <= INTERVAL '3 days'
             ) AS on_time,
             COUNT(*) AS total
           FROM public.permohonan_layanan_pastoral p
           JOIN public.jemaat j ON j.id = p.jemaat_pemohon_id
           WHERE p.status_permohonan = 'Selesai'
             AND p.waktu_selesai BETWEEN $1 AND $2`,
          [dari, sampai]
        );
        console.log(`  KPI-4: on_time=${r.rows[0].on_time}, total=${r.rows[0].total}`);
      }

      // KPI-5
      if (key === 'kpi5') {
        const r = await pool.query(
          `SELECT
             COALESCE(SUM(CASE WHEN ld.jenis_anggaran = 'Penerimaan' THEN ld.jumlah * ld.harga_satuan END), 0) AS penerimaan,
             COALESCE(SUM(CASE WHEN ld.jenis_anggaran = 'Pengeluaran' THEN ld.jumlah * ld.harga_satuan END), 0) AS pengeluaran
           FROM public.kegiatan_lpj_detail ld
           JOIN public.kegiatan k ON k.id = ld.kegiatan_id
           WHERE k.tanggal_mulai BETWEEN $1 AND $2`,
          [dari, sampai]
        );
        console.log(`  KPI-5: penerimaan=${r.rows[0].penerimaan}, pengeluaran=${r.rows[0].pengeluaran}`);
      }

      // KPI-6
      if (key === 'kpi6') {
        const r = await pool.query(
          `SELECT
             COALESCE(SUM(lpj.total_pengeluaran), 0)    AS realisasi,
             COALESCE(SUM(lpj.total_subsidi_gereja), 0) AS subsidi
           FROM public.kegiatan_lpj lpj
           JOIN public.kegiatan k ON k.id = lpj.kegiatan_id
           WHERE lpj.status_lpj = 'Disetujui'
             AND k.tanggal_mulai BETWEEN $1 AND $2`,
          [dari, sampai]
        );
        console.log(`  KPI-6: realisasi=${r.rows[0].realisasi}, subsidi=${r.rows[0].subsidi}`);
      }

      // KPI-8
      if (key === 'kpi8') {
        const r = await pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE ka.jemaat_id IS NOT NULL) AS bernama,
             COUNT(*) AS total
           FROM public.kegiatan_absensi ka
           JOIN public.kegiatan k ON k.id = ka.kegiatan_id
           WHERE k.tanggal_mulai BETWEEN $1 AND $2`,
          [dari, sampai]
        );
        console.log(`  KPI-8: bernama=${r.rows[0].bernama}, total=${r.rows[0].total}`);
      }

      // KPI-9
      if (key === 'kpi9') {
        const r = await pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE ka.status_kehadiran = 'Hadir') AS hadir,
             COUNT(*) AS total_terjadwal
           FROM public.kegiatan_jadwal_pelayan jp
           JOIN public.pelayan p    ON p.id  = jp.pelayan_id
           JOIN public.kegiatan k   ON k.id  = jp.kegiatan_id
           LEFT JOIN public.kegiatan_absensi ka
             ON  ka.kegiatan_id    = jp.kegiatan_id
             AND ka.jemaat_id      = p.jemaat_id
             AND ka.role_kehadiran = 'Pelayan'
           WHERE jp.status_konfirmasi IN ('Bersedia', 'Hadir')
             AND k.tanggal_mulai BETWEEN $1 AND $2`,
          [dari, sampai]
        );
        console.log(`  KPI-9: hadir=${r.rows[0].hadir}, total_terjadwal=${r.rows[0].total_terjadwal}`);
      }

      // KPI-10
      if (key === 'kpi10') {
        const r = await pool.query(
          `SELECT
             COUNT(*) FILTER (
               WHERE jp.confirmed_at IS NOT NULL
                 AND (jp.confirmed_at - jp.created_at) <= INTERVAL '24 hours'
             ) AS on_time,
             COUNT(*) FILTER (
               WHERE jp.status_konfirmasi IN ('Bersedia', 'Berhalangan', 'Hadir', 'Tidak Hadir')
             ) AS total_dikonfirmasi
           FROM public.kegiatan_jadwal_pelayan jp
           JOIN public.kegiatan k ON k.id = jp.kegiatan_id
           WHERE k.tanggal_mulai BETWEEN $1 AND $2`,
          [dari, sampai]
        );
        console.log(`  KPI-10: on_time=${r.rows[0].on_time}, total_dikonfirmasi=${r.rows[0].total_dikonfirmasi}`);
      }

      // KPI-11
      if (key === 'kpi11') {
        const r = await pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE ka.waktu_hadir::time <= k.waktu_mulai) AS tepat_waktu,
             COUNT(*) AS total_hadir
           FROM public.kegiatan_absensi ka
           JOIN public.kegiatan k ON k.id = ka.kegiatan_id
           WHERE ka.role_kehadiran = 'Pelayan'
             AND ka.status_kehadiran = 'Hadir'
             AND k.tanggal_mulai BETWEEN $1 AND $2`,
          [dari, sampai]
        );
        console.log(`  KPI-11: tepat_waktu=${r.rows[0].tepat_waktu}, total_hadir=${r.rows[0].total_hadir}`);
      }

      // KPI-12
      if (key === 'kpi12') {
        const r = await pool.query(
          `SELECT
             ROUND(
               AVG(EXTRACT(EPOCH FROM (p.waktu_selesai - p.waktu_ditugaskan)) / 3600.0)::numeric,
               1
             ) AS rata_jam,
             COUNT(*) AS total_selesai
           FROM public.permohonan_layanan_pastoral p
           JOIN public.jemaat j ON j.id = p.jemaat_pemohon_id
           WHERE p.status_permohonan = 'Selesai'
             AND p.waktu_ditugaskan IS NOT NULL
             AND p.waktu_selesai    IS NOT NULL
             AND p.waktu_selesai BETWEEN $1 AND $2`,
          [dari, sampai]
        );
        console.log(`  KPI-12: rata_jam=${r.rows[0].rata_jam}, total_selesai=${r.rows[0].total_selesai}`);
      }

    } catch (err) {
      console.error(`Error executing query for ${key}:`, err);
    }
  }
  pool.end();
}

testAllKpis();
