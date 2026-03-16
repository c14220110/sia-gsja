import { NextRequest, NextResponse } from 'next/server';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only super_admin or admin roles can view audit logs
    if (!caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit  = parseInt(searchParams.get('limit')  ?? '15');
    const offset = parseInt(searchParams.get('offset') ?? '0');
    const aksi         = searchParams.get('aksi')         || undefined;
    const date_from    = searchParams.get('date_from')    || undefined;
    const date_to      = searchParams.get('date_to')      || undefined;
    const search       = searchParams.get('search')       || undefined;
    const jemaat_id_s  = searchParams.get('jemaat_id');
    const user_id_s    = searchParams.get('user_id');

    const { data, total } = await auditLogRepository.getAuditLogs({
      aksi,
      date_from,
      date_to,
      search,
      limit,
      offset,
      jemaat_id:  jemaat_id_s  ? parseInt(jemaat_id_s)  : undefined,
      user_id:    user_id_s    ? parseInt(user_id_s)    : undefined,
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { total, limit, offset },
    });

  } catch (error) {
    console.error('[AuditLogRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
