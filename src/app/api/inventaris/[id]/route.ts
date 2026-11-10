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
    const data = await inventarisRepository.getBarangById(parseInt(id, 10));
    if (!data) {
      return NextResponse.json({ success: false, message: 'Barang tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[InventarisDetailRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
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
    const body = await request.json();

    const success = await inventarisRepository.updateBarang(parseInt(id, 10), {
      ...body,
      kategori_id: body.kategori_id ? parseInt(body.kategori_id, 10) : undefined,
      jumlah: body.jumlah ? parseInt(body.jumlah, 10) : undefined,
      nilai_perolehan: body.nilai_perolehan !== undefined && body.nilai_perolehan !== '' ? parseFloat(body.nilai_perolehan) : undefined,
      tahun_perolehan: body.tahun_perolehan ? parseInt(body.tahun_perolehan, 10) : undefined,
      pemilik_satelit_id: body.pemilik_satelit_id ? parseInt(body.pemilik_satelit_id, 10) : undefined,
      pemilik_jemaat_id: body.pemilik_jemaat_id ? parseInt(body.pemilik_jemaat_id, 10) : undefined,
      lokasi_satelit_id: body.lokasi_satelit_id ? parseInt(body.lokasi_satelit_id, 10) : undefined,
      lokasi_sublokasi_id: body.lokasi_sublokasi_id ? parseInt(body.lokasi_sublokasi_id, 10) : undefined,
      updated_by: caller.user_id,
    });

    if (!success) {
      return NextResponse.json({ success: false, message: 'Barang tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: parseInt(id, 10) }, message: 'Barang berhasil diperbarui' });
  } catch (error: any) {
    console.error('[InventarisDetailRoute] PUT error:', error);
    if (error?.code === '23505') {
      if (error?.constraint === 'idx_barang_no_seri_unique') {
        return NextResponse.json({ success: false, message: 'Nomor seri sudah terdaftar pada barang lain.' }, { status: 400 });
      }
      return NextResponse.json({ success: false, message: 'Data duplikat: data sudah terdaftar.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
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
    const success = await inventarisRepository.softDeleteBarang(parseInt(id, 10), caller.user_id);
    if (!success) {
      return NextResponse.json({ success: false, message: 'Barang tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id: parseInt(id, 10) }, message: 'Barang berhasil dihapus' });
  } catch (error) {
    console.error('[InventarisDetailRoute] DELETE error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
