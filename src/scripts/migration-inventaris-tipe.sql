-- Migration: Add tipe_barang to barang table
-- Run: psql -d <database> -f migration-inventaris-tipe.sql
-- Purpose: Distinguish 'Aset Satuan' (individual tracked assets) from 'Stok Massal' (bulk stock)

ALTER TABLE barang ADD COLUMN IF NOT EXISTS tipe_barang VARCHAR(10) NOT NULL DEFAULT 'massal';

-- Auto-classify existing records with serial number as satuan
UPDATE barang SET tipe_barang = 'satuan' WHERE no_seri IS NOT NULL AND no_seri != '' AND tipe_barang = 'massal';

-- Add constraint
ALTER TABLE barang DROP CONSTRAINT IF EXISTS chk_tipe_barang;
ALTER TABLE barang ADD CONSTRAINT chk_tipe_barang CHECK (tipe_barang IN ('satuan', 'massal'));
