import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, new_password } = await request.json();

    if (!token || !new_password) {
      return NextResponse.json({ message: 'Token dan password baru wajib diisi' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return NextResponse.json({ message: 'Password minimal 6 karakter' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Find valid (non-expired, unused) token
      const tokenResult = await client.query(
        `SELECT prt.user_id, prt.expires_at, u.email
         FROM public.password_reset_tokens prt
         JOIN public.pengguna u ON u.id = prt.user_id
         WHERE prt.token = $1
           AND prt.expires_at > NOW()
         LIMIT 1`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        return NextResponse.json(
          { message: 'Link reset password tidak valid atau sudah kadaluarsa. Silakan minta link baru.' },
          { status: 400 }
        );
      }

      const { user_id } = tokenResult.rows[0];

      // Hash new password
      const hashedPassword = await bcrypt.hash(new_password, 12);

      // Update password and clear force_change flag if any
      await client.query(
        `UPDATE public.pengguna
         SET password_hash = $1,
             requires_password_change = false,
             updated_at = NOW()
         WHERE id = $2`,
        [hashedPassword, user_id]
      );

      // Delete token (single-use policy)
      await client.query(
        `DELETE FROM public.password_reset_tokens WHERE user_id = $1`,
        [user_id]
      );

      return NextResponse.json({ message: 'Password berhasil diubah. Silakan login dengan password baru Anda.' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ message: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

// GET - verify token validity (called when user opens the reset page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, message: 'Token tidak ditemukan' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT user_id FROM public.password_reset_tokens
       WHERE token = $1 AND expires_at > NOW()
       LIMIT 1`,
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ valid: false, message: 'Link sudah tidak valid atau kadaluarsa' });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Verify reset token error:', error);
    return NextResponse.json({ valid: false, message: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
