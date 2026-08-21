-- ============================================================
-- MIGRATION: Fitur Inventaris GSJA
-- Jalankan di PostgreSQL setelah schema existing GSJA sudah ada
-- ============================================================

-- 1. Master Kategori Barang
CREATE TABLE IF NOT EXISTS public.master_kategori_barang (
  id SERIAL PRIMARY KEY,
  kode VARCHAR(5) NOT NULL UNIQUE,
  nama VARCHAR(100) NOT NULL,
  keterangan TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Master Sub-Lokasi / Ruangan
CREATE TABLE IF NOT EXISTS public.master_sublokasi (
  id SERIAL PRIMARY KEY,
  satelit_id INTEGER NOT NULL REFERENCES public.satelit(id),
  kode VARCHAR(10),
  nama VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Barang (tabel utama inventaris)
CREATE TABLE IF NOT EXISTS public.barang (
  id SERIAL PRIMARY KEY,
  kode_barang VARCHAR(30) NOT NULL UNIQUE,
  nama VARCHAR(255) NOT NULL,
  kategori_id INTEGER NOT NULL REFERENCES public.master_kategori_barang(id),
  deskripsi TEXT,
  merk VARCHAR(100),
  no_seri VARCHAR(100),
  jumlah INTEGER NOT NULL DEFAULT 1,
  kondisi VARCHAR(50) DEFAULT 'Baik',
  tahun_perolehan INTEGER,
  nilai_perolehan NUMERIC(15,2) DEFAULT 0,
  is_aktiva_tetap BOOLEAN DEFAULT false,
  foto_url TEXT,
  pemilik_tipe VARCHAR(20) NOT NULL DEFAULT 'satelit',
  pemilik_satelit_id INTEGER REFERENCES public.satelit(id),
  pemilik_jemaat_id INTEGER REFERENCES public.jemaat(id),
  pemilik_nama_lain VARCHAR(255),
  lokasi_satelit_id INTEGER REFERENCES public.satelit(id),
  lokasi_sublokasi_id INTEGER REFERENCES public.master_sublokasi(id),
  status VARCHAR(30) DEFAULT 'Aktif',
  is_deleted BOOLEAN DEFAULT false,
  created_by INTEGER REFERENCES public.pengguna(id),
  updated_by INTEGER REFERENCES public.pengguna(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_barang_kategori ON public.barang(kategori_id);
CREATE INDEX IF NOT EXISTS idx_barang_lokasi_satelit ON public.barang(lokasi_satelit_id);
CREATE INDEX IF NOT EXISTS idx_barang_pemilik_satelit ON public.barang(pemilik_satelit_id);
CREATE INDEX IF NOT EXISTS idx_barang_status ON public.barang(status);
CREATE INDEX IF NOT EXISTS idx_barang_kode ON public.barang(kode_barang);

CREATE UNIQUE INDEX IF NOT EXISTS idx_barang_no_seri_unique
  ON public.barang(no_seri)
  WHERE no_seri IS NOT NULL AND is_deleted = false;

CREATE TABLE IF NOT EXISTS public.kode_barang_counter (
  id SERIAL PRIMARY KEY,
  kategori_id INTEGER NOT NULL REFERENCES public.master_kategori_barang(id),
  tahun INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE(kategori_id, tahun)
);

-- 4. Aset Tanah
CREATE TABLE IF NOT EXISTS public.aset_tanah (
  id SERIAL PRIMARY KEY,
  barang_id INTEGER NOT NULL UNIQUE REFERENCES public.barang(id) ON DELETE CASCADE,
  no_sertifikat VARCHAR(100),
  no_akta_jual_beli VARCHAR(100),
  no_pbb VARCHAR(100),
  luas_tanah NUMERIC(12,2),
  titik_lokasi VARCHAR(100),
  atas_nama VARCHAR(255),
  catatan TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Aset Kendaraan
CREATE TABLE IF NOT EXISTS public.aset_kendaraan (
  id SERIAL PRIMARY KEY,
  barang_id INTEGER NOT NULL UNIQUE REFERENCES public.barang(id) ON DELETE CASCADE,
  no_polisi VARCHAR(20),
  no_rangka VARCHAR(50),
  no_mesin VARCHAR(50),
  jenis_kendaraan VARCHAR(50),
  tahun_pembuatan INTEGER,
  warna VARCHAR(30),
  no_stnk VARCHAR(50),
  no_bpkb VARCHAR(50),
  catatan TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Stok Opname
CREATE TABLE IF NOT EXISTS public.stok_opname (
  id SERIAL PRIMARY KEY,
  satelit_id INTEGER NOT NULL REFERENCES public.satelit(id),
  judul VARCHAR(255) NOT NULL,
  tanggal DATE NOT NULL,
  periode VARCHAR(50),
  status VARCHAR(30) DEFAULT 'Draft',
  catatan TEXT,
  created_by INTEGER REFERENCES public.pengguna(id),
  verified_by INTEGER REFERENCES public.pengguna(id),
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Stok Opname Detail
CREATE TABLE IF NOT EXISTS public.stok_opname_detail (
  id SERIAL PRIMARY KEY,
  stok_opname_id INTEGER NOT NULL REFERENCES public.stok_opname(id) ON DELETE CASCADE,
  barang_id INTEGER NOT NULL REFERENCES public.barang(id),
  jumlah_tercatat INTEGER NOT NULL DEFAULT 0,
  jumlah_fisik INTEGER,
  kondisi_fisik VARCHAR(50),
  selisih INTEGER,
  keterangan TEXT,
  foto_bukti TEXT,
  checked_by INTEGER REFERENCES public.pengguna(id),
  checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Mutasi Barang
CREATE TABLE IF NOT EXISTS public.mutasi_barang (
  id SERIAL PRIMARY KEY,
  barang_id INTEGER NOT NULL REFERENCES public.barang(id),
  dari_satelit_id INTEGER REFERENCES public.satelit(id),
  dari_sublokasi_id INTEGER REFERENCES public.master_sublokasi(id),
  ke_satelit_id INTEGER REFERENCES public.satelit(id),
  ke_sublokasi_id INTEGER REFERENCES public.master_sublokasi(id),
  tanggal_mutasi DATE NOT NULL,
  alasan TEXT,
  status VARCHAR(30) DEFAULT 'Menunggu',
  disetujui_oleh INTEGER REFERENCES public.pengguna(id),
  dicatat_oleh INTEGER NOT NULL REFERENCES public.pengguna(id),
  catatan_approval TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Peminjaman Barang
CREATE TABLE IF NOT EXISTS public.peminjaman_barang (
  id SERIAL PRIMARY KEY,
  barang_id INTEGER NOT NULL REFERENCES public.barang(id),
  peminjam_tipe VARCHAR(20) NOT NULL,
  peminjam_satelit_id INTEGER REFERENCES public.satelit(id),
  peminjam_jemaat_id INTEGER REFERENCES public.jemaat(id),
  peminjam_nama_lain VARCHAR(255),
  tanggal_pinjam DATE NOT NULL,
  tanggal_rencana_kembali DATE,
  tanggal_kembali_aktual DATE,
  status VARCHAR(30) DEFAULT 'Menunggu',
  disetujui_oleh INTEGER REFERENCES public.pengguna(id),
  dicatat_oleh INTEGER NOT NULL REFERENCES public.pengguna(id),
  catatan TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Dispose Barang
CREATE TABLE IF NOT EXISTS public.dispose_barang (
  id SERIAL PRIMARY KEY,
  barang_id INTEGER NOT NULL REFERENCES public.barang(id),
  tanggal_dispose DATE NOT NULL,
  alasan TEXT NOT NULL,
  metode_dispose VARCHAR(50),
  nilai_sisa NUMERIC(15,2) DEFAULT 0,
  penerima VARCHAR(255),
  foto_bukti TEXT,
  dicatat_oleh INTEGER NOT NULL REFERENCES public.pengguna(id),
  disetujui_oleh INTEGER REFERENCES public.pengguna(id),
  status VARCHAR(30) DEFAULT 'Menunggu',
  catatan_approval TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SEED: 12 Kategori Barang
-- ============================================================
INSERT INTO public.master_kategori_barang (kode, nama, keterangan) VALUES
  ('01', 'Tanah', 'Nomer sertifikat, akta jual beli & bukti transaksi, dokumen PBB, luas tanah & titik lokasi'),
  ('02', 'Land Improvement', 'Tempat parkir'),
  ('03', 'Gedung & Bangunan', 'Tempat gereja'),
  ('04', 'Kendaraan', 'Mobil, motor'),
  ('05', 'Peralatan Audio & Visual', 'Sound system, lampu lighting, tripod, LCD'),
  ('06', 'Peralatan Musik', 'Gitar, keyboard, mic, 1 set drum'),
  ('07', 'Peralatan Ibadah', 'Mimbar, meja komuni, kantong persembahan, kotak persembahan'),
  ('08', 'Peralatan Elektronik', 'AC, AC stand, CCTV'),
  ('09', 'Peralatan Komputer & IT', 'Printer, scanner, PC, LCD kantor'),
  ('10', 'Meubel & Furnitur Kantor', 'Meja kerja, kursi, lemari besi'),
  ('11', 'Meubel & Furnitur Ibadah', 'Rak kayu, kursi ibadah'),
  ('12', 'Peralatan Dapur & Rumah Tangga', 'Kulkas, dispenser')
ON CONFLICT (kode) DO NOTHING;

-- ============================================================
-- PERMISSIONS: Inventaris
-- ============================================================
INSERT INTO public.permission (nama_permission, deskripsi) VALUES
  ('inventaris_view', 'Melihat daftar barang inventaris'),
  ('inventaris_manage', 'Menambah, mengedit, dan menghapus barang inventaris'),
  ('inventaris_stok_opname', 'Membuat dan menjalankan stok opname'),
  ('inventaris_mutasi', 'Membuat dan menyetujui mutasi barang'),
  ('inventaris_peminjaman', 'Membuat dan menyetujui peminjaman barang'),
  ('inventaris_dispose', 'Membuat dan menyetujui dispose barang'),
  ('inventaris_import', 'Mengimpor data barang dari file Excel')
ON CONFLICT DO NOTHING;

-- Assign ke Super Admin
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r, public.permission p
WHERE r.nama_role = 'Super Admin'
  AND p.nama_permission LIKE 'inventaris_%'
ON CONFLICT DO NOTHING;

-- Assign ke Admin Satelit
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r, public.permission p
WHERE r.nama_role = 'Admin Satelit'
  AND p.nama_permission IN ('inventaris_view', 'inventaris_manage', 'inventaris_stok_opname')
ON CONFLICT DO NOTHING;

-- Assign ke Bendahara
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r, public.permission p
WHERE r.nama_role = 'Bendahara'
  AND p.nama_permission IN ('inventaris_view', 'inventaris_stok_opname')
ON CONFLICT DO NOTHING;
