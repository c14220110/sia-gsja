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
    const data = await inventarisRepository.getMutasiByBarangId(barangId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[InventarisMutasiRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('inventaris_manage')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const barangId = parseInt(id, 10);
    const body = await request.json();

    if (!body.ke_satelit_id) {
      return NextResponse.json({ success: false, message: 'Satelit tujuan wajib dipilih' }, { status: 400 });
    }

    const mutasiId = await inventarisRepository.createMutasiBarang({
      barang_id: barangId,
      ke_satelit_id: parseInt(body.ke_satelit_id, 10),
      ke_sublokasi_id: body.ke_sublokasi_id ? parseInt(body.ke_sublokasi_id, 10) : null,
      tanggal_mutasi: body.tanggal_mutasi || undefined,
      alasan: body.alasan || undefined,
      dicatat_oleh: caller.user_id,
      role_id: caller.role_id,
    });

    return NextResponse.json({
      success: true,
      data: { id: mutasiId },
      message: 'Perpindahan ruangan berhasil dicatat',
    });
  } catch (error: any) {
    console.error('[InventarisMutasiRoute] POST error:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
