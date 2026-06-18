import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/server/repositories/user.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import bcrypt from 'bcryptjs';

const userRepository = new UserRepository();

export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, username, oldPassword, newPassword } = body;

    const user = await userRepository.findById(caller.user_id);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    if (action === 'update_username') {
      if (!username || typeof username !== 'string') {
        return NextResponse.json({ success: false, message: 'Username tidak valid' }, { status: 400 });
      }

      const cleanUsername = username.trim().toLowerCase();
      
      // Validation: Min 6 chars, alphanumeric only (no spaces, no special chars except underscore), CANNOT BE ALL DIGITS
      const usernameRegex = /^(?!\d+$)[a-z0-9_]{6,50}$/;
      if (!usernameRegex.test(cleanUsername)) {
        return NextResponse.json({ 
          success: false, 
          message: 'Username minimal 6 karakter, hanya boleh huruf, angka, dan underscore (_), dan tidak boleh HANYA berisi angka.' 
        }, { status: 400 });
      }

      // Check if taken
      const isTaken = await userRepository.checkUsernameTaken(cleanUsername, caller.user_id);
      if (isTaken) {
        return NextResponse.json({ success: false, message: 'Username sudah digunakan oleh orang lain.' }, { status: 400 });
      }

      await userRepository.updateUsername(caller.user_id, cleanUsername);
      return NextResponse.json({ success: true, message: 'Username berhasil diperbarui' });
    } 
    
    if (action === 'update_password') {
      if (!oldPassword || !newPassword) {
        return NextResponse.json({ success: false, message: 'Sandi lama dan sandi baru wajib diisi' }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ success: false, message: 'Sandi baru minimal 6 karakter' }, { status: 400 });
      }

      const isPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isPasswordValid) {
        return NextResponse.json({ success: false, message: 'Sandi lama tidak sesuai' }, { status: 400 });
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await userRepository.updatePassword(caller.user_id, newPasswordHash);

      return NextResponse.json({ success: true, message: 'Password berhasil diperbarui' });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Error in /api/pengguna/pengaturan-akun:', error);
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Username sudah digunakan oleh orang lain.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
