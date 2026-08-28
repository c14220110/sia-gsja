import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const repo = new InventarisRepository();

// GET /api/inventaris/stats?lokasi_satelit_id=&kategori_id=
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!caller.is_super_admin && !caller.permissions.includes('inventaris_view')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    // Satellite lock
    const lokasi_satelit_id = caller.satelit_id
      ? caller.satelit_id.toString()
      : (searchParams.get('lokasi_satelit_id') || undefined);
    const kategori_id = searchParams.get('kategori_id') || undefined;

    const stats = await repo.getInventarisStats({ lokasi_satelit_id, kategori_id });
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('[InventarisStats] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
