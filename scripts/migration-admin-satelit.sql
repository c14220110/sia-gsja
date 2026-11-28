-- Migration: Role ADMIN_SATELIT & Permission akun_satelit_manage
-- Aman dijalankan berulang kali (idempotent) di Supabase SQL Editor (Production maupun Staging).

BEGIN;

-- 1. Tambah permission khusus manajemen akun tingkat satelit
INSERT INTO public.permission (nama_permission, deskripsi)
VALUES (
  'akun_satelit_manage',
  'Mengelola akun pengguna dan generate akun massal khusus satelitnya sendiri'
)
ON CONFLICT (nama_permission) DO NOTHING;

-- 2. Tambah role ADMIN_SATELIT
INSERT INTO public.role (nama_role, deskripsi, is_active)
VALUES (
  'ADMIN_SATELIT',
  'Admin satelit untuk pengelolaan data jemaat, pelayan, pengurus, serta manajemen akun pengguna khusus satelitnya sendiri',
  true
)
ON CONFLICT (nama_role) DO NOTHING;

-- 3. Assign permission ke role ADMIN_SATELIT (tanpa multi_satelit_view dan tanpa akses matrix role global)
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r
JOIN public.permission p ON p.nama_permission IN (
  'akun_satelit_manage',
  'jemaat_view',
  'jemaat_create',
  'jemaat_edit',
  'jemaat_delete',
  'jemaat_analisis_view',
  'pelayan_view',
  'pelayan_manage',
  'pengurus_view',
  'pengurus_manage'
)
WHERE r.nama_role = 'ADMIN_SATELIT'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Pastikan SUPER_ADMIN juga tercatat memiliki akun_satelit_manage di matrix
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r
JOIN public.permission p ON p.nama_permission = 'akun_satelit_manage'
WHERE r.nama_role = 'SUPER_ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
