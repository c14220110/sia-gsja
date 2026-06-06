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

// KPI-2: Skor Kepuasan Rata-rata (target > 4.5)
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

// KPI-3: Tingkat Retensi Kehadiran Jemaat (target >= 85%)
// Definisi BSC: (COUNT DISTINCT jemaat_id hadir ÷ COUNT jemaat aktif) × 100%
// Mengukur persentase jemaat aktif yang hadir minimal 1× dalam periode
export async function getKpi3(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sfK = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';

  const pJ: (string | number)[] = [];
  const sfJ = satelitId ? ` AND satelit_id = $${pJ.push(satelitId)}` : '';

  const [rHadir, rAktif] = await Promise.all([
    // Pembilang: Jemaat aktif yang hadir ≥ 1× dalam periode (DISTINCT per jemaat)
    pool.query(
      `SELECT COUNT(DISTINCT ka.jemaat_id) AS hadir_unik
       FROM public.kegiatan_absensi ka
       JOIN public.kegiatan k ON k.id = ka.kegiatan_id
       WHERE ka.role_kehadiran = 'Jemaat'
         AND ka.status_kehadiran = 'Hadir'
         AND ka.jemaat_id IS NOT NULL
         AND k.tanggal_mulai BETWEEN $1 AND $2${sfK}`,
      p,
    ),
    // Penyebut: Total jemaat aktif terdaftar
    pool.query(
      `SELECT COUNT(id) AS aktif
       FROM public.jemaat
       WHERE status_jemaat = 'Aktif'
         AND is_deleted = false${sfJ}`,
      pJ,
    ),
  ]);

  const hadirUnik = parseInt(rHadir.rows[0].hadir_unik, 10);
  const totalAktif = parseInt(rAktif.rows[0].aktif, 10);
  const dataTersedia = totalAktif > 0;
  const nilai = dataTersedia ? parseFloat(((hadirUnik / totalAktif) * 100).toFixed(1)) : null;

  return {
    nilai,
    target: 85,
    unit: '%',
    data_tersedia: dataTersedia,
    numerator: hadirUnik,
    denominator: totalAktif,
    pesan: dataTersedia
      ? `${hadirUnik} dari ${totalAktif} jemaat aktif hadir setidaknya sekali dalam periode ini`
      : 'Belum ada data jemaat aktif.',
  };
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

// KPI-5: Rasio Pengeluaran Kegiatan terhadap Pemasukan (target < 70%, lower is better)
// Definisi: (Total pengeluaran LPJ ÷ Total pemasukan via SIA) × 100%
export async function getKpi5(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  // 1. Pembilang: Total pengeluaran dari kegiatan_lpj pada periode
  const pLPJ: (string | number)[] = [dari, sampai];
  const sfLPJ = satelitId ? ` AND k.satelit_id = $${pLPJ.push(satelitId)}` : '';
  const rLPJ = await pool.query(
    `SELECT COALESCE(SUM(lpj.total_pengeluaran), 0) AS total_beban
     FROM public.kegiatan_lpj lpj
     JOIN public.kegiatan k ON k.id = lpj.kegiatan_id
     WHERE lpj.status_lpj = 'Disetujui'
       AND k.tanggal_mulai BETWEEN $1 AND $2${sfLPJ}`,
    pLPJ,
  );
  const totalBeban = parseFloat(rLPJ.rows[0].total_beban);

  // 2. Penyebut: Total pemasukan dari SIA (jurnal Posted, COA grup_laporan = 'Pendapatan')
  //    Integrasi read-only dari Sistem Informasi Akuntansi
  const pSIA: (string | number)[] = [dari, sampai];
  const sfSIA = satelitId ? ` AND jd.satelit_id = $${pSIA.push(satelitId)}` : '';
  const rSIA = await pool.query(
    `SELECT COALESCE(SUM(jd.nominal), 0) AS total_pemasukan
     FROM public.buku_besar_jurnal_detail jd
     JOIN public.buku_besar_jurnal j ON j.id = jd.jurnal_id
     JOIN public.buku_besar_coa c ON c.id = jd.coa_id
     WHERE j.status = 'Posted'
       AND c.grup_laporan = 'Pendapatan'
       AND jd.posisi = 'Kredit'
       AND j.tanggal_transaksi BETWEEN $1 AND $2${sfSIA}`,
    pSIA,
  );
  const totalPemasukan = parseFloat(rSIA.rows[0].total_pemasukan);

  const dataTersedia = totalPemasukan > 0;
  const nilai = dataTersedia ? parseFloat(((totalBeban / totalPemasukan) * 100).toFixed(1)) : null;
  return {
    nilai,
    target: 70,
    unit: '%',
    data_tersedia: dataTersedia,
    numerator: totalBeban,
    denominator: totalPemasukan,
    pesan: dataTersedia
      ? `Pengeluaran kegiatan Rp ${totalBeban.toLocaleString('id-ID')} dari pemasukan Rp ${totalPemasukan.toLocaleString('id-ID')}`
      : 'Belum ada data pemasukan dari SIA pada periode ini.',
  };
}

// KPI-6: Efisiensi Anggaran (target 90%–100%)
// Definisi: (Realisasi pengeluaran ÷ RAB pengeluaran disetujui) × 100%
export async function getKpi6(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const tahun = new Date(sampai).getFullYear();

  // 1. Denominator: Total PENGELUARAN disetujui dari item-level RA (bukan header total_disetujui yang campur penerimaan)
  const pRA: (string | number)[] = [tahun];
  const sfRA = satelitId ? ` AND at.satelit_id = $${pRA.push(satelitId)}` : '';
  const rRA = await pool.query(
    `SELECT COALESCE(SUM(ad.nominal_disetujui), 0) AS rab_pengeluaran
     FROM public.anggaran_tahunan_detail ad
     JOIN public.anggaran_tahunan at ON at.id = ad.anggaran_tahunan_id
     WHERE at.tahun = $1
       AND at.status IN ('Disetujui Penuh', 'Disetujui Sebagian', 'Selesai')
       AND ad.jenis_anggaran = 'Pengeluaran'
       AND ad.status_item IN ('ACC', 'ACC_DIPOTONG', 'Disetujui')${sfRA}`,
    pRA,
  );
  const rabPengeluaran = parseFloat(rRA.rows[0].rab_pengeluaran);

  // 2. Numerator: Total realisasi pengeluaran dari SEMUA LPJ kegiatan di tahun ini
  const pLPJ: (string | number)[] = [dari, sampai];
  const sfLPJ = satelitId ? ` AND k.satelit_id = $${pLPJ.push(satelitId)}` : '';
  const rLPJ = await pool.query(
    `SELECT COALESCE(SUM(lpj.total_pengeluaran), 0) AS realisasi
     FROM public.kegiatan_lpj lpj
     JOIN public.kegiatan k ON k.id = lpj.kegiatan_id
     WHERE lpj.status_lpj = 'Disetujui'
       AND k.tanggal_mulai BETWEEN $1 AND $2${sfLPJ}`,
    pLPJ,
  );
  const realisasi = parseFloat(rLPJ.rows[0].realisasi);

  const dataTersedia = rabPengeluaran > 0;
  const nilai = dataTersedia ? parseFloat(((realisasi / rabPengeluaran) * 100).toFixed(1)) : null;
  return {
    nilai,
    target: 100,
    unit: '%',
    data_tersedia: dataTersedia,
    numerator: realisasi,
    denominator: rabPengeluaran,
    pesan: dataTersedia
      ? `Realisasi Rp ${realisasi.toLocaleString('id-ID')} dari RAB Rp ${rabPengeluaran.toLocaleString('id-ID')}`
      : 'Belum ada RA yang disetujui pada tahun ini.',
  };
}

// KPI-7: Rasio Penyelesaian Tindak Lanjut Keluhan Survei (target 100%)
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
    pesan: dataTersedia ? `${selesai} dari ${total} keluhan diselesaikan` : 'Belum ada keluhan survei pada periode ini.',
  };
}

