import { NextRequest, NextResponse } from 'next/server';
import { PengurusRepository } from '@/server/repositories/pengurus.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

const pengurusRepository = new PengurusRepository();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      search:        searchParams.get('search')        || undefined,
      satelit_id:    searchParams.get('satelit_id')    || undefined,
      jabatan_id:    searchParams.get('jabatan_id')    || undefined,
      periode_id:    searchParams.get('periode_id')    || undefined,
      komisi_id:     searchParams.get('komisi_id')     || undefined,
      departemen_id: searchParams.get('departemen_id') || undefined,
      status:        searchParams.get('status')        || undefined,
      limit:         parseInt(searchParams.get('limit')  ?? '10'),
      offset:        parseInt(searchParams.get('offset') ?? '0'),
    };

    const result = await pengurusRepository.getPengurusPagination(params);

    return NextResponse.json({
      success: true,
      data:    result.data,
      meta: {
        total:               result.total,
        pengurus_baru:       result.pengurus_baru,
        pengurus_demisioner: result.pengurus_demisioner,
        limit:               params.limit,
        offset:              params.offset,
      },
    });
  } catch (error) {
    console.error('[PengurusRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      jemaat_id, 
      satelit_id, 
      jabatan_id, 
      lingkup, 
      komisi_id, 
      departemen_id, 
      periode_id, 
      tanggal_mulai,
      jalur_pengangkatan, 
      catatan 
    } = body;

    if (!jemaat_id || !satelit_id || !jabatan_id || !lingkup || !periode_id || !tanggal_mulai || !jalur_pengangkatan) {
      return NextResponse.json({ success: false, message: 'Harap lengkapi semua field utama form pengurus' }, { status: 400 });
    }

    const result = await pengurusRepository.createPengurus({
      jemaat_id: parseInt(jemaat_id, 10),
      satelit_id: parseInt(satelit_id, 10),
      jabatan_id: parseInt(jabatan_id, 10),
      lingkup,
      komisi_id: komisi_id ? parseInt(komisi_id, 10) : null,
      departemen_id: departemen_id ? parseInt(departemen_id, 10) : null,
      periode_id: parseInt(periode_id, 10),
      tanggal_mulai,
      jalur_pengangkatan,
      catatan,
      user_id: caller.user_id,
      user_role_id: caller.role_id,
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Pengurus berhasil ditambahkan', data: { id: result.pengurus_id } });
    } else {
      return NextResponse.json({ success: false, message: result.message || 'Gagal menambahkan pengurus' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[PengurusRoute] POST error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
