import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '../validations/auth.validation';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export class AuthController {
  async login(request: NextRequest) {
    try {
      const body = await request.json();

      // Validation
      const parseResult = loginSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { message: parseResult.error.issues[0].message },
          { status: 400 }
        );
      }

      // Authentication Service
      const result = await authService.authenticateUser(parseResult.data);

      const response = NextResponse.json(
        { message: 'Login berhasil', data: result.user },
        { status: 200 }
      );

      // Set httpOnly cookie
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
      // Menangkap throw Error dari Service
      return NextResponse.json(
        { message: error.message || 'Terjadi kesalahan pada server' },
        { status: 401 }
      );
    }
  }
}
