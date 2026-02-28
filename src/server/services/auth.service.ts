import { UserRepository } from '../repositories/user.repository';
import { LoginInput } from '../validations/auth.validation';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userRepository = new UserRepository();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-it-in-production';

export class AuthService {
  async authenticateUser(data: LoginInput) {
    const user = await userRepository.findByEmail(data.email);

    if (!user) {
      throw new Error('Email atau password salah');
    }

    if (!user.is_active) {
      throw new Error('Akun Anda tidak aktif');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Email atau password salah');
    }

    // Role minimal, kita ambil lokasi pertama jika ada
    const userRolesData = await userRepository.getUserRolesAndLocation(user.id);
    const roles = userRolesData?.roles || [];
    const active_location_id = userRolesData?.location_id || 0;
    const is_super_admin = roles.includes('Super Admin');

    // 1. JWT payload wajib: user_id, active_location_id, roles array, is_super_admin
    const tokenPayload = {
      user_id: user.id,
      active_location_id,
      roles,
      is_super_admin,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '2h' });

    // Update login timestamp
    await userRepository.updateLastLogin(user.id);

    return { token, user: tokenPayload };
  }
}
