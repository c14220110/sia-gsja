-- ============================================================
-- Migration: Allow NULL jemaat_id on survei_respons for anonymous surveys
-- Tanggal: 22 Mei 2026
-- ============================================================

-- Make jemaat_id nullable for anonymous survey support
ALTER TABLE public.survei_respons ALTER COLUMN jemaat_id DROP NOT NULL;

-- Verify
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'survei_respons' AND column_name = 'jemaat_id';
