/**
 * Shared helpers & validation for Pegawai registration and detail/edit forms.
 */

export const DIGIT_16_FIELDS = new Set(['nik', 'no_kk', 'no_npwp']);

export const SHIFT_SATPAM_OPTIONS = [
  'Shift 1 (07:00 - 15:00)',
  'Shift 2 (15:00 - 23:00)',
  'Shift 3 (23:00 - 07:00)',
] as const;

/** Keep digits only and cap at maxLength (used for 16-digit NIK, KK, and NPWP). */
export function sanitizeNumericField(value: string, maxLength = 16): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/** Determine whether the selected jabatan is Satpam / Security. */
export function isSatpamJabatan(
  jabatanId: string | number | null | undefined,
  jabatanOptions: Array<{ id: number | string; nama_jabatan: string }>
): boolean {
  if (!jabatanId) return false;
  const found = jabatanOptions.find((j) => String(j.id) === String(jabatanId));
  if (!found) return false;
  const lower = found.nama_jabatan.toLowerCase();
  return lower.includes('satpam') || lower.includes('security');
}

/** Validate 16-digit numeric strings on server or client. */
export function isValid16Digits(value: string | null | undefined): boolean {
  return /^\d{16}$/.test(String(value || '').trim());
}

/** Validate a single tab (1-4) on /pegawai/new and /pegawai/[id]. */
export function validatePegawaiTab(
  activeTab: number,
  formData: Record<string, any>,
  jabatanOptions: Array<{ id: number | string; nama_jabatan: string }>
): string | null {
  if (activeTab === 1) {
    if (!String(formData.nama_lengkap || '').trim()) return 'Nama Lengkap wajib diisi.';
    if (!isValid16Digits(formData.nik)) return 'NIK wajib diisi tepat 16 digit angka.';
    if (String(formData.no_kk || '').trim() && !isValid16Digits(formData.no_kk)) {
      return 'Nomor Kartu Keluarga (KK) harus tepat 16 digit angka.';
    }
    if (!formData.tanggal_lahir) return 'Tanggal Lahir wajib diisi.';
    if (!String(formData.no_hp || '').trim()) return 'Nomor HP/WA Aktif wajib diisi.';
    if (!formData.satelit_id) return 'Satelit Penugasan wajib diisi.';
    if (!formData.departemen_id) return 'Departemen wajib dipilih.';
    if (!formData.jabatan_pegawai_id) return 'Jabatan Pegawai wajib dipilih.';
    if (isSatpamJabatan(formData.jabatan_pegawai_id, jabatanOptions) && !formData.shift_kerja) {
      return 'Shift Kerja wajib dipilih untuk jabatan Satpam / Security.';
    }
  }
  if (activeTab === 2) {
    if (!String(formData.alamat_lengkap || '').trim()) return 'Alamat domisili wajib diisi.';
    if (!String(formData.kota || '').trim()) return 'Kota wajib diisi.';
    if (!String(formData.kontak_darurat_nama || '').trim()) return 'Nama Kontak Darurat wajib diisi.';
    if (!String(formData.kontak_darurat_nohp || '').trim()) return 'Nomor HP Kontak Darurat wajib diisi.';
    if (!String(formData.kontak_darurat_relasi || '').trim()) return 'Hubungan Relasi Kontak Darurat wajib diisi.';
  }
  if (activeTab === 3) {
    const npwp = String(formData.no_npwp || '').trim();
    if (formData.is_kena_pph21 && !npwp) {
      return 'Karena terpotong PPh21, Nomor NPWP (16 digit sesuai NIK tanpa tanda baca) wajib diisi. Hilangkan centang jika pegawai ini tidak menanggung PPh21.';
    }
    if (npwp && !isValid16Digits(npwp)) {
      return 'Nomor NPWP harus tepat 16 digit angka sesuai NIK tanpa tanda baca.';
    }
    if (!formData.status_ptkp) return 'Status PTKP wajib dipilih.';
  }
  if (activeTab === 4) {
    if (!formData.bank_id) return 'Bank penerima gaji wajib dipilih.';
    if (!String(formData.no_rekening || '').trim()) return 'Nomor Rekening wajib diisi.';
    if (!String(formData.atas_nama_rekening || '').trim()) return 'Pemilik Rekening wajib diisi.';
  }
  return null;
}
