-- ============================================================================
-- SIM GSJA: Pembaruan Modul Data Pegawai & Rapikan Master Departemen
-- Jalankan di Supabase SQL Editor (Staging terlebih dahulu, lalu Production)
-- ============================================================================

-- 1. Tambah kolom NIK (16 digit) dan Shift Kerja (khusus Satpam / Security)
ALTER TABLE public.pegawai
  ADD COLUMN IF NOT EXISTS nik VARCHAR(16),
  ADD COLUMN IF NOT EXISTS shift_kerja VARCHAR(30);

-- 2. Rapikan penulisan departemen (Title Case, tanpa singkatan) & nonaktifkan duplikat
UPDATE public.departemen SET nama_departemen = 'Anjang Kasih' WHERE id = 1;
UPDATE public.departemen SET nama_departemen = 'Ibadah' WHERE id = 3;
UPDATE public.departemen SET nama_departemen = 'Multimedia' WHERE id = 5;
UPDATE public.departemen SET nama_departemen = 'Pendidikan' WHERE id = 6;
UPDATE public.departemen SET nama_departemen = 'Doa & Diakonia' WHERE id = 8;
UPDATE public.departemen SET nama_departemen = 'Worship Leader & Singer' WHERE id = 9;
UPDATE public.departemen SET nama_departemen = 'Pekabaran Injil' WHERE id = 10;
UPDATE public.departemen SET nama_departemen = 'Misi' WHERE id = 11;
UPDATE public.departemen SET nama_departemen = 'Tata Graha' WHERE id = 12;

-- Nonaktifkan duplikat lama (DIAKONIA, MISI, PI) agar dropdown tidak double
UPDATE public.departemen SET is_active = false WHERE id IN (2, 4, 7);
