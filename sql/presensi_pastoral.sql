-- ============================================================================
-- SIM GSJA: Modul Presensi, Face Recognition & Jurnal Kunjungan Pastoral
-- Jalankan di Supabase SQL Editor (Staging terlebih dahulu, lalu Production)
-- ============================================================================

-- 1. Tambah kolom GPS Location & Geofence Radius pada tabel satelit
ALTER TABLE public.satelit
  ADD COLUMN IF NOT EXISTS gps_location TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radius_meter INTEGER NOT NULL DEFAULT 100;

-- 2. Tambah kolom Biometrik Wajah pada tabel pegawai
ALTER TABLE public.pegawai
  ADD COLUMN IF NOT EXISTS face_descriptor JSONB,
  ADD COLUMN IF NOT EXISTS face_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS face_enrolled_at TIMESTAMPTZ;

-- 3. Tabel Presensi Harian Pegawai (1 baris per pegawai per tanggal WIB)
CREATE TABLE IF NOT EXISTS public.pegawai_presensi (
  id SERIAL PRIMARY KEY,
  pegawai_id INTEGER NOT NULL REFERENCES public.pegawai(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,

  -- Check-In (Wajib Geofence Radius Satelit + Face Recognition)
  check_in_at TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_in_accuracy DOUBLE PRECISION,
  check_in_distance_m INTEGER,
  check_in_satelit_id INTEGER REFERENCES public.satelit(id),
  check_in_photo_url TEXT,
  check_in_face_score NUMERIC(5,4),
  check_in_status VARCHAR(20) DEFAULT 'TEPAT_WAKTU', -- TEPAT_WAKTU | TERLAMBAT

  -- Check-Out (Lokasi bebas + Face Recognition)
  check_out_at TIMESTAMPTZ,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  check_out_accuracy DOUBLE PRECISION,
  check_out_photo_url TEXT,
  check_out_face_score NUMERIC(5,4),
  worked_minutes INTEGER NOT NULL DEFAULT 0,

  -- Ringkasan Harian (1 Catatan Overview + 1 Attachment per Attendance)
  overview_note TEXT,
  overview_attachment_url TEXT,
  overview_attachment_name TEXT,
  overview_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_pegawai_presensi_tanggal UNIQUE (pegawai_id, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_pegawai_presensi_tanggal
  ON public.pegawai_presensi(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_pegawai_presensi_pegawai_tanggal
  ON public.pegawai_presensi(pegawai_id, tanggal DESC);

-- 4. Tabel Jurnal Kunjungan / Visit (Multi-Visit per hari, bisa sebelum atau sesudah Check-Out)
CREATE TABLE IF NOT EXISTS public.pegawai_kunjungan (
  id SERIAL PRIMARY KEY,
  presensi_id INTEGER REFERENCES public.pegawai_presensi(id) ON DELETE SET NULL,
  pegawai_id INTEGER NOT NULL REFERENCES public.pegawai(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  waktu_kunjungan TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kategori VARCHAR(80) NOT NULL DEFAULT 'Pelayanan Pastoral',
  satelit_tujuan_id INTEGER REFERENCES public.satelit(id),
  lokasi_bebas TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  gps_accuracy DOUBLE PRECISION,
  selfie_url TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pegawai_kunjungan_pegawai_tanggal
  ON public.pegawai_kunjungan(pegawai_id, tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_pegawai_kunjungan_presensi
  ON public.pegawai_kunjungan(presensi_id);

-- 5. Tabel Chatter / Audit Log Presensi ala Odoo HRIS
CREATE TABLE IF NOT EXISTS public.pegawai_presensi_chatter (
  id SERIAL PRIMARY KEY,
  pegawai_id INTEGER NOT NULL REFERENCES public.pegawai(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  presensi_id INTEGER REFERENCES public.pegawai_presensi(id) ON DELETE SET NULL,
  actor_user_id INTEGER,
  actor_name VARCHAR(150) NOT NULL DEFAULT 'System',
  event_type VARCHAR(40) NOT NULL, -- ADMIN_EDIT | ADMIN_CREATE | ADMIN_DELETE | LOG_NOTE
  message TEXT,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pegawai_presensi_chatter_lookup
  ON public.pegawai_presensi_chatter(pegawai_id, tanggal DESC, created_at DESC);

-- 6. Seed Role PEGAWAI (tampilan full mobile seperti JEMAAT)
SELECT setval(
  pg_get_serial_sequence('public.role', 'id'),
  COALESCE((SELECT MAX(id) FROM public.role), 1),
  true
);

INSERT INTO public.role (nama_role, deskripsi, is_active)
SELECT 'PEGAWAI', 'Akses mobile presensi & jurnal kunjungan pastoral pegawai', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.role WHERE UPPER(nama_role) = 'PEGAWAI'
);
