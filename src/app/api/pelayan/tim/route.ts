import { NextRequest, NextResponse } from 'next/server';
import { timPelayanRepository } from '@/server/repositories/timPelayan.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    let satelit_id = searchParams.get('satelit_id') || undefined;

    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      satelit_id = caller.satelit_id?.toString();
    }

    const data = await timPelayanRepository.getAll(satelit_id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[TimPelayanRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    if (!caller.is_super_admin && !caller.permissions.includes('pelayan_manage')) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { nama_tim, deskripsi, satelit_id } = body;

    if (!nama_tim || !satelit_id) {
      return NextResponse.json({ success: false, message: 'Nama tim dan satelit wajib diisi.' }, { status: 400 });
    }

    const result = await timPelayanRepository.create({ nama_tim, deskripsi, satelit_id });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[TimPelayanRoute] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
