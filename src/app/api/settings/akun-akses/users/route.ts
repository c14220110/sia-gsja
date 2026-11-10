import { NextRequest, NextResponse } from 'next/server';
import { akunAksesRepository } from '@/server/repositories/akunAkses.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const data = await akunAksesRepository.getPenggunaList();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/users GET:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, jemaat_id, roles } = body;

    // `email` di sini adalah field identifier — bisa berisi email, no_hp, atau username
    const identifier = (email || '').trim();
    if (!identifier || !password || !roles || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ success: false, message: 'Mohon lengkapi semua field yang diwajibkan (Identifier Login, Password, minimal 1 Role)' }, { status: 400 });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await akunAksesRepository.createPenggunaMultiRole({
      email: identifier,
      password_hash,
      jemaat_id: jemaat_id || null,
      roles,
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Akun login berhasil dibuat' });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/users POST:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, is_active } = body;

    if (typeof user_id !== 'number' || typeof is_active !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Parameter user_id dan is_active diperlukan' }, { status: 400 });
    }

    const result = await akunAksesRepository.toggleUserStatus(user_id, is_active);

    if (result.success) {
      return NextResponse.json({ success: true, message: is_active ? 'Akun berhasil diaktifkan' : 'Akun berhasil dinonaktifkan' });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/users PATCH:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, email, password, roles, jemaat_id } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id diperlukan' }, { status: 400 });
    }

    const updateData: any = {};
    if (email) updateData.email = email;
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    // jemaat_id: undefined = tidak diubah, null = hapus link, number = set link baru
    if (jemaat_id !== undefined) updateData.jemaat_id = jemaat_id;
    // Teruskan komisi_id dan departemen_id per-role-row (bukan dari level global)
    if (roles !== undefined) {
      updateData.roles = roles.map((r: any) => ({
        role_id: r.role_id,
        satelit_id: r.satelit_id,
        komisi_id: r.komisi_id ?? null,
        departemen_id: r.departemen_id ?? null,
      }));
    }

    const result = await akunAksesRepository.updatePengguna(user_id, updateData);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Data pengguna berhasil diperbarui' });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/users PUT:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
