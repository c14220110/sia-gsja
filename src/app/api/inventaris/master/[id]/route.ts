import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const repo = new InventarisRepository();

/** Pusat manage: super_admin OR inventaris_manage tanpa satelit_id lock */
function canManageMaster(caller: { is_super_admin: boolean; satelit_id: number; permissions: string[] }) {
  return caller.is_super_admin || (caller.permissions.includes('inventaris_manage') && !caller.satelit_id);
}

/** Sublokasi manage: super_admin OR inventaris_manage (untuk satelit miliknya sendiri) */
function canManageSublokasi(caller: { is_super_admin: boolean; satelit_id: number; permissions: string[] }, targetSatelitId?: number) {
  if (caller.is_super_admin) return true;
  if (!caller.permissions.includes('inventaris_manage')) return false;
  if (!caller.satelit_id) return true; // pusat
  return targetSatelitId === caller.satelit_id;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });

  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'sublokasi') {
      // Ambil sublokasi dulu untuk cek satelit_id-nya
      const existing = await repo.getSublokasiById?.(id);
      const targetSatelitId = existing?.satelit_id;
      if (!canManageSublokasi(caller, targetSatelitId)) {
        return NextResponse.json({ success: false, message: 'Forbidden — tidak ada akses ke satelit ini' }, { status: 403 });
      }
      const ok = await repo.updateSublokasi(id, { kode: data.kode, nama: data.nama, is_active: data.is_active });
      if (!ok) return NextResponse.json({ success: false, message: 'Sub-lokasi tidak ditemukan' }, { status: 404 });
      return NextResponse.json({ success: true, message: 'Sub-lokasi berhasil diperbarui' });
    }

    if (type === 'kategori') {
      if (!canManageMaster(caller)) {
        return NextResponse.json({ success: false, message: 'Forbidden — akses manajemen master diperlukan' }, { status: 403 });
      }
      const ok = await repo.updateKategori(id, { nama: data.nama, keterangan: data.keterangan, is_active: data.is_active });
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

  try {
    const body = await request.json().catch(() => ({}));
    const type = body?.type;

    // Kategori delete (hanya Super Admin, dengan FK check)
    if (type === 'kategori') {
      if (!canManageMaster(caller)) {
        return NextResponse.json({ success: false, message: 'Forbidden — hanya Super Admin yang dapat menghapus kategori' }, { status: 403 });
      }
      const result = await repo.deleteKategori(id);
      if (!result.ok) {
        return NextResponse.json({ success: false, message: result.reason || 'Gagal menghapus kategori' }, { status: 409 });
      }
      return NextResponse.json({ success: true, message: 'Kategori berhasil dihapus' });
    }

    // Sublokasi delete (existing behaviour)
    const existing = await repo.getSublokasiById?.(id);
    if (!canManageSublokasi(caller, existing?.satelit_id)) {
      return NextResponse.json({ success: false, message: 'Forbidden — tidak ada akses ke satelit ini' }, { status: 403 });
    }
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
