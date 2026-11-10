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
      target_month: searchParams.get('target_month') || undefined,
      limit:      parseInt(searchParams.get('limit')  ?? '10'),
      offset:     parseInt(searchParams.get('offset') ?? '0'),
      pending_only: searchParams.get('pending_only') || undefined,
    };

    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      params.satelit_id = caller.satelit_id?.toString();
    }

    const result = await pelayanRepository.getPelayanPagination(params);

    return NextResponse.json({
      success: true,
      data:    result.data,
      meta: {
        total:               result.total,
        pelayan_baru:        result.pelayan_baru,
        pelayan_nonaktif:    result.pelayan_nonaktif,
        menunggu_konfirmasi: result.menunggu_konfirmasi,
        limit:               params.limit,
        offset:              params.offset,
      },
    });
  } catch (error) {
    console.error('[PelayanRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
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

    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (parsedSatelitId !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak bisa mendaftarkan pelayan untuk satelit lain.' }, { status: 403 });
      }
    }

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
