import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/server/repositories/user.repository';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

const userRepository = new UserRepository();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, old_password, new_password } = body;

    if (!email || !old_password || !new_password) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap.' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return NextResponse.json({ success: false, message: 'Password baru minimal 6 karakter.' }, { status: 400 });
    }

    const user = await userRepository.findByIdentifier(email);
    if (!user) {
      return NextResponse.json({ message: 'User tidak ditemukan' }, { status: 404 });
    }

    const isPasswordValid = await bcrypt.compare(old_password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, message: 'Password lama tidak cocok.' }, { status: 401 });
    }

    if (!user.requires_password_change) {
      return NextResponse.json({ success: false, message: 'Akun ini tidak memerlukan penggantian password wajib.' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    
    await pool.query(
      'UPDATE pengguna SET password_hash = $1, requires_password_change = false, updated_at = NOW() WHERE id = $2',
      [newHash, user.id]
    );

    return NextResponse.json({ success: true, message: 'Password berhasil diperbarui. Silakan login kembali.' });
  } catch (error: any) {
    console.error('Error force-change-password:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
