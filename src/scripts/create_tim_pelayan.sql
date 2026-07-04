-- ============================================================
-- Migration: Tim Pelayan Module
-- Deskripsi: Membuat tabel tim_pelayan dan tim_pelayan_anggota
--            untuk pengelompokan pelayan per tim & peran.
-- ============================================================

-- Tabel header tim pelayan
CREATE TABLE IF NOT EXISTS public.tim_pelayan (
  id           SERIAL PRIMARY KEY,
  nama_tim     VARCHAR NOT NULL,
  deskripsi    TEXT,
  satelit_id   INTEGER NOT NULL REFERENCES public.satelit(id),
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel anggota tim (1 anggota = 1 role di dalam 1 tim)
CREATE TABLE IF NOT EXISTS public.tim_pelayan_anggota (
  id               SERIAL PRIMARY KEY,
  tim_id           INTEGER NOT NULL REFERENCES public.tim_pelayan(id) ON DELETE CASCADE,
  pelayan_id       INTEGER NOT NULL REFERENCES public.pelayan(id) ON DELETE CASCADE,
  role_pelayan_id  INTEGER NOT NULL REFERENCES public.role_pelayan(id),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tim_id, pelayan_id)  -- 1 pelayan hanya bisa 1x di 1 tim
);

-- Indexes untuk performa query
CREATE INDEX IF NOT EXISTS idx_tim_pelayan_satelit          ON public.tim_pelayan(satelit_id);
CREATE INDEX IF NOT EXISTS idx_tim_pelayan_anggota_tim      ON public.tim_pelayan_anggota(tim_id);
CREATE INDEX IF NOT EXISTS idx_tim_pelayan_anggota_pelayan  ON public.tim_pelayan_anggota(pelayan_id);
