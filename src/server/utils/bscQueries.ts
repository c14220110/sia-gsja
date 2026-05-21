// src/server/utils/bscQueries.ts
import pool from '@/lib/db';

export interface RawKpi {
  nilai: number | null;
  target: number;
  unit: string;
  data_tersedia: boolean;
  pesan?: string;
  numerator?: number;
  denominator?: number;
}

// KPI-1: Rasio Presensi Jemaat (target > 80%)
// Definisi BSC: AVG(hadir_QR_unik per sesi / total_jemaat_aktif) × 100%
export async function getKpi1(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sfK = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';
  // Parameter index untuk query jemaat (bisa berbeda posisi)
  const pJ: (string | number)[] = [];
  const sfJ = satelitId ? ` AND satelit_id = $${pJ.push(satelitId)}` : '';

  const [rSesi, rAktif] = await Promise.all([
    // Per-sesi: COUNT DISTINCT jemaat_id QR hadir per kegiatan
    pool.query(
      `SELECT
         k.satelit_id,
         k.id AS kegiatan_id,
         COUNT(DISTINCT ka.jemaat_id) FILTER (
           WHERE ka.role_kehadiran = 'Jemaat'
             AND ka.status_kehadiran = 'Hadir'
             AND ka.metode_absensi LIKE 'QR%'
             AND ka.jemaat_id IS NOT NULL
         ) AS hadir_bernama
       FROM public.kegiatan k
       LEFT JOIN public.kegiatan_absensi ka ON ka.kegiatan_id = k.id
       WHERE k.jenis_kegiatan_id IN (
           SELECT id FROM public.jenis_kegiatan WHERE butuh_permohonan = false
         )
         AND k.tanggal_mulai BETWEEN $1 AND $2${sfK}
       GROUP BY k.id, k.satelit_id`,
      p,
    ),
    // Total jemaat aktif per satelit (atau global)
    pool.query(
      `SELECT satelit_id, COUNT(id) AS aktif
       FROM public.jemaat
       WHERE status_jemaat = 'Aktif'
         AND is_deleted = false${sfJ}
       GROUP BY satelit_id`,
      pJ,
    ),
  ]);

  // Bangun map: satelit_id -> aktif
  const aktifMap = new Map<number, number>();
  for (const row of rAktif.rows) {
    aktifMap.set(row.satelit_id, parseInt(row.aktif, 10));
  }

  // Hitung rasio per sesi, lalu rata-rata
  let totalRasio = 0;
  let jumlahSesi = 0;
  let totalHadir = 0;

  for (const row of rSesi.rows) {
    const aktifSatelit = aktifMap.get(row.satelit_id) ?? 0;
    if (aktifSatelit > 0) {
      const hadir = parseInt(row.hadir_bernama, 10);
      totalRasio += (hadir / aktifSatelit) * 100;
      totalHadir += hadir;
      jumlahSesi++;
    }
  }

  const nilai = jumlahSesi > 0 ? parseFloat((totalRasio / jumlahSesi).toFixed(1)) : null;
  const totalAktif = [...aktifMap.values()].reduce((a, b) => a + b, 0);

  return {
    nilai,
    target: 80,
    unit: '%',
    data_tersedia: jumlahSesi > 0,
    numerator: jumlahSesi > 0 ? Math.round(totalHadir / jumlahSesi) : 0, // avg hadir per sesi
    denominator: totalAktif,
    pesan: jumlahSesi > 0 ? `Rata-rata dari ${jumlahSesi} sesi kegiatan` : undefined,
  };
}

// KPI-2: Skor CSAT Rata-rata (target > 4.5)
export async function getKpi2(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND s.satelit_id = $${p.push(satelitId)}` : '';
  const r = await pool.query(
    `SELECT
       COALESCE(ROUND(AVG(sr.skor)::numeric, 2), 0) AS avg_skor,
       COUNT(DISTINCT sr.jemaat_id) AS total_responden,
       COUNT(DISTINCT s.id) AS total_survei
     FROM public.survei_respons sr
     JOIN public.survei_pertanyaan sp ON sr.pertanyaan_id = sp.id
     JOIN public.survei s ON sr.survei_id = s.id
     WHERE sp.tipe_jawaban = 'skala'
       AND s.is_active = true
       AND sr.created_at::date BETWEEN $1 AND $2${sf}`,
    p,
  );
  const avgSkor = parseFloat(r.rows[0].avg_skor);
  const totalResponden = parseInt(r.rows[0].total_responden, 10);
  const totalSurvei = parseInt(r.rows[0].total_survei, 10);
  const dataTersedia = totalResponden > 0;
  return {
    nilai: dataTersedia ? avgSkor : null,
    target: 4.5,
    unit: 'dari 5.0',
    data_tersedia: dataTersedia,
    numerator: totalResponden,
    denominator: totalSurvei,
    pesan: dataTersedia ? `Dari ${totalResponden} responden di ${totalSurvei} survei` : 'Belum ada respons survei pada periode ini.',
  };
}

// KPI-3: Laju Pertumbuhan Jemaat (target >= 10 jiwa/bulan)
export async function getKpi3(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND satelit_id = $${p.push(satelitId)}` : '';
  const r = await pool.query(
    `SELECT COUNT(id) AS jiwa_baru
     FROM public.jemaat
     WHERE status_jemaat = 'Aktif'
       AND is_deleted = false
       AND tanggal_bergabung BETWEEN $1 AND $2${sf}`,
    p,
  );
  return { nilai: parseInt(r.rows[0].jiwa_baru, 10), target: 10, unit: 'jiwa', data_tersedia: true };
}

