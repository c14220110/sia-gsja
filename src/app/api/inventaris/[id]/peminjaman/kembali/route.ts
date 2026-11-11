import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const inventarisRepository = new InventarisRepository();

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

    if (!body.peminjaman_id) {
      return NextResponse.json({ success: false, message: 'ID peminjaman wajib disertakan' }, { status: 400 });
    }

    const peminjamanId = parseInt(body.peminjaman_id, 10);
    await inventarisRepository.kembalikanPeminjamanBarang(
      peminjamanId,
      barangId,
      caller.user_id,
      caller.role_id,
      body.catatan_kembali
    );

    return NextResponse.json({
      success: true,
      message: 'Barang berhasil dikembalikan ke inventaris',
    });
  } catch (error: any) {
    console.error('[InventarisKembaliRoute] POST error:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
