import { NextRequest, NextResponse } from 'next/server';
import { pelayanRepository } from '@/server/repositories/pelayan.repository';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      search:     searchParams.get('search')     || undefined,
      satelit_id: searchParams.get('satelit_id') || undefined,
      role_id:    searchParams.get('role_id')    || undefined,
      status:     searchParams.get('status')     || undefined,
      date_from:  searchParams.get('date_from')  || undefined,
      date_to:    searchParams.get('date_to')    || undefined,
      limit:      parseInt(searchParams.get('limit')  ?? '10'),
      offset:     parseInt(searchParams.get('offset') ?? '0'),
    };

    const caller = await getCallerFromRequest(request);
    if (caller && caller.role_name?.toUpperCase().includes('SATELIT')) {
      params.satelit_id = caller.satelit_id?.toString();
    }

    const result = await pelayanRepository.getPelayanPagination(params);

    return NextResponse.json({
      success: true,
      data:    result.data,
      meta: {
        total:            result.total,
        pelayan_baru:     result.pelayan_baru,
        pelayan_nonaktif: result.pelayan_nonaktif,
        limit:            params.limit,
        offset:           params.offset,
      },
    });
  } catch (error) {
    console.error('[PelayanRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('pelayan_manage'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk mendaftarkan pelayan baru (pelayan_manage).' }, { status: 403 });
    }

    const body = await request.json();
    const { jemaat_id, satelit_id, tanggal_mulai, catatan, roles } = body;

    if (!jemaat_id || !satelit_id || !tanggal_mulai || !roles || roles.length === 0) {
      return NextResponse.json({ success: false, message: 'Harap lengkapi semua field pelayan dan minimal 1 role aktif' }, { status: 400 });
    }

    const parsedJemaatId = parseInt(jemaat_id, 10);
    const parsedSatelitId = parseInt(satelit_id, 10);

    const result = await pelayanRepository.createPelayan({
      jemaat_id: parsedJemaatId,
      satelit_id: parsedSatelitId,
      tanggal_mulai,
      catatan,
      roles: roles.map((r: any) => ({
        role_id: parseInt(r.role_id, 10),
        tanggal_mulai: r.tanggal_mulai
      })),
      user_id: caller.user_id,
      user_role_id: caller.role_id,
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Pelayan berhasil ditambahkan', data: { id: result.pelayan_id } });
    } else {
      return NextResponse.json({ success: false, message: result.message || 'Gagal menambahkan pelayan' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[PelayanRoute] POST error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
