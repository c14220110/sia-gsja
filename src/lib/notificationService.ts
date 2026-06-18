/**
 * Notification Service — SIM GSJA Eben Haezer
 *
 * Abstraction layer untuk notifikasi.
 * Saat ini: SMTP (Gmail) via nodemailer.
 * Masa depan: set NOTIFICATION_CHANNEL=whatsapp → otomatis pakai WA Business API.
 *
 * Kode bisnis TIDAK perlu tahu medium yang dipakai.
 * Fire-and-forget: panggil tanpa await, tambahkan .catch() untuk error handling.
 */

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── HTML Email Builder ──────────────────────────────────────────────────────

const emailShell = (body: string) => `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#2d3a4f;padding:28px 40px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">✝️</div>
              <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">SIM GSJA Eben Haezer</h1>
              <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;">Sistem Informasi Manajemen</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.6;">
                Email ini dikirim otomatis oleh sistem SIM GSJA Eben Haezer.<br/>
                Mohon tidak membalas email ini.
              </p>
              <p style="color:#cbd5e1;font-size:11px;margin:8px 0 0;">
                © 2026 GSJA Eben Haezer — Internal Use Only
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const badge = (color: string, text: string) =>
  `<span style="background:${color};color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">${text}</span>`;

const infoBox = (bg: string, border: string, text: string) =>
  `<table cellpadding="0" cellspacing="0" width="100%" style="background:${bg};border:1px solid ${border};border-radius:8px;margin:16px 0;">
    <tr><td style="padding:14px 18px;font-size:13px;color:#475569;line-height:1.6;">${text}</td></tr>
  </table>`;

const ctaButton = (href: string, label: string, color = '#2d3a4f') =>
  `<table cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:8px 0 24px;">
        <a href="${href}" style="background:${color};color:#fff;text-decoration:none;padding:13px 36px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;

// ─── Email Senders ───────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

// ─── Placeholder untuk WhatsApp (masa depan) ─────────────────────────────────
// async function jalaninWhatsApp(to: string, template: string, data: object) {
//   // Implementasi dengan WhatsApp Business API / Fonnte / Wablas
// }

// ─── Public API — 4 Trigger Event ───────────────────────────────────────────

