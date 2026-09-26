import bcrypt from 'bcryptjs';

/**
 * Memeriksa password dengan dukungan toleransi tanggal lahir.
 * 1. Pertama cek password persis apa adanya (cepat untuk password normal).
 * 2. Jika tidak cocok, coba variasi format tanggal lahir:
 *    - 20112003 (DDMMYYYY) -> 20/11/2003
 *    - 20-11-2003 / 20.11.2003 / 20 11 2003 -> 20/11/2003
 *    - 2003-11-20 (YYYY-MM-DD) -> 20/11/2003
 *    - 20031120 (YYYYMMDD) -> 20/11/2003
 */
export async function comparePasswordWithDobTolerance(
  inputPassword: string,
  passwordHash: string
): Promise<boolean> {
  // 1. Cek langsung persis apa adanya (mencakup password normal teks biasa)
  if (await bcrypt.compare(inputPassword, passwordHash)) {
    return true;
  }

  // 2. Kumpulkan kandidat format tanggal lahir jika input mengandung angka / pemisah tanggal
  const trimmed = inputPassword.trim();
  const candidates: string[] = [];

  // Kasus pemisah: 20-11-2003, 20.11.2003, 20 11 2003
  if (/^[\d]{1,4}[-./\s][\d]{1,2}[-./\s][\d]{1,4}$/.test(trimmed)) {
    const parts = trimmed.split(/[-./\s]+/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // Format YYYY-MM-DD
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        candidates.push(`${day}/${month}/${year}`);
      } else {
        // Format DD-MM-YYYY
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        candidates.push(`${day}/${month}/${year}`);
      }
    }
  }

  // Kasus 8 digit murni: 20112003 atau 20031120
  if (/^\d{8}$/.test(trimmed)) {
    const first4 = parseInt(trimmed.slice(0, 4), 10);
    if (first4 >= 1900 && first4 <= 2100) {
      // Kemungkinan YYYYMMDD: 20031120
      const year = trimmed.slice(0, 4);
      const month = trimmed.slice(4, 6);
      const day = trimmed.slice(6, 8);
      candidates.push(`${day}/${month}/${year}`);
    }
    // Format standar Indonesia DDMMYYYY: 20112003
    const day = trimmed.slice(0, 2);
    const month = trimmed.slice(2, 4);
    const year = trimmed.slice(4, 8);
    candidates.push(`${day}/${month}/${year}`);
  }

  // Cek setiap kandidat unik yang belum diuji
  for (const candidate of candidates) {
    if (candidate !== inputPassword) {
      try {
        if (await bcrypt.compare(candidate, passwordHash)) {
          return true;
        }
      } catch {
        // abaikan error format bcrypt
      }
    }
  }

  return false;
}
