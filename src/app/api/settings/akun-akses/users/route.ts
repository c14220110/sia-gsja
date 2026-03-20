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

    if (!email || !password || !jemaat_id || !roles) {
      return NextResponse.json({ success: false, message: 'Mohon lengkapi semua field yang diwajibkan (Email, Password, Jemaat)' }, { status: 400 });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await akunAksesRepository.createPenggunaMultiRole({
      email,
      password_hash,
      jemaat_id,
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
    const { user_id, email, password, roles } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id diperlukan' }, { status: 400 });
    }

    const updateData: any = {};
    if (email) updateData.email = email;
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    if (roles !== undefined) updateData.roles = roles;

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
