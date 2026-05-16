// src/app/api/kegiatan/[id]/lpj/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const timeline = await auditLogRepository.getLpjTimeline(numId);
    return NextResponse.json({ success: true, data: timeline });
  } catch (error: any) {
    console.error('[Timeline LPJ] Error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat riwayat LPJ.', error: error.message }, { status: 500 });
  }
}
