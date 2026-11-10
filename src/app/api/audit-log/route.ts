import { NextRequest, NextResponse } from 'next/server';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (!caller.is_super_admin && !caller.permissions?.includes('audit_log_view')) {
      return NextResponse.json({ success: false, message: 'Forbidden: Requires audit_log_view permission' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    const log_type  = searchParams.get('log_type') || 'jemaat'; // 'jemaat' | 'pelayan' | 'pengurus' | 'anggaran' | 'inventaris' | 'kegiatan' | 'pastoral'
    const limit     = Math.min(parseInt(searchParams.get('limit')  ?? '15'), 100);
    const offset    = parseInt(searchParams.get('offset') ?? '0');
    const aksi      = searchParams.get('aksi')      || undefined;
    const date_from = searchParams.get('date_from') || undefined;
    const date_to   = searchParams.get('date_to')   || undefined;
    const search    = searchParams.get('search')    || undefined;

    const entity_id_s = searchParams.get('entity_id');

    const queryParams = {
      entity_id: entity_id_s ? parseInt(entity_id_s) : undefined,
      aksi,
      date_from,
      date_to,
      search,
      limit,
      offset,
    };

    let data, total;
    if (log_type === 'anggaran') {
      // Anggaran uses a different query params structure (uuid entity, varchar aksi)
      ({ data, total } = await auditLogRepository.getAnggaranAuditLogs({
        aksi,
        date_from,
        date_to,
        search,
        limit,
        offset,
      }));
    } else if (log_type === 'pelayan') {
      ({ data, total } = await auditLogRepository.getPelayanAuditLogs(queryParams));
    } else if (log_type === 'pengurus') {
      ({ data, total } = await auditLogRepository.getPengurusAuditLogs(queryParams));
    } else if (log_type === 'inventaris') {
      ({ data, total } = await auditLogRepository.getInventarisAuditLogs(queryParams));
    } else if (log_type === 'kegiatan') {
      ({ data, total } = await auditLogRepository.getKegiatanAuditLogs(queryParams));
    } else if (log_type === 'pastoral') {
      ({ data, total } = await auditLogRepository.getPastoralAuditLogs({
        ...queryParams,
        status_baru: aksi,
      }));
    } else {
      ({ data, total } = await auditLogRepository.getJemaatAuditLogs(queryParams));
    }

    return NextResponse.json({
      success: true,
      data,
      meta: { total, limit, offset, log_type },
    });

  } catch (error) {
    console.error('[AuditLogRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
