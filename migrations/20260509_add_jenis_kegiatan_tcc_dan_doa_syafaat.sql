-- ============================================================
-- MIGRATION: Tambah Jenis Kegiatan TCC & Doa Syafaat
-- Date: 2026-05-09
-- Purpose: Meregistrasi 2 jenis kegiatan yang digunakan oleh
--          Satelit Getsemani (dan kemungkinan satelit lain)
--          namun belum ada di master jenis_kegiatan:
--          1. Ibadah TCC (Teen Christian Community) — ibadah remaja
--             yang berbeda dari SM (anak) dan 11DG (muda dewasa).
--          2. Doa Syafaat — sesi doa syafaat / intercession yang
--             dijadwalkan terpisah dari Doa Pagi dan Doa Malam.
-- ============================================================

INSERT INTO public.jenis_kegiatan
  (nama_jenis_kegiatan, keterangan, kategori, default_is_published, default_butuh_registrasi, butuh_permohonan, kode_singkatan)
VALUES
  (
    'Kebaktian TCC (Teen Christian Community)',
    'Ibadah reguler mingguan untuk remaja (usia SMP-SMA). Berbeda dari Sekolah Minggu (anak) dan Kaum Muda (dewasa).',
    'Ibadah Rutin',
    true,
    false,
    false,
    'TC'
  ),
  (
    'Doa Syafaat',
    'Sesi doa syafaat / intercessory prayer yang dijadwalkan sebagai kegiatan tersendiri, bisa harian, mingguan, atau situasional.',
    'Ibadah Rutin',
    true,
    false,
    false,
    'DS'
  )
ON CONFLICT (nama_jenis_kegiatan) DO NOTHING;

-- Verifikasi hasil insert
SELECT id, nama_jenis_kegiatan, kategori, kode_singkatan
FROM public.jenis_kegiatan
WHERE nama_jenis_kegiatan IN (
  'Kebaktian TCC (Teen Christian Community)',
  'Doa Syafaat'
);
