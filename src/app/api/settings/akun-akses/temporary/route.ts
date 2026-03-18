import { NextRequest, NextResponse } from 'next/server';
import { akunAksesRepository } from '@/server/repositories/akunAkses.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    // Hanya Super Admin yang bisa mengelola akun & hak akses
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, role_id, satelit_id, tanggal_mulai, tanggal_selesai } = body;

    if (!user_id || !role_id || !satelit_id || !tanggal_mulai || !tanggal_selesai) {
      return NextResponse.json({ success: false, message: 'Mohon lengkapi parameter Akses Sementara' }, { status: 400 });
    }

    const result = await akunAksesRepository.addTemporaryAccess(body);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Hak Akses Sementara berhasil ditambahkan' });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/temporary POST:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