// KPI-4: Ketepatan Respons Pastoral (target > 90%)
export async function getKpi4(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND j.satelit_id = $${p.push(satelitId)}` : '';
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
       AND p.waktu_selesai BETWEEN $1 AND $2${sf}`,
    p,
  );
  const onTime = parseInt(r.rows[0].on_time, 10);
  const total  = parseInt(r.rows[0].total, 10);
  const nilai  = total > 0 ? parseFloat(((onTime / total) * 100).toFixed(1)) : null;
  return { nilai, target: 90, unit: '%', data_tersedia: total > 0, numerator: onTime, denominator: total };
}

// KPI-5: Rasio Beban Operasional (target < 45%, lower is better)
export async function getKpi5(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';
  const r = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN ld.jenis_anggaran = 'Penerimaan' THEN ld.jumlah * ld.harga_satuan END), 0) AS penerimaan,
       COALESCE(SUM(CASE WHEN ld.jenis_anggaran = 'Pengeluaran' THEN ld.jumlah * ld.harga_satuan END), 0) AS pengeluaran
     FROM public.kegiatan_lpj_detail ld
     JOIN public.kegiatan k ON k.id = ld.kegiatan_id
     WHERE k.tanggal_mulai BETWEEN $1 AND $2${sf}`,
    p,
  );
  const penerimaan  = parseFloat(r.rows[0].penerimaan);
  const pengeluaran = parseFloat(r.rows[0].pengeluaran);
  const nilai = penerimaan > 0 ? parseFloat(((pengeluaran / penerimaan) * 100).toFixed(1)) : null;
  return { nilai, target: 45, unit: '%', data_tersedia: penerimaan > 0 };
}

// KPI-6: Efisiensi Anggaran Proposal (target 90%–100%)
export async function getKpi6(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';
  const r = await pool.query(
    `SELECT
       COALESCE(SUM(lpj.total_pengeluaran), 0)    AS realisasi,
       COALESCE(SUM(lpj.total_subsidi_gereja), 0) AS subsidi
     FROM public.kegiatan_lpj lpj
     JOIN public.kegiatan k ON k.id = lpj.kegiatan_id
     WHERE lpj.status_lpj = 'Disetujui'
       AND k.tanggal_mulai BETWEEN $1 AND $2${sf}`,
    p,
  );
  const realisasi = parseFloat(r.rows[0].realisasi);
  const subsidi   = parseFloat(r.rows[0].subsidi);
  const nilai     = subsidi > 0 ? parseFloat(((realisasi / subsidi) * 100).toFixed(1)) : null;
  return { nilai, target: 100, unit: '%', data_tersedia: subsidi > 0 };
}

// KPI-7: Rasio Penyelesaian Tindak Lanjut CSAT (target 100%)
export async function getKpi7(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND s.satelit_id = $${p.push(satelitId)}` : '';
  const r = await pool.query(
    `SELECT
       COUNT(*) AS total_tindak_lanjut,
       COUNT(*) FILTER (WHERE st.status = 'Selesai') AS selesai
     FROM public.survei_tindak_lanjut st
     JOIN public.survei_respons sr ON st.respons_id = sr.id
     JOIN public.survei s ON sr.survei_id = s.id
     WHERE st.created_at::date BETWEEN $1 AND $2${sf}`,
    p,
  );
  const total = parseInt(r.rows[0].total_tindak_lanjut, 10);
  const selesai = parseInt(r.rows[0].selesai, 10);
  const dataTersedia = total > 0;
  const nilai = dataTersedia ? parseFloat(((selesai / total) * 100).toFixed(1)) : null;
  return {
    nilai,
    target: 100,
    unit: '%',
    data_tersedia: dataTersedia,
    numerator: selesai,
    denominator: total,
    pesan: dataTersedia ? `${selesai} dari ${total} keluhan diselesaikan` : 'Belum ada keluhan CSAT pada periode ini.',
  };
}

