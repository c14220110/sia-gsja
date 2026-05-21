-- ============================================================
-- Migration: Buat tabel-tabel Modul Survei Kepuasan
-- Tanggal: 20 Mei 2026
-- Untuk: KPI-2 (Skor CSAT), KPI-7 (Penyelesaian Keluhan CSAT)
-- ============================================================

-- ============================================================
-- TABEL 1: survei (header survei)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.survei (
  id SERIAL PRIMARY KEY,
  judul VARCHAR(255) NOT NULL,
  deskripsi TEXT,
  kegiatan_id INTEGER,                        -- NULL = survei mandiri (tidak terikat kegiatan)
  satelit_id INTEGER NOT NULL,
  periode_mulai DATE NOT NULL,
  periode_selesai DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_anonim BOOLEAN DEFAULT false,            -- Jemaat bisa isi tanpa nama
  threshold_flag NUMERIC DEFAULT 4,           -- Skor < ini auto-flag keluhan (fixed: 1,2,3 = flag)
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_survei_kegiatan FOREIGN KEY (kegiatan_id) REFERENCES public.kegiatan(id),
  CONSTRAINT fk_survei_satelit FOREIGN KEY (satelit_id) REFERENCES public.satelit(id),
  CONSTRAINT fk_survei_created_by FOREIGN KEY (created_by) REFERENCES public.pengguna(id)
);

-- ============================================================
-- TABEL 2: survei_pertanyaan (daftar pertanyaan per survei)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.survei_pertanyaan (
  id SERIAL PRIMARY KEY,
  survei_id INTEGER NOT NULL,
  urutan INTEGER NOT NULL DEFAULT 1,
  teks_pertanyaan TEXT NOT NULL,
  tipe_jawaban VARCHAR(20) NOT NULL DEFAULT 'skala'
    CHECK (tipe_jawaban IN ('skala', 'teks')),   -- skala = 1-5, teks = free text
  is_required BOOLEAN DEFAULT true,
  
  CONSTRAINT fk_pertanyaan_survei FOREIGN KEY (survei_id) REFERENCES public.survei(id) ON DELETE CASCADE
);

-- ============================================================
-- TABEL 3: survei_respons (jawaban jemaat per pertanyaan)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.survei_respons (
  id SERIAL PRIMARY KEY,
  survei_id INTEGER NOT NULL,
  pertanyaan_id INTEGER NOT NULL,
  jemaat_id INTEGER,                           -- NULL jika survei anonim
  skor INTEGER CHECK (skor >= 1 AND skor <= 5),  -- NULL jika tipe = teks
  jawaban_teks TEXT,                           -- NULL jika tipe = skala
  is_flagged BOOLEAN DEFAULT false,            -- Auto-flag jika skor < threshold_flag
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_respons_survei FOREIGN KEY (survei_id) REFERENCES public.survei(id) ON DELETE CASCADE,
  CONSTRAINT fk_respons_pertanyaan FOREIGN KEY (pertanyaan_id) REFERENCES public.survei_pertanyaan(id) ON DELETE CASCADE,
  CONSTRAINT fk_respons_jemaat FOREIGN KEY (jemaat_id) REFERENCES public.jemaat(id)
);

-- ============================================================
-- TABEL 4: survei_tindak_lanjut (penyelesaian keluhan CSAT)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.survei_tindak_lanjut (
  id SERIAL PRIMARY KEY,
  respons_id INTEGER NOT NULL,                -- FK → survei_respons yang di-flag
  status VARCHAR(30) DEFAULT 'Belum Ditangani'
    CHECK (status IN ('Belum Ditangani', 'Sedang Ditangani', 'Selesai')),
  catatan_tindakan TEXT,                       -- Apa yang dilakukan Sekretaris
  ditangani_oleh INTEGER,                      -- user_id Sekretaris
  waktu_ditangani TIMESTAMP WITHOUT TIME ZONE,
  waktu_selesai TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_tl_respons FOREIGN KEY (respons_id) REFERENCES public.survei_respons(id) ON DELETE CASCADE,
  CONSTRAINT fk_tl_user FOREIGN KEY (ditangani_oleh) REFERENCES public.pengguna(id)
);

-- ============================================================
-- INDEKS untuk performa query dashboard BSC
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_survei_kegiatan ON public.survei(kegiatan_id);
CREATE INDEX IF NOT EXISTS idx_survei_satelit ON public.survei(satelit_id);
CREATE INDEX IF NOT EXISTS idx_survei_periode ON public.survei(periode_mulai, periode_selesai);
CREATE INDEX IF NOT EXISTS idx_survei_respons_survei ON public.survei_respons(survei_id);
CREATE INDEX IF NOT EXISTS idx_survei_respons_flagged ON public.survei_respons(is_flagged) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_tindak_lanjut_status ON public.survei_tindak_lanjut(status);

-- ============================================================
-- PERMISSIONS (tanpa hardcoded role_id per aturan AGENTS.md)
-- ============================================================
INSERT INTO public.permission (nama_permission, deskripsi) VALUES
  ('survei_view', 'Melihat daftar dan hasil survei kepuasan'),
  ('survei_manage', 'Membuat, mengedit, dan menghapus survei kepuasan')
ON CONFLICT (nama_permission) DO NOTHING;

-- Assign permissions ke role Gembala Satelit & Sekretaris Satelit (by name, not ID)
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id 
FROM public.role r
CROSS JOIN public.permission p
WHERE r.nama_role IN ('Gembala Satelit', 'Sekretaris Satelit')
  AND p.nama_permission IN ('survei_view', 'survei_manage')
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFIKASI
-- ============================================================
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'survei%' 
ORDER BY table_name;

SELECT nama_permission FROM public.permission WHERE nama_permission LIKE 'survei%';
