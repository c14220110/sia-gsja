-- Migration: Create pendaftaran_jemaat staging table for self-registration
-- Jemaat bisa daftar sendiri → masuk tabel ini → sekretaris approve → copy ke tabel jemaat

CREATE TABLE IF NOT EXISTS pendaftaran_jemaat (
  id SERIAL PRIMARY KEY,

  -- Data identik dengan tabel jemaat
  nama_lengkap VARCHAR(200) NOT NULL,
  jenis_kelamin VARCHAR(20),
  tempat_lahir VARCHAR(100),
  tanggal_lahir DATE,
  alamat TEXT,
  kota VARCHAR(100),
  kecamatan VARCHAR(100),
  kelurahan VARCHAR(100),
  kode_pos VARCHAR(10),
  no_hp VARCHAR(20),
  email VARCHAR(150),
  pekerjaan VARCHAR(150),
  pekerjaan_id INTEGER REFERENCES pekerjaan_master(id) ON DELETE SET NULL,
  satelit_id INTEGER NOT NULL REFERENCES satelit(id) ON DELETE RESTRICT,
  foto_url TEXT,

  status_baptis BOOLEAN DEFAULT false,
  status_pernikahan VARCHAR(20) CHECK (status_pernikahan IN ('Lajang', 'Menikah', 'Duda', 'Janda')),
  status_jemaat VARCHAR(20) DEFAULT 'Aktif' CHECK (status_jemaat IN ('Aktif', 'Musiman')),

  -- Family (FK nullable — mungkin belum terdaftar di sistem)
  ayah_id INTEGER REFERENCES jemaat(id) ON DELETE SET NULL,
  ayah_nama VARCHAR(200),
  gereja_asal_ayah VARCHAR(200),
  ibu_id INTEGER REFERENCES jemaat(id) ON DELETE SET NULL,
  ibu_nama VARCHAR(200),
  gereja_asal_ibu VARCHAR(200),
  pasangan_id INTEGER REFERENCES jemaat(id) ON DELETE SET NULL,
  pasangan_nama VARCHAR(200),
  gereja_asal_pasangan VARCHAR(200),

  -- Anak & Saudara sebagai JSON array
  -- anak: [{ nama_anak, anak_jemaat_id?, gereja_asal_anak? }]
  -- saudara: [{ nama_saudara, saudara_jemaat_id?, gereja_asal_saudara? }]
  anak JSONB DEFAULT '[]'::jsonb,
  saudara JSONB DEFAULT '[]'::jsonb,

  -- Kontak / Login
  tidak_punya_kontak BOOLEAN DEFAULT false,
  username VARCHAR(50),

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'menunggu'
    CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
  catatan_review TEXT,
  reviewed_by INTEGER REFERENCES pengguna(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  jemaat_result_id INTEGER REFERENCES jemaat(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(50),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_pendaftaran_status ON pendaftaran_jemaat(status);
CREATE INDEX IF NOT EXISTS idx_pendaftaran_satelit ON pendaftaran_jemaat(satelit_id);
CREATE INDEX IF NOT EXISTS idx_pendaftaran_created ON pendaftaran_jemaat(created_at DESC);
