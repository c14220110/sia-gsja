import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const inventarisRepository = new InventarisRepository();

export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.permissions.includes('inventaris_view')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'kategori' | 'sublokasi'

    if (type === 'kategori') {
      const data = await inventarisRepository.getKategoriList();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'sublokasi') {
      const satelitId = searchParams.get('satelit_id');
      const data = await inventarisRepository.getSublokasiList(
        satelitId ? parseInt(satelitId, 10) : undefined
      );
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, message: 'Parameter type diperlukan (kategori|sublokasi)' }, { status: 400 });
  } catch (error) {
    console.error('[InventarisMasterRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
