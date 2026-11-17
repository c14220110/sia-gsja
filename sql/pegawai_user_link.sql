-- ============================================================================
-- SIM GSJA: Tambah Relasi pegawai.user_id -> pengguna(id) (Odoo Best Practice)
-- Jalankan di Supabase SQL Editor (Staging terlebih dahulu, lalu Production)
-- ============================================================================

ALTER TABLE public.pegawai
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES public.pengguna(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pegawai_user_id
  ON public.pegawai(user_id);

-- Backfill otomatis pegawai yang sudah punya jemaat_id atau email/no_hp cocok dengan pengguna
UPDATE public.pegawai p
SET user_id = u.id
FROM public.pengguna u
WHERE p.user_id IS NULL
  AND (
    (p.jemaat_id IS NOT NULL AND u.jemaat_id = p.jemaat_id)
    OR (p.email_pribadi IS NOT NULL AND p.email_pribadi <> '' AND u.email IS NOT NULL AND LOWER(p.email_pribadi) = LOWER(u.email))
    OR (p.no_hp IS NOT NULL AND p.no_hp <> '' AND u.no_hp IS NOT NULL AND p.no_hp = u.no_hp)
  );
