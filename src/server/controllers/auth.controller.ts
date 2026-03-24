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

      if (result.requires_password_change) {
        return NextResponse.json(
          { 
            message: 'Anda menggunakan sandi default. Silakan ubah password Anda.', 
            requires_password_change: true,
            data: { email: result.email }
          },
          { status: 200 }
        );
      }

      if (result.requires_role_selection) {
        // Return 200 but indicate that role selection is required. Do not set cookie yet.
        return NextResponse.json(
          { 
            message: 'Pilih role untuk melanjutkan', 
            requires_role_selection: true,
            data: {
              user_id: result.user_id,
              available_roles: result.available_roles
            }
          },
          { status: 200 }
        );
      }

      // Single role - issue token and set cookie
      const response = NextResponse.json(
        { message: 'Login berhasil', data: result.user, requires_role_selection: false },
        { status: 200 }
      );

      // Set httpOnly cookie
      response.cookies.set({
        name: 'access_token',
        value: result.token!,
        httpOnly: true,
        path: '/',
        maxAge: result.cookieMaxAge!,
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
}

