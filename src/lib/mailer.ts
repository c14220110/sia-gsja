import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // TLS via STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(toEmail: string, toName: string, resetLink: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: toEmail,
    subject: '🔒 Reset Password - SIM GSJA Eben Haezer',
    html: `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Reset Password</title>
      </head>
      <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background:#2d3a4f;padding:32px 40px;text-align:center;">
                    <div style="font-size: 40px; margin-bottom: 12px;">✝️</div>
                    <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:0.5px;">SIM GSJA Eben Haezer</h1>
                    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Sistem Informasi Akuntansi</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Reset Password Akun Anda</h2>
                    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
                      Halo <strong>${toName}</strong>,
                    </p>
                    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
                      Kami menerima permintaan untuk mereset password akun SIM GSJA Anda. 
                      Klik tombol di bawah ini untuk membuat password baru:
                    </p>
                    <!-- CTA Button -->
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:8px 0 32px;">
                          <a href="${resetLink}" 
                             style="background:#2d3a4f;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;letter-spacing:0.3px;">
                            🔑 Reset Password Saya
                          </a>
                        </td>
                      </tr>
                    </table>
                    <!-- Warning box -->
                    <table cellpadding="0" cellspacing="0" width="100%" style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;margin-bottom:24px;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <p style="color:#854d0e;font-size:13px;margin:0;line-height:1.6;">
                            ⚠️ <strong>Link ini hanya berlaku 30 menit</strong> dan hanya bisa digunakan sekali. 
                            Jika Anda tidak meminta reset password, abaikan email ini — akun Anda tetap aman.
                          </p>
                        </td>
                      </tr>
                    </table>
                    <!-- Fallback link -->
                    <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0;">
                      Jika tombol di atas tidak berfungsi, copy dan paste link berikut ke browser Anda:<br/>
                      <a href="${resetLink}" style="color:#3b82f6;word-break:break-all;">${resetLink}</a>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
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
      </html>
    `,
  });
}
