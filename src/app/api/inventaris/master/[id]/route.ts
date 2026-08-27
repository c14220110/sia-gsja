import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const repo = new InventarisRepository();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });

  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Forbidden — hanya Super Admin' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'sublokasi') {
      const ok = await repo.updateSublokasi(id, {
        kode: data.kode,
        nama: data.nama,
        is_active: data.is_active,
      });
      if (!ok) return NextResponse.json({ success: false, message: 'Sub-lokasi tidak ditemukan' }, { status: 404 });
      return NextResponse.json({ success: true, message: 'Sub-lokasi berhasil diperbarui' });
    }

    if (type === 'kategori') {
      const ok = await repo.updateKategori(id, {
        keterangan: data.keterangan,
        is_active: data.is_active,
      });
      if (!ok) return NextResponse.json({ success: false, message: 'Kategori tidak ditemukan' }, { status: 404 });
      return NextResponse.json({ success: true, message: 'Kategori berhasil diperbarui' });
    }

    return NextResponse.json({ success: false, message: 'type tidak dikenali' }, { status: 400 });
  } catch (error) {
    console.error('[InventarisMasterIdRoute] PUT error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });

  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Forbidden — hanya Super Admin' }, { status: 403 });
  }

  try {
    const result = await repo.deleteSublokasi(id);
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.reason || 'Gagal menghapus' }, { status: 409 });
    }
    return NextResponse.json({ success: true, message: 'Sub-lokasi berhasil dihapus' });
  } catch (error) {
    console.error('[InventarisMasterIdRoute] DELETE error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