export interface RaNotifData {
  kode_dokumen: string;
  nama_rancangan: string;
  nama_satelit?: string;
  nama_komisi?: string | null;
  catatan_reviewer?: string | null;
  total_pengajuan?: number;
  total_disetujui?: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * TRIGGER #1 & #4 — Kirim notif ke Majelis saat RA disubmit (baru atau revisi)
 * @param majelisEmails  Array email semua reviewer aktif
 * @param ra             Data RA
 * @param isResubmit     true jika ini submit ulang setelah revisi
 */
export async function notifyMajelisRaSubmitted(
  majelisEmails: string[],
  ra: RaNotifData,
  isResubmit = false
): Promise<void> {
  const subject = isResubmit
    ? `📋 RA Direvisi & Siap Direview — ${ra.kode_dokumen}`
    : `📋 RA Baru Menunggu Review — ${ra.kode_dokumen}`;

  const statusBadge = isResubmit
    ? badge('#d97706', '♻ Revisi Ulang')
    : badge('#2563eb', '⏳ Menunggu Review');

  const html = emailShell(`
    <div style="margin-bottom:16px;">${statusBadge}</div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">
      ${isResubmit ? 'Rancangan Anggaran Direvisi' : 'Rancangan Anggaran Baru'}
    </h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
      ${isResubmit
        ? 'Pengaju telah menyelesaikan revisi dan mengajukan kembali untuk direview.'
        : 'Terdapat Rancangan Anggaran baru yang menunggu keputusan review Anda.'}
    </p>
    ${infoBox('#f8fafc', '#e2e8f0', `
      <strong>Kode RA:</strong> ${ra.kode_dokumen}<br/>
      <strong>Nama:</strong> ${ra.nama_rancangan}<br/>
      <strong>Satelit:</strong> ${ra.nama_satelit || '-'}<br/>
      <strong>Unit/Komisi:</strong> ${ra.nama_komisi || 'Umum Satelit'}<br/>
      ${ra.total_pengajuan != null ? `<strong>Total Pengajuan:</strong> ${fmt(ra.total_pengajuan)}` : ''}
    `)}
    ${ctaButton(`${baseUrl}/anggaran/rancangan/review/${ra.kode_dokumen}`, '🔍 Review Sekarang', '#2d3a4f')}
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      Anda menerima email ini karena memiliki akses Majelis/Reviewer di SIM GSJA.
    </p>
  `);

  for (const email of majelisEmails) {
    await sendEmail(email, subject, html).catch(err =>
      console.error(`[Notification] Failed to notify majelis ${email}:`, err)
    );
  }
}

/**
 * TRIGGER #2 — Notif ke Pengaju saat RA disetujui (penuh/sebagian)
 */
export async function notifyPengajuRaApproved(
  pengajuEmail: string,
  pengajuName: string,
  ra: RaNotifData,
  isPartial: boolean
): Promise<void> {
  const subject = isPartial
    ? `✅ RA Disetujui Sebagian — ${ra.kode_dokumen}`
    : `✅ RA Disetujui Penuh — ${ra.kode_dokumen}`;

  const statusBadge = isPartial
    ? badge('#2563eb', '✅ Disetujui Sebagian')
    : badge('#059669', '✅ Disetujui Penuh');

  const html = emailShell(`
    <div style="margin-bottom:16px;">${statusBadge}</div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">
      Rancangan Anggaran ${isPartial ? 'Disetujui Sebagian' : 'Disetujui Penuh'}
    </h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Halo <strong>${pengajuName}</strong>, Rancangan Anggaran Anda telah disetujui oleh Majelis.
      ${isPartial ? 'Beberapa item mungkin dipotong nominalnya atau ditolak — silakan cek detail.' : 'Plafon anggaran Anda kini aktif.'}
    </p>
    ${infoBox('#f0fdf4', '#86efac', `
      <strong>Kode RA:</strong> ${ra.kode_dokumen}<br/>
      <strong>Nama:</strong> ${ra.nama_rancangan}<br/>
      ${ra.total_pengajuan != null ? `<strong>Pengajuan Awal:</strong> ${fmt(ra.total_pengajuan)}<br/>` : ''}
      ${ra.total_disetujui != null ? `<strong>Total Disetujui:</strong> ${fmt(ra.total_disetujui)}` : ''}
    `)}
    ${ra.catatan_reviewer ? infoBox('#fffbeb', '#fde68a', `<strong>Catatan Reviewer:</strong><br/>${ra.catatan_reviewer}`) : ''}
    ${ctaButton(`${baseUrl}/anggaran/rancangan`, '📄 Lihat Rancangan Anggaran', '#059669')}
  `);

  await sendEmail(pengajuEmail, subject, html);
}

/**
 * TRIGGER #2b — Notif ke Pengaju saat RA ditolak
 */
export async function notifyPengajuRaRejected(
  pengajuEmail: string,
  pengajuName: string,
  ra: RaNotifData
): Promise<void> {
  const html = emailShell(`
    <div style="margin-bottom:16px;">${badge('#dc2626', '❌ Ditolak')}</div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Rancangan Anggaran Ditolak</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Halo <strong>${pengajuName}</strong>, Rancangan Anggaran Anda ditolak oleh Majelis.
      Penolakan ini bersifat final. Jika masih diperlukan, silakan ajukan RA baru.
    </p>
    ${infoBox('#fef2f2', '#fca5a5', `
      <strong>Kode RA:</strong> ${ra.kode_dokumen}<br/>
      <strong>Nama:</strong> ${ra.nama_rancangan}
    `)}
    ${ra.catatan_reviewer ? infoBox('#fffbeb', '#fde68a', `<strong>Alasan Penolakan:</strong><br/>${ra.catatan_reviewer}`) : ''}
    ${ctaButton(`${baseUrl}/anggaran/rancangan`, '📄 Kembali ke Daftar RA')}
  `);

  await sendEmail(pengajuEmail, `❌ RA Ditolak — ${ra.kode_dokumen}`, html);
}

/**
 * TRIGGER #3 — Notif ke Pengaju saat RA diminta revisi
 */
export async function notifyPengajuRaRevision(
  pengajuEmail: string,
  pengajuName: string,
  ra: RaNotifData,
  raId: string
): Promise<void> {
  const html = emailShell(`
    <div style="margin-bottom:16px;">${badge('#d97706', '🔄 Perlu Revisi')}</div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Rancangan Anggaran Perlu Direvisi</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Halo <strong>${pengajuName}</strong>, Majelis meminta Anda merevisi Rancangan Anggaran berikut.
      Setelah selesai diperbaiki, silakan submit ulang.
    </p>
    ${infoBox('#fffbeb', '#fde68a', `
      <strong>Kode RA:</strong> ${ra.kode_dokumen}<br/>
      <strong>Nama:</strong> ${ra.nama_rancangan}
    `)}
    ${ra.catatan_reviewer ? infoBox('#f0f9ff', '#93c5fd', `<strong>Catatan dari Majelis:</strong><br/>${ra.catatan_reviewer}`) : ''}
    ${ctaButton(`${baseUrl}/anggaran/rancangan/edit/${raId}`, '✏️ Revisi Sekarang', '#d97706')}
  `);

  await sendEmail(pengajuEmail, `🔄 RA Perlu Direvisi — ${ra.kode_dokumen}`, html);
}

// ─── PASTORAL NOTIFICATIONS ──────────────────────────────────────────────────

export interface PastoralTicketData {
  id: number;
  nomor_tiket: string;
  jenis_layanan: string;
  target_pelayanan: string;
  nama_pemohon: string;
  no_hp_kontak: string;
  keterangan?: string;
  is_urgent: boolean;
  waktu_diterima: string;
}

/**
 * TRIGGER PASTORAL #1 — Blast email ke semua Sekretaris Pusat saat tiket baru masuk
 * Dipanggil dari: POST /api/layanan-pastoral
 */
export async function notifySekretarisPastoralBaru(
  sekretarisEmails: string[],
  ticket: PastoralTicketData
): Promise<void> {
  if (sekretarisEmails.length === 0) return;

  const urgentBadge = ticket.is_urgent
    ? `<div style="margin-bottom:12px;">${badge('#dc2626', '🚨 DARURAT / URGENT')}</div>`
    : `<div style="margin-bottom:12px;">${badge('#2563eb', '🔔 Permintaan Baru')}</div>`;

  const subject = ticket.is_urgent
    ? `🚨 [URGENT] Permintaan Pastoral Baru — ${ticket.nomor_tiket}`
    : `🔔 Permintaan Pastoral Baru — ${ticket.nomor_tiket}`;

  const html = emailShell(`
    ${urgentBadge}
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">
      Permintaan Layanan Pastoral Baru
    </h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Terdapat permintaan layanan pastoral baru yang menunggu review dan penugasan Anda.
      ${ticket.is_urgent ? '<br/><strong style="color:#dc2626;">⚠ Permintaan ini ditandai DARURAT dan membutuhkan penanganan segera!</strong>' : ''}
    </p>
    ${infoBox('#f8fafc', '#e2e8f0', `
      <strong>No. Tiket:</strong> ${ticket.nomor_tiket}<br/>
      <strong>Jenis Layanan:</strong> ${ticket.jenis_layanan}<br/>
      <strong>Yang Dilayani:</strong> ${ticket.target_pelayanan}<br/>
      <strong>Pemohon:</strong> ${ticket.nama_pemohon}<br/>
      <strong>No. HP Kontak:</strong> ${ticket.no_hp_kontak}<br/>
      ${ticket.keterangan ? `<strong>Keterangan:</strong> ${ticket.keterangan}<br/>` : ''}
      <strong>Waktu Masuk:</strong> ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ticket.waktu_diterima + (ticket.waktu_diterima.includes('Z') || ticket.waktu_diterima.includes('+') ? '' : 'Z')))} WIB
    `)}
    ${ctaButton(`${baseUrl}/kegiatan/pastoral/${ticket.id}`, '📋 Review & Tugaskan Sekarang', ticket.is_urgent ? '#dc2626' : '#2d3a4f')}
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      Anda menerima email ini karena memiliki jabatan Sekretaris di SIM GSJA.
    </p>
  `);

  for (const email of sekretarisEmails) {
    await sendEmail(email, subject, html).catch(err =>
      console.error(`[Pastoral Notif] Gagal kirim ke sekretaris ${email}:`, err)
    );
  }
}

