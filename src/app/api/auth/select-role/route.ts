import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/server/repositories/user.repository';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/server/utils/jwt';

const userRepository = new UserRepository();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, role_id, satelit_id } = body;

    if (!user_id || !role_id || !satelit_id) {
      return NextResponse.json(
        { message: 'Data tidak lengkap' },
        { status: 400 }
      );
    }

    const userId = Number(user_id);
    const roleId = Number(role_id);
    const satelitId = Number(satelit_id);

    // --- Inlined generateFinalToken logic ---

    const roles = await userRepository.getUserRoles(userId);
    const selectedRole = roles.find(r => r.role_id === roleId && r.satelit_id === satelitId);

    if (!selectedRole) {
      throw new Error('Role tidak valid atau Anda tidak memiliki akses ke role tersebut');
    }

    const is_super_admin = selectedRole.nama_role === 'SUPER_ADMIN';
    const permissions = await userRepository.getRolePermissionNames(selectedRole.role_id);

    const isJemaat = selectedRole.nama_role === 'JEMAAT';
    const expiresInString = isJemaat ? '180d' : '1d';
    const cookieMaxAge = isJemaat ? 60 * 60 * 24 * 180 : 60 * 60 * 24;

    // Ambil jemaat_id dari DB karena generateFinalToken hanya punya userId
    const userRecord = await userRepository.findById(userId);

    const tokenPayload = {
      user_id: userId,
      role_id: selectedRole.role_id,
      role_name: selectedRole.nama_role,
      satelit_id: selectedRole.satelit_id,
      komisi_id: selectedRole.komisi_id ?? null,
      departemen_id: selectedRole.departemen_id ?? null,
      is_super_admin,
      permissions,
      jemaat_id: userRecord?.jemaat_id ?? null   // ← wajib untuk fitur pelayan di PWA
    };

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: expiresInString });
    await userRepository.updateLastLogin(userId);

    const response = NextResponse.json(
      { message: 'Role berhasil dipilih', data: tokenPayload },
      { status: 200 }
    );

    // Set final httpOnly cookie
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
      { message: error.message || 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
