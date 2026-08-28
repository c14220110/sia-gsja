-- ============================================================
-- Migration: Fix inventaris role_permission assignments
-- Sebelumnya gagal karena nama role salah (case & format)
-- Role names di DB: SUPER_ADMIN, BENDAHARA_PUSAT, dll.
-- ============================================================

-- Full access (semua 7 permission)
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r, public.permission p
WHERE r.nama_role IN (
  'SUPER_ADMIN','BENDAHARA_PUSAT','BENDAHARA_SATELIT',
  'SEKRETARIS_PUSAT','SEKRETARIS_SATELIT',
  'VOLUNTEER_BENDAHARA','VOLUNTEER_SEKRETARIS'
)
AND p.nama_permission IN (
  'inventaris_view','inventaris_manage','inventaris_stok_opname',
  'inventaris_mutasi','inventaris_peminjaman','inventaris_dispose','inventaris_import'
)
ON CONFLICT DO NOTHING;

-- View + stok_opname only (monitoring roles)
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r, public.permission p
WHERE r.nama_role IN ('MAJELIS','GEMBALA_SIDANG','KETUA_SATELIT','WAKIL_KETUA_SATELIT')
AND p.nama_permission IN ('inventaris_view','inventaris_stok_opname')
ON CONFLICT DO NOTHING;
