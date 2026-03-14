-- KUMPULAN PERBAIKAN SQL BERDASARKAN CSV -> DATABASE
-- Jalankan ini di SQL Editor Supabase Anda

-- ==========================================
-- 1. PERBAIKAN DATA PASANGAN
-- ==========================================
-- Mengikat relasi Jemaat Dalam (Saul & Novia)
UPDATE jemaat SET pasangan_id = '16', pasangan_nama = 'Saul Tri setyo budi' WHERE id = '15';
UPDATE jemaat SET pasangan_id = '15', pasangan_nama = 'Novia Eko Christiany' WHERE id = '16';

-- Mengikat data Suami/Istri dari luar gereja
UPDATE jemaat SET pasangan_nama = 'Dhrhrh', gereja_asal_pasangan = 'Gjkj' WHERE id = '1';
UPDATE jemaat SET pasangan_nama = 'adas', gereja_asal_pasangan = 'adas' WHERE id = '2';
UPDATE jemaat SET pasangan_nama = 'Elisabeth Aguslim', gereja_asal_pasangan = 'Gsja' WHERE id = '3';


-- ==========================================
-- 2. PERBAIKAN DATA ORANG TUA LUAR (AYAH & IBU)
-- ==========================================
UPDATE jemaat SET ayah_nama = 'Fhejdj', ibu_nama = 'Sjdjdjd', gereja_asal_ayah = 'Hsjeje', gereja_asal_ibu = 'Hahwjw' WHERE id = '1';
UPDATE jemaat SET ayah_nama = '121', ibu_nama = 'adas', gereja_asal_ayah = 'adas', gereja_asal_ibu = 'dd' WHERE id = '2';
UPDATE jemaat SET ayah_nama = $$Sami'an$$, ibu_nama = '(Meninggal)', gereja_asal_ayah = '-', gereja_asal_ibu = '' WHERE id = '3';
UPDATE jemaat SET ayah_nama = 'Andri Poerjanto', ibu_nama = 'Sulistyowati', gereja_asal_ayah = 'Gereja katholik Salib suci', gereja_asal_ibu = 'Gereja katholik salib suci' WHERE id = '15';
UPDATE jemaat SET ayah_nama = 'Soekarno', ibu_nama = 'Sukariyah' WHERE id = '18';


-- ==========================================
-- 3. PERBAIKAN LINK AYAH/IBU UNTUK ANAK-ANAK SAUL
-- ==========================================
-- Saviera & Darios sebenarnya ayah ibunya (Saul & Novia) sudah ada di database,
-- tapi kolom ayah_id dan ibu_id mereka masih kosong, mari kita ikatkan id-nya secara langsung:

-- Untuk Saviera (ID 10)
UPDATE jemaat 
SET ayah_id = '16', ibu_id = '15', 
    ayah_nama = 'Saul Tri setyo budi', 
    ibu_nama = 'Novia Eko Christiany' 
WHERE id = '10';

-- Untuk Darios (ID 14)
UPDATE jemaat 
SET ayah_id = '16', ibu_id = '15', 
    ayah_nama = 'Saul Tri setyo budi', 
    ibu_nama = 'Novia Eko Christiany' 
WHERE id = '14';


-- ==========================================
-- 4. PEMBERSIHAN DATA ERROR
-- ==========================================
-- Menghapus baris error sisa yang dibuat manual dengan jemaat_id null:
DELETE FROM relasi_jemaat WHERE jemaat_id IS NULL;
