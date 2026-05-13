-- =============================================
-- MIGRATION: Add review columns for RA workflow
-- Date: 2026-05-08
-- Run di: Supabase Dashboard > SQL Editor
-- =============================================

-- 1. anggaran_tahunan: tambah kolom reviewer + kolom RA baru
ALTER TABLE public.anggaran_tahunan 
  ADD COLUMN IF NOT EXISTS reviewed_by integer,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS kategori_ra character varying DEFAULT 'Kegiatan',
  ADD COLUMN IF NOT EXISTS pola_penggunaan character varying DEFAULT 'Sekali Pakai';

-- FK untuk reviewed_by (jika belum ada)
DO $$ BEGIN
  ALTER TABLE public.anggaran_tahunan
    ADD CONSTRAINT fk_anggaran_reviewed_by 
    FOREIGN KEY (reviewed_by) REFERENCES public.pengguna(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. anggaran_tahunan_detail: rename status_peruntukkan → status_item
ALTER TABLE public.anggaran_tahunan_detail 
  RENAME COLUMN status_peruntukkan TO status_item;

-- 3. anggaran_tahunan_detail: tambah updated_at
ALTER TABLE public.anggaran_tahunan_detail 
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;

-- Verifikasi
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'anggaran_tahunan' 
  AND column_name IN ('reviewed_by', 'reviewed_at', 'kategori_ra', 'pola_penggunaan')
ORDER BY column_name;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'anggaran_tahunan_detail' 
  AND column_name IN ('status_item', 'updated_at')
ORDER BY column_name;
