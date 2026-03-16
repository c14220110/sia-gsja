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
