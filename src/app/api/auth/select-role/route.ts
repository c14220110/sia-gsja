import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';

const authService = new AuthService();

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

    const result = await authService.generateFinalToken(
      Number(user_id),
      Number(role_id),
      Number(satelit_id)
    );

    const response = NextResponse.json(
      { message: 'Role berhasil dipilih', data: result.user },
      { status: 200 }
    );

    // Set final httpOnly cookie
    response.cookies.set({
      name: 'access_token',
      value: result.token,
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 2, // 2 hours
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
