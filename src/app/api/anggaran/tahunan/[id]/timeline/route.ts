import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';

// GET: Fetch chronological audit trail for a specific RA document
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const timeline = await auditLogRepository.getAnggaranTimeline(id);
    return NextResponse.json({ success: true, data: timeline });
  } catch (error: any) {
    console.error('[Timeline] Error fetching timeline:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat riwayat', error: error.message }, { status: 500 });
  }
}
