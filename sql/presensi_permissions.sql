-- ============================================================================
-- SIM GSJA: Permissions Monitoring Presensi & Role HRD
-- Jalankan di Supabase SQL Editor (Staging terlebih dahulu, lalu Production)
-- ============================================================================

-- 1. Seed permissions baru untuk Monitoring Presensi
SELECT setval(
  pg_get_serial_sequence('public.permission', 'id'),
  COALESCE((SELECT MAX(id) FROM public.permission), 1),
  true
);

INSERT INTO public.permission (nama_permission, deskripsi)
SELECT 'presensi_monitoring_view', 'Lihat monitoring presensi, detail visit & chatter pegawai'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission WHERE nama_permission = 'presensi_monitoring_view'
);

INSERT INTO public.permission (nama_permission, deskripsi)
SELECT 'presensi_monitoring_manage', 'Koreksi presensi, hapus, reset Face ID, atur GPS satelit & chatter'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission WHERE nama_permission = 'presensi_monitoring_manage'
);

-- 2. Buat role HRD
SELECT setval(
  pg_get_serial_sequence('public.role', 'id'),
  COALESCE((SELECT MAX(id) FROM public.role), 1),
  true
);

INSERT INTO public.role (nama_role, deskripsi, is_active)
SELECT 'HRD', 'Manajemen data pegawai, approval, kompensasi, penggajian & monitoring presensi', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.role WHERE UPPER(nama_role) = 'HRD'
);

-- 3. Hubungkan role HRD ke seluruh permission pegawai, penggajian, multi_satelit & monitoring presensi
INSERT INTO public.role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM public.role r
JOIN public.permission p ON p.nama_permission IN (
  'pegawai_view',
  'pegawai_create',
  'pegawai_edit',
  'pegawai_approval',
  'pegawai_kompensasi_manage',
  'penggajian_manage',
  'presensi_monitoring_view',
  'presensi_monitoring_manage',
  'multi_satelit_view'
)
WHERE UPPER(r.nama_role) = 'HRD'
ON CONFLICT DO NOTHING;
