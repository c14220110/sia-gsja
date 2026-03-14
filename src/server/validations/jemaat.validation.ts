import { z } from 'zod';

// ── Anak sub-schema ──────────────────────────────────────────────────────────
const anakSchema = z.object({
  anak_jemaat_id:   z.string().optional().default(''),
  nama_anak:        z.string().min(1, 'Nama anak wajib diisi'),
  gereja_asal_anak: z.string().optional().default(''),
});

// ── Saudara sub-schema ───────────────────────────────────────────────────────
const saudaraSchema = z.object({
  saudara_jemaat_id:    z.string().optional().default(''),
  nama_saudara:         z.string().min(1, 'Nama saudara wajib diisi'),
  gereja_asal_saudara:  z.string().optional().default(''),
});

// ── Base jemaat fields ────────────────────────────────────────────────────────
const jemaatBaseSchema = z.object({
  nama_lengkap:       z.string().min(1, 'Nama lengkap wajib diisi'),
  jenis_kelamin:      z.enum(['Laki-laki', 'Perempuan']).optional().nullable(),
  nik:                z.string().optional().nullable(),
  tempat_lahir:       z.string().optional().nullable(),
  tanggal_lahir:      z.string().optional().nullable(),
  alamat:             z.string().optional().nullable(),
  kota:               z.string().optional().nullable(),
  kecamatan:          z.string().optional().nullable(),
  kelurahan:          z.string().optional().nullable(),
  kode_pos:           z.string().optional().nullable(),
  no_hp:              z.string().optional().nullable(),
  email:              z.string().email('Format email tidak valid').optional().nullable().or(z.literal('')),
  pekerjaan:          z.string().optional().nullable(),
  satelit_id:         z.union([z.string(), z.number()]).refine(v => v !== '' && v !== null, { message: 'Satelit wajib dipilih' }),
  komisi_ids:         z.array(z.string()).optional().default([]),
  status_baptis:      z.enum(['Sudah', 'Belum']).optional().default('Belum'),
  tanggal_baptis:     z.string().optional().nullable(),
  status_pernikahan:  z.enum(['Lajang', 'Menikah', 'Duda', 'Janda']).optional().nullable(),
  status_jemaat:      z.enum(['Aktif', 'Tidak Aktif', 'Keluar']).optional().default('Aktif'),
  foto_url:           z.string().optional().nullable(),
  // Family relations
  ayah_id:            z.string().optional().nullable(),
  ayah_nama:          z.string().optional().nullable(),
  gereja_asal_ayah:   z.string().optional().nullable(),
  ibu_id:             z.string().optional().nullable(),
  ibu_nama:           z.string().optional().nullable(),
  gereja_asal_ibu:    z.string().optional().nullable(),
  pasangan_id:        z.string().optional().nullable(),
  pasangan_nama:      z.string().optional().nullable(),
  gereja_asal_pasangan: z.string().optional().nullable(),
  anak:               z.array(anakSchema).optional().default([]),
  saudara:            z.array(saudaraSchema).optional().default([]),
});

export const createJemaatSchema = jemaatBaseSchema;
export const updateJemaatSchema = jemaatBaseSchema.partial().extend({
  nama_lengkap: z.string().min(1, 'Nama lengkap wajib diisi'),
});

export type CreateJemaatInput = z.infer<typeof createJemaatSchema>;
export type UpdateJemaatInput = z.infer<typeof updateJemaatSchema>;