/**
 * TRIGGER PASTORAL #2 — Email ke Majelis/Gembala yang baru ditugaskan
 * Dipanggil dari: PATCH /api/kegiatan/pastoral/[id]/assign
 */
export async function notifyMajelisPastoralDitugaskan(
  majelisEmail: string,
  majelisName: string,
  ticket: PastoralTicketData & { tanggal_fix: string; waktu_fix: string }
): Promise<void> {
  if (!majelisEmail) return;

  const noHpBersih = ticket.no_hp_kontak.replace(/\D/g, '').replace(/^0/, '62');
  const waLink = `https://wa.me/${noHpBersih}?text=${encodeURIComponent(`Halo, saya ${majelisName} dari GSJA Eben Haezer. Saya akan membantu Anda terkait permintaan layanan pastoral (${ticket.nomor_tiket}). Apakah Anda masih bisa dihubungi?`)}`;

  const tanggalFormatted = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(ticket.tanggal_fix));
  const jamFormatted = ticket.waktu_fix.substring(0, 5) + ' WIB';

  const html = emailShell(`
    <div style="margin-bottom:12px;">${badge('#059669', '📋 Tugas Pelayanan Baru')}</div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">
      Anda Ditugaskan untuk Layanan Pastoral
    </h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Halo <strong>${majelisName}</strong>, Sekretaris telah menugaskan Anda untuk menangani permintaan layanan pastoral berikut.
      ${ticket.is_urgent ? '<br/><strong style="color:#dc2626;">⚠ Permintaan ini bersifat DARURAT — mohon segera hubungi pemohon.</strong>' : ''}
    </p>
    ${infoBox('#f8fafc', '#e2e8f0', `
      <strong>No. Tiket:</strong> ${ticket.nomor_tiket}<br/>
      <strong>Jenis Layanan:</strong> ${ticket.jenis_layanan}<br/>
      <strong>Yang Dilayani:</strong> ${ticket.target_pelayanan}<br/>
      <strong>Pemohon:</strong> ${ticket.nama_pemohon}<br/>
      <strong>Jadwal Fix:</strong> ${tanggalFormatted} • ${jamFormatted}<br/>
      ${ticket.keterangan ? `<strong>Keterangan:</strong> ${ticket.keterangan}` : ''}
    `)}
    ${infoBox('#f0fdf4', '#86efac', `
      <strong>📱 No. HP yang Dapat Dihubungi:</strong> <span style="font-size:16px;font-weight:700;">${ticket.no_hp_kontak}</span>
    `)}
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:8px 4px 0;">
          <a href="${waLink}" style="background:#25D366;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
            💬 Hubungi via WhatsApp
          </a>
        </td>
        <td align="center" style="padding:8px 4px 0;">
          ${ctaButton(`${baseUrl}/kegiatan/pastoral/${ticket.id}`, '📋 Lihat Detail Tiket', '#2d3a4f').replace('<table cellpadding="0" cellspacing="0" width="100%">', '').replace('</table>', '').replace('<tr><td align="center" style="padding:8px 0 24px;">', '').replace('</td></tr>', '')}
        </td>
      </tr>
    </table>
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      Setelah pelayanan selesai, mohon input catatan penyelesaian di sistem.
    </p>
  `);

  await sendEmail(majelisEmail, `📋 Tugas Pastoral: ${ticket.jenis_layanan} — ${ticket.nomor_tiket}`, html)
    .catch(err => console.error(`[Pastoral Notif] Gagal kirim ke majelis ${majelisEmail}:`, err));
}

