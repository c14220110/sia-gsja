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
    const { email, password, jemaat_id, role_id, satelit_id } = body;

    if (!email || !password || !jemaat_id || !role_id || !satelit_id) {
      return NextResponse.json({ success: false, message: 'Mohon lengkapi semua field yang diwajibkan' }, { status: 400 });
    }

    // Hash the password securely
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await akunAksesRepository.createPengguna({
      email,
      password_hash,
      jemaat_id,
      role_id,
      satelit_id
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
