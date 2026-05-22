-- ============================================================
-- Migration: Template Survei per Jenis Kegiatan
-- Tanggal: 2026-05-22
-- ============================================================

-- 1. Tabel master template: 1 jenis kegiatan = 1 template (UNIQUE)
CREATE TABLE public.survei_template (
  id SERIAL PRIMARY KEY,
  jenis_kegiatan_id INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT survei_template_jenis_kegiatan_uq UNIQUE (jenis_kegiatan_id),
  CONSTRAINT survei_template_jenis_kegiatan_fkey 
    FOREIGN KEY (jenis_kegiatan_id) REFERENCES public.jenis_kegiatan(id) ON DELETE CASCADE
);

-- 2. Tabel pertanyaan template (child rows, CASCADE delete)
CREATE TABLE public.survei_template_pertanyaan (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL,
  urutan INTEGER NOT NULL,
  teks_pertanyaan TEXT NOT NULL,
  tipe_jawaban VARCHAR NOT NULL DEFAULT 'skala',
  is_required BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT survei_template_pertanyaan_template_fkey 
    FOREIGN KEY (template_id) REFERENCES public.survei_template(id) ON DELETE CASCADE
);

-- 3. Grant permissions (konsisten dengan tabel lain di project)
GRANT ALL ON TABLE public.survei_template TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.survei_template_pertanyaan TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.survei_template_id_seq TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.survei_template_pertanyaan_id_seq TO anon, authenticated, service_role;