// KPI-8: Kelengkapan Data Presensi Bernama (target > 95%)
// Definisi: (Total presensi tercatat di sistem ÷ Total kehadiran manual via hand tally) × 100%
export async function getKpi8(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';
  const r = await pool.query(
    `SELECT
       COALESCE(SUM(sub.digital_count), 0) AS total_digital,
       COALESCE(SUM(sub.jumlah_hadir_manual), 0) AS total_manual
     FROM (
       SELECT k.id, k.jumlah_hadir_manual, COUNT(ka.id) AS digital_count
       FROM public.kegiatan k
       LEFT JOIN public.kegiatan_absensi ka ON ka.kegiatan_id = k.id
       WHERE k.jumlah_hadir_manual IS NOT NULL
         AND k.jumlah_hadir_manual > 0
         AND k.tanggal_mulai BETWEEN $1 AND $2${sf}
       GROUP BY k.id
     ) sub`,
    p,
  );
  const digital = parseInt(r.rows[0].total_digital, 10);
  const manual  = parseInt(r.rows[0].total_manual, 10);
  const dataTersedia = manual > 0;
  const nilai = dataTersedia ? parseFloat((Math.min(digital / manual, 1) * 100).toFixed(1)) : null;
  return {
    nilai,
    target: 95,
    unit: '%',
    data_tersedia: dataTersedia,
    numerator: digital,
    denominator: manual,
    pesan: dataTersedia
      ? `${digital} tercatat digital dari ${manual} kehadiran manual`
      : 'Belum ada kegiatan dengan input kehadiran manual (hand tally) pada periode ini.',
  };
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
