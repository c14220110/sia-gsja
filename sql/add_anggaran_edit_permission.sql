-- Tambah permission terpisah untuk Edit Rancangan Anggaran
SELECT setval(
  pg_get_serial_sequence('public.permission', 'id'),
  COALESCE((SELECT MAX(id) FROM public.permission), 1),
  true
);

INSERT INTO public.permission (nama_permission, deskripsi)
SELECT 'anggaran_edit', 'Edit rancangan anggaran yang sudah dibuat'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission WHERE nama_permission = 'anggaran_edit'
);
