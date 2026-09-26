import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/server/repositories/user.repository';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/server/utils/jwt';
import { comparePasswordWithDobTolerance } from '@/server/utils/authUtils';

// Pre-auth token: dicap sama JWT, matinya 5 menit, khususon buat fitur pilih peran aja
function createPreAuthToken(userId: number): string {
  return jwt.sign(
    { pre_auth_user_id: userId, purpose: 'role_selection' },
    getJwtSecret(),
    { expiresIn: '5m' }
  );
}

const userRepository = new UserRepository();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validasi cepet: email sama password ga boleh kosong melompong
    if (!body.email || typeof body.email !== 'string' || body.email.trim().length === 0) {
      return NextResponse.json(
        { message: 'Email wajib diisi' },
        { status: 400 }
      );
    }
    if (!body.password || typeof body.password !== 'string' || body.password.trim().length === 0) {
      return NextResponse.json(
        { message: 'Password wajib diisi' },
        { status: 400 }
      );
    }

    const { email, password } = body;

    // --- Inlined authenticateUser logic ---

    // data.email ini multi-fungsi ya, bisa diisi no hape / username juga
    const user = await userRepository.findByIdentifier(email);

    if (!user) {
      throw new Error('Email, No Handphone, atau Username tidak terdaftar.');
    }

    if (!user.is_active) {
      throw new Error('Akun Anda tidak aktif');
    }

    const isPasswordValid = await comparePasswordWithDobTolerance(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Password salah.');
    }

    // Case 1: requires password change
    if (user.requires_password_change) {
      return NextResponse.json(
        { 
          message: 'Anda menggunakan sandi default. Silakan ubah password Anda.', 
          requires_password_change: true,
          data: { email: user.email }
        },
        { status: 200 }
      );
    }

    const roles = await userRepository.getUserRoles(user.id);

    if (roles.length === 0) {
      throw new Error('Akun Anda tidak memiliki hak akses (role) sama sekali.');
    }

    // Kasus 2: perannya banyak — lemparkan token sementaranya (jangan kasi ID user aslinya!)
    // Pre-auth token ini bukti sah JWT kalau dia udah bener loginnya
    if (roles.length > 1) {
      const preAuthToken = createPreAuthToken(user.id);
      return NextResponse.json(
        { 
          message: 'Pilih role untuk melanjutkan', 
          requires_role_selection: true,
          data: {
            pre_auth_token: preAuthToken,   // ← token sementara, bukan user_id
            available_roles: roles
          }
        },
        { status: 200 }
      );
    }

    // Kasus 3: perannya cuma sebatang kara — terbitin token paten langsung
    const singleRole = roles[0];
    const is_super_admin = singleRole.nama_role === 'SUPER_ADMIN';
    const permissions = await userRepository.getRolePermissionNames(singleRole.role_id);

    const isJemaat = singleRole.nama_role === 'JEMAAT';
    const expiresInString = isJemaat ? '180d' : '1d';
    const cookieMaxAge = isJemaat ? 60 * 60 * 24 * 180 : 60 * 60 * 24;

    const tokenPayload = {
      user_id: user.id,
      role_id: singleRole.role_id,
      role_name: singleRole.nama_role,
      satelit_id: singleRole.satelit_id,
      komisi_id: singleRole.komisi_id ?? null,
      departemen_id: singleRole.departemen_id ?? null,
      is_super_admin,
      permissions,
      jemaat_id: user.jemaat_id ?? null   // ← wajib untuk fitur pelayan di PWA
    };

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: expiresInString });

    // Update login timestamp
    await userRepository.updateLastLogin(user.id);

    // Peran cuman satu - langsung tembakin token ke cookienya
    const response = NextResponse.json(
      { message: 'Login berhasil', data: tokenPayload, requires_role_selection: false },
      { status: 200 }
    );

    // Set httpOnly cookie
    response.cookies.set({
      name: 'access_token',
      value: token,
      httpOnly: true,
      path: '/',
      maxAge: cookieMaxAge,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Terjadi kesalahan pada server' },
      { status: 401 }
    );
  }
}
