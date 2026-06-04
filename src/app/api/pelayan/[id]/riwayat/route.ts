import { NextRequest, NextResponse } from 'next/server';
import { pelayanRepository } from '@/server/repositories/pelayan.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: 'Invalid ID' }, { status: 400 });
    }

    // Ambil riwayat dari repository
    const result = await pelayanRepository.getRiwayatPelayanan(id);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[PelayanRiwayatRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
