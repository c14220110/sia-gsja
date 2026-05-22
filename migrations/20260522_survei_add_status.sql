-- ============================================================
-- Migration: Add status column to survei table
-- Tanggal: 22 Mei 2026
-- Purpose: Explicit status lifecycle instead of computed from dates
-- ============================================================

-- 1. Add status column
ALTER TABLE public.survei 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'terjadwal'
CHECK (status IN ('terjadwal', 'aktif', 'selesai', 'nonaktif'));

-- 2. Migrate existing data based on current state:

-- Otomatis surveys → 'aktif' (sudah auto-sent via push notification)
UPDATE public.survei SET status = 'aktif' WHERE tipe_survei = 'otomatis' AND is_active = true;

-- Nonaktif (disabled by admin)
UPDATE public.survei SET status = 'nonaktif' WHERE is_active = false;

-- Manual surveys yang periode sudah lewat → 'selesai'
UPDATE public.survei SET status = 'selesai' 
WHERE tipe_survei = 'manual' AND is_active = true AND CURRENT_DATE > periode_selesai;

-- Otomatis surveys yang periode sudah lewat → 'selesai'
UPDATE public.survei SET status = 'selesai' 
WHERE tipe_survei = 'otomatis' AND is_active = true AND CURRENT_DATE > periode_selesai;

-- Manual surveys yang masih dalam periode → tetap 'terjadwal' (belum tentu sudah dikirim)
-- Biarkan default 'terjadwal' karena kita tidak tahu apakah sudah dikirim manual

-- 3. Create index for status queries
CREATE INDEX IF NOT EXISTS idx_survei_status ON public.survei(status);

-- 4. Verify
SELECT id, judul, tipe_survei, status, periode_mulai, periode_selesai, is_active 
FROM public.survei 
ORDER BY created_at DESC;
