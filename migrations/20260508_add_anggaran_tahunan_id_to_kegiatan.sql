-- ============================================================
-- MIGRATION: Link Kegiatan → Anggaran Tahunan (RA)
-- Date: 2026-05-08
-- Purpose: Enforce fiscal discipline — every non-draft activity 
--          must be linked to an approved budget document (RA).
-- ============================================================

-- 1. Add the FK column (nullable — Draft kegiatan boleh kosong)
ALTER TABLE public.kegiatan
  ADD COLUMN IF NOT EXISTS anggaran_tahunan_id uuid;

-- 2. Create the Foreign Key constraint
ALTER TABLE public.kegiatan
  ADD CONSTRAINT fk_kegiatan_anggaran_tahunan
  FOREIGN KEY (anggaran_tahunan_id)
  REFERENCES public.anggaran_tahunan(id)
  ON DELETE SET NULL;

-- 3. Index for faster JOIN & lookup
CREATE INDEX IF NOT EXISTS idx_kegiatan_anggaran_tahunan_id
  ON public.kegiatan(anggaran_tahunan_id);

-- 4. Verification query — run this to confirm
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'kegiatan'
  AND column_name = 'anggaran_tahunan_id';
