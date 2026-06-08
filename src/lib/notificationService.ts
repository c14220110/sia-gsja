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
              <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;">Sistem Informasi Akuntansi</p>
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
// async function sendWhatsApp(to: string, template: string, data: object) {
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
