-- SQL Fixes for Missing Parent Data
-- Run this in your Supabase SQL Editor

-- 1. Saarce (ID 1)
UPDATE jemaat SET ayah_nama = 'Fhejdj', ibu_nama = 'Sjdjdjd', gereja_asal_ayah = 'Hsjeje', gereja_asal_ibu = 'Hahwjw' WHERE id = 1;

-- 2. Andika (ID 2)
UPDATE jemaat SET ayah_nama = '121', ibu_nama = 'adas', gereja_asal_ayah = 'adas', gereja_asal_ibu = 'dd' WHERE id = 2;

-- 3. Ignatius N (ID 3)
UPDATE jemaat SET ayah_nama = $$Sami'an$$, ibu_nama = '(Meninggal)', gereja_asal_ayah = '-', gereja_asal_ibu = '' WHERE id = 3;

-- 4. Novia Eko Christiany (ID 15)
UPDATE jemaat SET ayah_nama = 'Andri Poerjanto', ibu_nama = 'Sulistyowati', gereja_asal_ayah = 'Gereja katholik Salib suci', gereja_asal_ibu = 'Gereja katholik salib suci' WHERE id = 15;

-- 5. Emi Kristianawati (ID 18)
UPDATE jemaat SET ayah_nama = 'Soekarno', ibu_nama = 'Sukariyah' WHERE id = 18;

-- Cleanup invalid relations that caused bugs in family tree
DELETE FROM relasi_jemaat WHERE jemaat_id IS NULL;
