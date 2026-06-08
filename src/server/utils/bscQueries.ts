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

// KPI1: Rasio Presensi Jemaat (target > 80%)
// rumus BSC: AVG(hadir_QR_unik per sesi Ibadah Raya / total_jemaat_aktif_satelit_itu) × 100%
// CUMA Ibadah Raya (jenis_kegiatan_id = 1) — ibadah rutin utama yang wajib dihadiri semua jemaat.
export async function getKpi1(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sfK = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';

  const [rSesi, rAktif] = await Promise.all([
    // Per-sesi: COUNT DISTINCT jemaat_id QR hadir per Ibadah Raya
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
       WHERE k.jenis_kegiatan_id = 1  -- Hanya Kebaktian Umum (Ibadah Raya)
         AND k.tanggal_mulai BETWEEN $1 AND $2${sfK}
       GROUP BY k.id, k.satelit_id`,
      p,
    ),
    // Total jemaat aktif PER satelit yang punya sesi Ibadah Raya dalam periode ini
    pool.query(
      `SELECT j.satelit_id, COUNT(j.id) AS aktif
       FROM public.jemaat j
       WHERE j.status_jemaat = 'Aktif'
         AND j.is_deleted = false
         AND j.satelit_id IN (
           SELECT DISTINCT satelit_id FROM public.kegiatan
           WHERE jenis_kegiatan_id = 1
             AND tanggal_mulai BETWEEN $1 AND $2${sfK}
         )
       GROUP BY j.satelit_id`,
      p,
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
    numerator: jumlahSesi > 0 ? Math.round(totalHadir / jumlahSesi) : 0,
    denominator: totalAktif,
    pesan: jumlahSesi > 0
      ? `Rata-rata ${Math.round(totalHadir / jumlahSesi)} dari ${totalAktif} jemaat per sesi Ibadah Raya (${jumlahSesi} sesi)`
      : 'Belum ada sesi Ibadah Raya dalam periode ini.',
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
// Definisi BSC: (COUNT DISTINCT jemaat hadir di Ibadah Rutin ÷ COUNT jemaat aktif di satelit yang punya kegiatan) × 100%
// Hanya kegiatan 'Ibadah Rutin' (Ibadah Raya, SM, Kaum Muda, dll) — Event & Perayaan tidak dihitung.
// Penyebut dibatasi hanya jemaat dari satelit yang memiliki sesi Ibadah Rutin dalam periode.
export async function getKpi3(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sfK = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';

  const [rHadir, rAktif] = await Promise.all([
    // Pembilang: Jemaat aktif yang hadir ≥ 1× di kegiatan Ibadah Rutin dalam periode
    pool.query(
      `SELECT COUNT(DISTINCT ka.jemaat_id) AS hadir_unik
       FROM public.kegiatan_absensi ka
       JOIN public.kegiatan k ON k.id = ka.kegiatan_id
       JOIN public.jenis_kegiatan jk ON jk.id = k.jenis_kegiatan_id
       WHERE ka.role_kehadiran = 'Jemaat'
         AND ka.status_kehadiran = 'Hadir'
         AND ka.jemaat_id IS NOT NULL
         AND jk.kategori = 'Ibadah Rutin'
         AND k.tanggal_mulai BETWEEN $1 AND $2${sfK}`,
      p,
    ),
    // Penyebut: Total jemaat aktif HANYA dari satelit yang punya sesi Ibadah Rutin di periode ini
    pool.query(
      `SELECT COUNT(DISTINCT j.id) AS aktif
       FROM public.jemaat j
       WHERE j.status_jemaat = 'Aktif'
         AND j.is_deleted = false
         AND j.satelit_id IN (
           SELECT DISTINCT k.satelit_id FROM public.kegiatan k
           JOIN public.jenis_kegiatan jk ON jk.id = k.jenis_kegiatan_id
           WHERE jk.kategori = 'Ibadah Rutin'
             AND k.tanggal_mulai BETWEEN $1 AND $2${sfK}
           AND k.satelit_id IS NOT NULL
         )`,
      p,
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
      ? `${hadirUnik} dari ${totalAktif} jemaat aktif hadir minimal 1× di Ibadah Rutin pada periode ini`
      : 'Belum ada sesi Ibadah Rutin dalam periode ini.',
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

// KPI-5: Tingkat Kecukupan Pendanaan Kegiatan (target >= 100%, higher is better)
// Definisi: ((Total Subsidi Gereja + Total Kontribusi Peserta) ÷ Total Pengeluaran LPJ) × 100%
export async function getKpi5(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const pLPJ: (string | number)[] = [dari, sampai];
  const sfLPJ = satelitId ? ` AND k.satelit_id = $${pLPJ.push(satelitId)}` : '';
  const rLPJ = await pool.query(
    `SELECT 
       COALESCE(SUM(lpj.total_subsidi_gereja + lpj.total_kontribusi_peserta), 0) AS total_pendanaan,
       COALESCE(SUM(lpj.total_pengeluaran), 0) AS total_pengeluaran
     FROM public.kegiatan_lpj lpj
     JOIN public.kegiatan k ON k.id = lpj.kegiatan_id
     WHERE lpj.status_lpj = 'Disetujui'
       AND k.tanggal_mulai BETWEEN $1 AND $2${sfLPJ}`,
    pLPJ,
  );
  
  const totalPendanaan = parseFloat(rLPJ.rows[0].total_pendanaan);
  const totalPengeluaran = parseFloat(rLPJ.rows[0].total_pengeluaran);

  const dataTersedia = totalPengeluaran > 0;
  const nilai = dataTersedia ? parseFloat(((totalPendanaan / totalPengeluaran) * 100).toFixed(1)) : null;
  
  return {
    nilai,
    target: 100,
    unit: '%',
    data_tersedia: dataTersedia,
    numerator: totalPendanaan,
    denominator: totalPengeluaran,
    pesan: dataTersedia
      ? `Total pendanaan Rp ${totalPendanaan.toLocaleString('id-ID')} dari total pengeluaran Rp ${totalPengeluaran.toLocaleString('id-ID')}`
      : 'Belum ada data pengeluaran kegiatan pada periode ini.',
  };
}

// KPI-6: Efisiensi Anggaran (target 90%–100%)
// Definisi (Opsi B): Untuk setiap kegiatan yang SUDAH LPJ dalam periode,
// hitung RAB-per-sesinya = RA_pengeluaran_disetujui ÷ frekuensi_per_tahun.
// Lalu bandingkan: Σ(realisasi LPJ) ÷ Σ(RAB_per_sesi × jumlah_kegiatan_LPJ) × 100%
// Pendekatan ini adil karena tidak membandingkan realisasi 1 bulan vs anggaran 1 tahun.
export async function getKpi6(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sfK = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';

  // Ambil semua kegiatan dengan LPJ disetujui dalam periode beserta RAB-nya
  const r = await pool.query(
    `SELECT
       lpj.total_pengeluaran AS realisasi,
       k.frekuensi_kegiatan,
       k.anggaran_tahunan_id,
       COALESCE((
         SELECT SUM(ad.nominal_disetujui)
         FROM public.anggaran_tahunan_detail ad
         WHERE ad.anggaran_tahunan_id = k.anggaran_tahunan_id
           AND ad.jenis_anggaran = 'Pengeluaran'
           AND ad.status_item IN ('ACC', 'ACC_DIPOTONG', 'Disetujui')
       ), 0) AS rab_tahunan
     FROM public.kegiatan_lpj lpj
     JOIN public.kegiatan k ON k.id = lpj.kegiatan_id
     WHERE lpj.status_lpj = 'Disetujui'
       AND k.tanggal_mulai BETWEEN $1 AND $2
       AND k.anggaran_tahunan_id IS NOT NULL${sfK}`,
    p,
  );

  let totalRealisasi = 0;
  let totalRabProporsional = 0;

  for (const row of r.rows) {
    const realisasi = parseFloat(row.realisasi) || 0;
    const rabTahunan = parseFloat(row.rab_tahunan) || 0;
    const frekuensi = row.frekuensi_kegiatan as string;

    // Konversi frekuensi ke jumlah sesi per tahun
    const sesPerTahun: Record<string, number> = {
      'Mingguan': 52, 'Dua Mingguan': 26, 'Bulanan': 12,
      'Dua Bulanan': 6, 'Triwulan': 4, 'Semester': 2,
      'Tahunan': 1, 'Sekali Pakai': 1,
    };
    const jumlahSesi = sesPerTahun[frekuensi] ?? 1;
    const rabPerSesi = rabTahunan / jumlahSesi;

    totalRealisasi += realisasi;
    totalRabProporsional += rabPerSesi;
  }

  const dataTersedia = totalRabProporsional > 0;
  const nilai = dataTersedia
    ? parseFloat(((totalRealisasi / totalRabProporsional) * 100).toFixed(1))
    : null;

  return {
    nilai,
    target: 100,
    unit: '%',
    data_tersedia: dataTersedia,
    numerator: totalRealisasi,
    denominator: totalRabProporsional,
    pesan: dataTersedia
      ? `Realisasi Rp ${Math.round(totalRealisasi).toLocaleString('id-ID')} dari RAB proporsional Rp ${Math.round(totalRabProporsional).toLocaleString('id-ID')} (${r.rows.length} kegiatan)`
      : 'Belum ada kegiatan ber-LPJ dengan RA pada periode ini.',
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
// Definisi: (Total presensi JEMAAT tercatat di sistem ÷ Total kehadiran fisik via hand tally counter) × 100%
// Hanya menghitung role_kehadiran = 'Jemaat' — absensi pelayan tidak masuk hand tally jemaat.
export async function getKpi8(dari: string, sampai: string, satelitId: number | null): Promise<RawKpi> {
  const p: (string | number)[] = [dari, sampai];
  const sf = satelitId ? ` AND k.satelit_id = $${p.push(satelitId)}` : '';
  const r = await pool.query(
    `SELECT
       COALESCE(SUM(sub.digital_count), 0) AS total_digital,
       COALESCE(SUM(sub.jumlah_hadir_manual), 0) AS total_manual
     FROM (
       SELECT k.id, k.jumlah_hadir_manual,
         COUNT(ka.id) FILTER (
           WHERE ka.role_kehadiran = 'Jemaat'
         ) AS digital_count
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
      ? `${digital} jemaat tercatat digital dari ${manual} total kehadiran fisik (hand tally)`
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
