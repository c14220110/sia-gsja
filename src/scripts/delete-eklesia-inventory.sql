-- ==============================================================================
-- SCRIPT PEMBERSIHAN DATA INVENTARIS SATELIT EKLESIA (ID: 5, KODE: 04)
-- DATABASE: LIVE PRODUCTION GSJA
-- ==============================================================================
-- Alasan: Salah format link Google Drive saat import massal tanggal 16 Okt 2026.
-- Data yang dihapus HANYA data barang milik Satelit Eklesia.
-- Data master satelit, master sublokasi, dan data satelit lain TIDAK tersentuh.
-- ==============================================================================

BEGIN;

-- 1. Validasi awal: pastikan hanya data Eklesia (satelit_id = 5) yang ditargetkan
-- dan cek jumlah data yang akan dihapus (harus tepat 628 baris)
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM barang 
    WHERE lokasi_satelit_id = 5;

    IF v_count != 628 THEN
        RAISE EXCEPTION 'Safety check gagal! Ditemukan % baris, seharusnya tepat 628 baris. Transaksi dibatalkan.', v_count;
    END IF;
END $$;

-- 2. Hapus data barang Eklesia
DELETE FROM barang 
WHERE lokasi_satelit_id = 5 
  AND pemilik_satelit_id = 5 
  AND id BETWEEN 6302 AND 6929;

-- 3. Reset kode_barang_counter (tahun 2025) ke angka tertinggi dari satelit lain
-- agar saat re-import nanti kode barang tetap urut rapi tanpa ada nomor yang loncat
WITH max_counters AS (
    SELECT 
        kc.kategori_id,
        kc.tahun,
        COALESCE(MAX(CAST(SPLIT_PART(b.kode_barang, '-', 4) AS INTEGER)), 0) as new_last_number
    FROM kode_barang_counter kc
    LEFT JOIN barang b 
      ON b.kategori_id = kc.kategori_id 
     AND b.tahun_perolehan = kc.tahun
     AND b.lokasi_satelit_id != 5
    WHERE kc.tahun = 2025
    GROUP BY kc.kategori_id, kc.tahun
)
UPDATE kode_barang_counter kc
SET last_number = mc.new_last_number
FROM max_counters mc
WHERE kc.kategori_id = mc.kategori_id AND kc.tahun = mc.tahun;

-- 4. Verifikasi akhir: pastikan barang Eklesia sudah 0
DO $$
DECLARE
    v_remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_remaining 
    FROM barang 
    WHERE lokasi_satelit_id = 5;

    IF v_remaining != 0 THEN
        RAISE EXCEPTION 'Masih ada % data barang Eklesia tersisa! Rollback.', v_remaining;
    END IF;
END $$;

COMMIT;

-- Selesai!
