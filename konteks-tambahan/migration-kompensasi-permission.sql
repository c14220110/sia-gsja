-- Migration: Tambah permission pegawai_kompensasi_manage
-- Jalankan via Supabase SQL Editor atau psql

INSERT INTO public.permission (nama_permission, deskripsi)
VALUES ('pegawai_kompensasi_manage', 'Kelola master kompensasi/gaji individu pegawai')
ON CONFLICT (nama_permission) DO NOTHING;

-- Setelah insert, assign permission ini ke role yang relevan via UI Settings > Manage Access
-- Atau jalankan manual, contoh untuk role_id HRD:
-- INSERT INTO public.role_permission (role_id, permission_id)
-- SELECT <ROLE_ID>, id FROM public.permission WHERE nama_permission = 'pegawai_kompensasi_manage'
-- ON CONFLICT DO NOTHING;
