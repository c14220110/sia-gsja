import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/server/repositories/user.repository';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/server/utils/jwt';

const userRepository = new UserRepository();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pre_auth_token, role_id, satelit_id } = body;

    if (!role_id || !satelit_id) {
      return NextResponse.json(
        { message: 'Data tidak lengkap' },
        { status: 400 }
      );
    }

    // ── Verifikasi identitas caller — dua mode yang valid ────────────────────
    //
    // MODE A: token persiapan doang dari halaman login (khusus yang perannya double/banyak)
    //   → User baru saja login dengan benar, belum punya access_token cookie.
    //
    // MODE B: pakai access token beneran dari cookie (pengguna emang udah login dari sononya)
    //   → User sudah terautentikasi, ganti role dari dalam dashboard.
    //
    // Tanpa salah satu dari dua ini, request ditolak 401.

    let userId: number | null = null;

    if (pre_auth_token) {
      // --- MODE A: verifikasi pre-auth token dari login ---
      try {
        const payload = jwt.verify(pre_auth_token, getJwtSecret()) as any;
        if (payload.purpose !== 'role_selection') {
          return NextResponse.json(
            { message: 'Token tidak valid untuk operasi ini.' },
            { status: 401 }
          );
        }
        userId = payload.pre_auth_user_id;
      } catch {
        return NextResponse.json(
          { message: 'Sesi pemilihan role tidak valid atau sudah kedaluwarsa. Silakan login ulang.' },
          { status: 401 }
        );
      }
    } else {
      // --- MODE B: verifikasi existing access_token cookie (ganti role) ---
      const existingToken = request.cookies.get('access_token')?.value;
      if (!existingToken) {
        return NextResponse.json(
          { message: 'Tidak terautentikasi. Silakan login terlebih dahulu.' },
          { status: 401 }
        );
      }
      try {
        const payload = jwt.verify(existingToken, getJwtSecret()) as any;
        userId = payload.user_id;
      } catch {
        return NextResponse.json(
          { message: 'Sesi tidak valid atau sudah kedaluwarsa. Silakan login ulang.' },
          { status: 401 }
        );
      }
    }

    if (!userId) {
      return NextResponse.json({ message: 'Identitas tidak dapat diverifikasi.' }, { status: 401 });
    }

    // ── Verifikasi role yang dipilih benar-benar milik user ini ──────────────
    const roleId = Number(role_id);
    const satelitId = Number(satelit_id);

    const roles = await userRepository.getUserRoles(userId);
    const selectedRole = roles.find(r => r.role_id === roleId && r.satelit_id === satelitId);

    if (!selectedRole) {
      return NextResponse.json(
        { message: 'Role tidak valid atau Anda tidak memiliki akses ke role tersebut.' },
        { status: 403 }
      );
    }

    // ── Generate final JWT token ──────────────────────────────────────────────
    const is_super_admin = selectedRole.nama_role === 'SUPER_ADMIN';
    const permissions = await userRepository.getRolePermissionNames(selectedRole.role_id);

    const isJemaat = selectedRole.nama_role === 'JEMAAT';
    const expiresInString = isJemaat ? '180d' : '1d';
    const cookieMaxAge = isJemaat ? 60 * 60 * 24 * 180 : 60 * 60 * 24;

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
      jemaat_id: userRecord?.jemaat_id ?? null,
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
