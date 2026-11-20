/**
 * Shared formatting helpers for Rancangan Anggaran (RA) date ranges and optional COA labels.
 */

export function toDateInputValue(val?: string | Date | null): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fmtIdDate(val: string): string {
  const iso = toDateInputValue(val);
  if (!iso) return val;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTanggalPelaksanaan(
  tanggalMulai?: string | null,
  tanggalSelesai?: string | null,
  estimasiWaktu?: string | null
): string {
  const start = toDateInputValue(tanggalMulai);
  const end = toDateInputValue(tanggalSelesai);
  if (start && end) {
    return start === end ? fmtIdDate(start) : `${fmtIdDate(start)} – ${fmtIdDate(end)}`;
  }
  if (start) return fmtIdDate(start);
  if (end) return `s/d ${fmtIdDate(end)}`;
  return estimasiWaktu?.trim() || '-';
}

export function formatAkunRa(item: {
  akun_catatan?: string | null;
  kode_akun?: string | null;
  nama_akun?: string | null;
}): string {
  if (item.akun_catatan?.trim()) return item.akun_catatan.trim();
  if (item.kode_akun || item.nama_akun) {
    return [item.kode_akun, item.nama_akun].filter(Boolean).join(' — ');
  }
  return '-';
}
