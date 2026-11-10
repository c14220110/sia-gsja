-- Migration: Create inventaris_audit_log and kegiatan_audit_log tables
-- Follows identical architecture to jemaat_audit_log

CREATE TABLE IF NOT EXISTS inventaris_audit_log (
  id SERIAL PRIMARY KEY,
  barang_id INT NOT NULL REFERENCES public.barang(id) ON DELETE CASCADE,
  aksi audit_action NOT NULL,
  user_id INT NOT NULL REFERENCES public.pengguna(id),
  role_id INT NOT NULL REFERENCES public.role(id),
  satelit_id INT NOT NULL REFERENCES public.satelit(id),
  keterangan TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventaris_audit_log_created_at ON inventaris_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventaris_audit_log_barang_id ON inventaris_audit_log(barang_id);
CREATE INDEX IF NOT EXISTS idx_inventaris_audit_log_aksi ON inventaris_audit_log(aksi);

CREATE TABLE IF NOT EXISTS kegiatan_audit_log (
  id SERIAL PRIMARY KEY,
  kegiatan_id INT NOT NULL REFERENCES public.kegiatan(id) ON DELETE CASCADE,
  aksi audit_action NOT NULL,
  user_id INT NOT NULL REFERENCES public.pengguna(id),
  role_id INT NOT NULL REFERENCES public.role(id),
  satelit_id INT NOT NULL REFERENCES public.satelit(id),
  keterangan TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kegiatan_audit_log_created_at ON kegiatan_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kegiatan_audit_log_kegiatan_id ON kegiatan_audit_log(kegiatan_id);
CREATE INDEX IF NOT EXISTS idx_kegiatan_audit_log_aksi ON kegiatan_audit_log(aksi);

-- Indexing for existing permohonan_layanan_audit_log for fast search and pagination
CREATE INDEX IF NOT EXISTS idx_permohonan_layanan_audit_created ON public.permohonan_layanan_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permohonan_layanan_audit_permohonan_id ON public.permohonan_layanan_audit_log(permohonan_id);
