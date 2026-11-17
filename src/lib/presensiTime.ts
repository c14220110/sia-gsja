export function getTodayWibDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getWibHourMinute(date: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { hour, minute };
}

export function evaluateCheckInStatus(date: Date = new Date()): 'TEPAT_WAKTU' | 'TERLAMBAT' {
  const { hour, minute } = getWibHourMinute(date);
  const totalMinutes = hour * 60 + minute;
  // Jam kerja standar mulai 08:00, toleransi hingga 08:15 WIB
  return totalMinutes > 8 * 60 + 15 ? 'TERLAMBAT' : 'TEPAT_WAKTU';
}

export function formatWorkedMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '0j 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}
