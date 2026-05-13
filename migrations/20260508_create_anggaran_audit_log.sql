-- ============================================================
-- MIGRATION: Create Anggaran Audit Log Table
-- Date: 2026-05-08
-- Purpose: Track the full lifecycle of RA documents for 
--          fiscal governance and response-time analytics.
-- ============================================================

-- 1. Create the anggaran_audit_log table
--    Uses VARCHAR for aksi (not the audit_action ENUM) because
--    anggaran has a richer set of actions than jemaat/pelayan.
CREATE TABLE IF NOT EXISTS public.anggaran_audit_log (
  id              serial PRIMARY KEY,
  anggaran_id     uuid NOT NULL,
  kode_dokumen    varchar(50) NOT NULL,      -- snapshot: kode RA saat aksi terjadi
  aksi            varchar(50) NOT NULL,      -- Dibuat, Diajukan, Disetujui Penuh, dll.
  status_sebelum  varchar(50),               -- status RA sebelum aksi
  status_sesudah  varchar(50) NOT NULL,      -- status RA setelah aksi
  user_id         integer NOT NULL,
  nama_pelaksana  varchar(255) NOT NULL,     -- denormalized snapshot
  role_id         integer NOT NULL,
  nama_role       varchar(100) NOT NULL,     -- denormalized snapshot
  satelit_id      integer NOT NULL,
  nama_satelit    varchar(100) NOT NULL,     -- denormalized snapshot
  keterangan      text,                      -- alasan tolak, catatan, dsb.
  created_at      timestamptz DEFAULT now(),

  CONSTRAINT fk_anggaran_audit_anggaran FOREIGN KEY (anggaran_id) 
    REFERENCES public.anggaran_tahunan(id) ON DELETE CASCADE,
  CONSTRAINT fk_anggaran_audit_user FOREIGN KEY (user_id) 
    REFERENCES public.pengguna(id),
  CONSTRAINT fk_anggaran_audit_role FOREIGN KEY (role_id) 
    REFERENCES public.role(id),
  CONSTRAINT fk_anggaran_audit_satelit FOREIGN KEY (satelit_id) 
    REFERENCES public.satelit(id)
);

-- 2. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_anggaran_audit_anggaran_id 
  ON public.anggaran_audit_log(anggaran_id);
CREATE INDEX IF NOT EXISTS idx_anggaran_audit_created_at 
  ON public.anggaran_audit_log(created_at DESC);

-- 3. Verification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'anggaran_audit_log'
ORDER BY ordinal_position;