// KPI-8: Kelengkapan Data Presensi Bernama (target > 95%)
export async function getKpi8(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';
  const r = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ka.jemaat_id IS NOT NULL) AS bernama,
       COUNT(*) AS total
     FROM public.kegiatan_absensi ka
     JOIN public.kegiatan k ON k.id = ka.kegiatan_id
     WHERE k.tanggal_mulai BETWEEN $1 AND $2${sf}`,
    p,
  );
  const bernama = parseInt(r.rows[0].bernama, 10);
  const total   = parseInt(r.rows[0].total, 10);
  const nilai   = total > 0 ? parseFloat(((bernama / total) * 100).toFixed(1)) : null;
  return { nilai, target: 95, unit: '%', data_tersedia: total > 0, numerator: bernama, denominator: total };
}

// KPI-9: Rasio Kehadiran Pelayan (target > 90%)
export async function getKpi9(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';
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
       AND k.tanggal_mulai BETWEEN $1 AND $2${sf}`,
    p,
  );
  const hadir = parseInt(r.rows[0].hadir, 10);
  const total = parseInt(r.rows[0].total_terjadwal, 10);
  const nilai = total > 0 ? parseFloat(((hadir / total) * 100).toFixed(1)) : null;
  return { nilai, target: 90, unit: '%', data_tersedia: total > 0, numerator: hadir, denominator: total };
}

// KPI-10: Ketepatan Waktu Konfirmasi Jadwal (target > 85%)
export async function getKpi10(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';
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
     WHERE k.tanggal_mulai BETWEEN $1 AND $2${sf}`,
    p,
  );
  const onTime = parseInt(r.rows[0].on_time, 10);
  const total  = parseInt(r.rows[0].total_dikonfirmasi, 10);
  const nilai  = total > 0 ? parseFloat(((onTime / total) * 100).toFixed(1)) : null;
  return { nilai, target: 85, unit: '%', data_tersedia: total > 0, numerator: onTime, denominator: total };
}

// KPI-11: Kedisiplinan Waktu Kedatangan Pelayan (target > 95%)
export async function getKpi11(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';
  const r = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ka.waktu_hadir::time <= k.waktu_mulai) AS tepat_waktu,
       COUNT(*) AS total_hadir
     FROM public.kegiatan_absensi ka
     JOIN public.kegiatan k ON k.id = ka.kegiatan_id
     WHERE ka.role_kehadiran = 'Pelayan'
       AND ka.status_kehadiran = 'Hadir'
       AND k.tanggal_mulai BETWEEN $1 AND $2${sf}`,
    p,
  );
  const tepat = parseInt(r.rows[0].tepat_waktu, 10);
  const total = parseInt(r.rows[0].total_hadir, 10);
  const nilai = total > 0 ? parseFloat(((tepat / total) * 100).toFixed(1)) : null;
  return { nilai, target: 95, unit: '%', data_tersedia: total > 0, numerator: tepat, denominator: total };
}

// KPI-12: Rata-rata Waktu Respons Pastoral (target < 72 jam)
export async function getKpi12(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND j.satelit_id = $${p.push(satelitId)}` : '';
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
       AND p.waktu_selesai BETWEEN $1 AND $2${sf}`,
    p,
  );
  const total = parseInt(r.rows[0].total_selesai, 10);
  const nilai = total > 0 ? parseFloat(r.rows[0].rata_jam) : null;
  return { nilai, target: 72, unit: 'jam', data_tersedia: total > 0, denominator: total };
}

export async function getKpiByKey(key: string, dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  switch (key.toLowerCase()) {
    case 'kpi1': return getKpi1(dari, sampai, satelitId);
    case 'kpi2': return getKpi2(dari, sampai, satelitId);
    case 'kpi3': return getKpi3(dari, sampai, satelitId);
    case 'kpi4': return getKpi4(dari, sampai, satelitId);
    case 'kpi5': return getKpi5(dari, sampai, satelitId);
    case 'kpi6': return getKpi6(dari, sampai, satelitId);
    case 'kpi7': return getKpi7(dari, sampai, satelitId);
    case 'kpi8': return getKpi8(dari, sampai, satelitId);
    case 'kpi9': return getKpi9(dari, sampai, satelitId);
    case 'kpi10': return getKpi10(dari, sampai, satelitId);
    case 'kpi11': return getKpi11(dari, sampai, satelitId);
    case 'kpi12': return getKpi12(dari, sampai, satelitId);
    default: throw new Error(`Unknown KPI key: ${key}`);
  }
}
