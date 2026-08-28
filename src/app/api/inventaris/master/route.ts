import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const repo = new InventarisRepository();

// Helper: apakah caller punya privilege manajemen master data
// Super admin ATAU pusat role dengan inventaris_manage (satelit_id = null/0)
function canManageMaster(caller: { is_super_admin: boolean; satelit_id: number; permissions: string[] }): boolean {
  if (caller.is_super_admin) return true;
  return caller.permissions.includes('inventaris_manage') && !caller.satelit_id;
}

// Helper: apakah caller boleh manage sublokasi untuk satelit tertentu
function canManageSublokasi(caller: { is_super_admin: boolean; satelit_id: number; permissions: string[] }, targetSatelitId?: number): boolean {
  if (caller.is_super_admin) return true;
  if (!caller.permissions.includes('inventaris_manage')) return false;
  // Pusat (satelit_id=0) boleh semua; satelit hanya boleh punyanya sendiri
  if (!caller.satelit_id) return true;
  return targetSatelitId === caller.satelit_id;
}

export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!caller.is_super_admin && !caller.permissions.includes('inventaris_view')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const all = searchParams.get('all') === 'true';

    if (type === 'kategori') {
      const data = canManageMaster(caller) && all
        ? await repo.getKategoriAll()
        : await repo.getKategoriList();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'sublokasi') {
      // Satellite lock: satelit role hanya bisa lihat sublokasi miliknya
      const rawSatelitId = searchParams.get('satelit_id');
      const satelitId = caller.satelit_id
        ? caller.satelit_id
        : (rawSatelitId ? parseInt(rawSatelitId, 10) : undefined);
      const data = canManageMaster(caller) && all
        ? await repo.getSublokasiAll(satelitId)
        : await repo.getSublokasiList(satelitId);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, message: 'Parameter type diperlukan (kategori|sublokasi)' }, { status: 400 });
  } catch (error) {
    console.error('[InventarisMasterRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'sublokasi') {
      const { satelit_id, kode, nama } = data;
      const targetSatelitId = satelit_id ? parseInt(satelit_id, 10) : caller.satelit_id;
      if (!canManageSublokasi(caller, targetSatelitId)) {
        return NextResponse.json({ success: false, message: 'Forbidden — tidak ada akses ke satelit ini' }, { status: 403 });
      }
      if (!targetSatelitId || !nama?.trim()) {
        return NextResponse.json({ success: false, message: 'satelit_id dan nama wajib diisi' }, { status: 400 });
      }
      const id = await repo.createSublokasi({ satelit_id: targetSatelitId, kode: kode || '', nama });
      return NextResponse.json({ success: true, message: 'Sub-lokasi berhasil ditambahkan', data: { id } });
    }

    return NextResponse.json({ success: false, message: 'type tidak dikenali' }, { status: 400 });
  } catch (error) {
    console.error('[InventarisMasterRoute] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
