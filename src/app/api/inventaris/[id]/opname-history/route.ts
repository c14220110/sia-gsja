import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const inventarisRepository = new InventarisRepository();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('inventaris_view')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const barangId = parseInt(id, 10);
    const data = await inventarisRepository.getStokOpnameHistoryByBarangId(barangId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[InventarisOpnameHistoryRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
