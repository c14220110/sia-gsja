import { NextRequest, NextResponse } from 'next/server';
import { PengurusRepository } from '@/server/repositories/pengurus.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

const pengurusRepository = new PengurusRepository();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      search:                searchParams.get('search')                || undefined,
      satelit_asal_id:       searchParams.get('satelit_asal_id')       || undefined,
      status_global:         searchParams.get('status_global')         || undefined,
      lingkup:               searchParams.get('lingkup')               || undefined,
      satelit_penugasan_id:  searchParams.get('satelit_penugasan_id')  || undefined,
      jabatan_id:            searchParams.get('jabatan_id')            || undefined,
      periode_id:            searchParams.get('periode_id')            || undefined,
      komisi_id:             searchParams.get('komisi_id')             || undefined,
      departemen_id:         searchParams.get('departemen_id')         || undefined,
      limit:                 parseInt(searchParams.get('limit')  ?? '10'),
      offset:                parseInt(searchParams.get('offset') ?? '0'),
    };

    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Auto-lock satelit asal untuk admin satelit
    if (caller.role_name?.toUpperCase().includes('SATELIT')) {
      params.satelit_asal_id = caller.satelit_id?.toString();
    }


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
    const caller = getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('pengurus_manage'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk mengukuhkan pengurus (pengurus_manage).' }, { status: 403 });
    }

    const body = await request.json();
    const { jemaat_id } = body;

    if (!jemaat_id) {
      return NextResponse.json({ success: false, message: 'jemaat_id wajib diisi' }, { status: 400 });
    }

    // Support multi-jabatan array AND legacy single flat payload
    let jabatanList: any[] = [];
    if (Array.isArray(body.jabatan_list) && body.jabatan_list.length > 0) {
      jabatanList = body.jabatan_list;
    } else if (body.jabatan_id) {
      jabatanList = [{
        jabatan_id: body.jabatan_id,
        lingkup: body.lingkup,
        satelit_id: body.satelit_id,
        komisi_id: body.komisi_id,
        departemen_id: body.departemen_id,
        periode_id: body.periode_id,
        tanggal_mulai: body.tanggal_mulai,
        jalur_pengangkatan: body.jalur_pengangkatan,
        catatan: body.catatan,
      }];
    }

    if (jabatanList.length === 0) {
      return NextResponse.json({ success: false, message: 'Minimal 1 jabatan harus diisi' }, { status: 400 });
    }

    let lastPengurusId: number | undefined;
    for (const jab of jabatanList) {
      const { jabatan_id, lingkup, satelit_id, komisi_id, departemen_id, periode_id, tanggal_mulai, jalur_pengangkatan, catatan } = jab;

      if (!jabatan_id || !lingkup || !periode_id || !tanggal_mulai || !jalur_pengangkatan) {
        return NextResponse.json({ success: false, message: 'Setiap jabatan harus memiliki lingkup, jabatan, periode, tanggal mulai, dan jalur pengangkatan' }, { status: 400 });
      }

      const result = await pengurusRepository.createPengurus({
        jemaat_id:          parseInt(jemaat_id, 10),
        satelit_id:         parseInt(satelit_id, 10),
        jabatan_id:         parseInt(jabatan_id, 10),
        lingkup,
        komisi_id:          komisi_id ? parseInt(komisi_id, 10) : null,
        departemen_id:      departemen_id ? parseInt(departemen_id, 10) : null,
        periode_id:         parseInt(periode_id, 10),
        tanggal_mulai,
        jalur_pengangkatan,
        catatan,
        user_id:            caller.user_id,
        user_role_id:       caller.role_id,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message || 'Gagal menambahkan jabatan' }, { status: 400 });
      }
      lastPengurusId = result.pengurus_id;
    }

    return NextResponse.json({
      success: true,
      message: `Pengurus berhasil ditambahkan dengan ${jabatanList.length} jabatan`,
      data: { id: lastPengurusId }
    });
  } catch (error: any) {
    console.error('[PengurusRoute] POST error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
