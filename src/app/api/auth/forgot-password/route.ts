import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/mailer';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ message: 'Email wajib diisi' }, { status: 400 });
    }

    // ALWAYS respond with the same generic message regardless of whether email exists
    // This prevents user enumeration attacks
    const genericResponse = NextResponse.json({
      message: 'Jika email terdaftar dalam sistem, link reset password telah dikirim. Cek inbox dan folder spam Anda.',
    });

    const client = await pool.connect();
    try {
      // Find user by email
      const userResult = await client.query(
        `SELECT u.id, u.email, j.nama_lengkap
         FROM public.pengguna u
         LEFT JOIN public.jemaat j ON u.jemaat_id = j.id
         WHERE u.email = $1 AND u.is_active = true
         LIMIT 1`,
        [email.toLowerCase().trim()]
      );

      if (userResult.rows.length === 0) {
        // Email not found — return generic response (do not reveal this)
        return genericResponse;
      }

      const user = userResult.rows[0];

      // Generate a secure random token (32 bytes = 64 hex chars)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      // Delete any existing tokens for this user (single active token policy)
      await client.query(
        `DELETE FROM public.password_reset_tokens WHERE user_id = $1`,
        [user.id]
      );

      // Store new token
      await client.query(
        `INSERT INTO public.password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, token, expiresAt]
      );

      // Build reset link
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetLink = `${appUrl}/reset-password?token=${token}`;

      // Send email
      const toName = user.nama_lengkap || 'Pengguna';
      await sendPasswordResetEmail(user.email, toName, resetLink);

      return genericResponse;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    );
  }
}