// ─── CSAT / SURVEI NOTIFICATIONS ─────────────────────────────────────────────

export interface CsatKeluhanData {
  survei_judul: string;
  nama_kegiatan: string;
  skor: number;
  threshold: number;
  jawaban_teks?: string | null;
  nama_jemaat: string; // 'Anonim' jika survei anonim
  survei_id: number;
}

/**
 * TRIGGER CSAT #1 — Blast email ke semua SEKRETARIS_PUSAT saat jemaat memberi skor di bawah threshold
 * Dipanggil dari: POST /api/survei/saya/submit (fire-and-forget, tanpa await)
 */
export async function notifySekretarisCsatFlagged(
  sekretarisEmails: string[],
  data: CsatKeluhanData
): Promise<void> {
  if (sekretarisEmails.length === 0) return;

  const subject = `⚠️ Keluhan Survei Baru — ${data.nama_kegiatan}`;

  const bintang = '⭐'.repeat(Math.round(data.skor)) + '☆'.repeat(5 - Math.round(data.skor));

  const html = emailShell(`
    <div style="margin-bottom:12px;">${badge('#dc2626', '⚠️ Keluhan Survei Baru')}</div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">
      Respons Survei Di Bawah Ambang Batas
    </h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Terdapat respons survei dengan skor di bawah ambang batas <strong>${data.threshold}</strong> yang memerlukan tindak lanjut dari Sekretaris.
    </p>
    ${infoBox('#fef2f2', '#fca5a5', `
      <strong>Kegiatan:</strong> ${data.nama_kegiatan}<br/>
      <strong>Survei:</strong> ${data.survei_judul}<br/>
      <strong>Skor Diberikan:</strong> ${bintang} (${data.skor} dari 5)<br/>
      <strong>Responden:</strong> ${data.nama_jemaat}<br/>
      ${data.jawaban_teks ? `<strong>Komentar:</strong> <em>"${data.jawaban_teks}"</em>` : ''}
    `)}
    ${infoBox('#fffbeb', '#fde68a', `
      <strong>📌 Tindakan yang Diperlukan:</strong><br/>
      Hubungi responden (jika tidak anonim) atau evaluasi masalah bersama panitia, lalu catat penyelesaiannya di sistem untuk memenuhi KPI-7.
    `)}
    ${ctaButton(`${baseUrl}/kegiatan/survei/${data.survei_id}`, '📋 Lihat & Tindaklanjuti Keluhan', '#dc2626')}
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      Anda menerima email ini karena memiliki jabatan Sekretaris di SIM GSJA.
    </p>
  `);

  for (const email of sekretarisEmails) {
    await sendEmail(email, subject, html).catch(err =>
      console.error(`[CSAT Notif] Gagal kirim ke sekretaris ${email}:`, err)
    );
  }
}

