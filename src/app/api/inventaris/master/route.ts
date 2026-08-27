import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const repo = new InventarisRepository();

export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!caller.is_super_admin && !caller.permissions.includes('inventaris_view')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const all = searchParams.get('all') === 'true'; // super admin: tampilkan semua termasuk inactive

    if (type === 'kategori') {
      const data = caller.is_super_admin && all
        ? await repo.getKategoriAll()
        : await repo.getKategoriList();
      return NextResponse.json({ success: true, data });
    }

    if (type === 'sublokasi') {
      const satelitId = searchParams.get('satelit_id');
      const data = caller.is_super_admin && all
        ? await repo.getSublokasiAll(satelitId ? parseInt(satelitId, 10) : undefined)
        : await repo.getSublokasiList(satelitId ? parseInt(satelitId, 10) : undefined);
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
  if (!caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Forbidden — hanya Super Admin' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'sublokasi') {
      const { satelit_id, kode, nama } = data;
      if (!satelit_id || !nama?.trim()) {
        return NextResponse.json({ success: false, message: 'satelit_id dan nama wajib diisi' }, { status: 400 });
      }
      const id = await repo.createSublokasi({ satelit_id: parseInt(satelit_id, 10), kode: kode || '', nama });
      return NextResponse.json({ success: true, message: 'Sub-lokasi berhasil ditambahkan', data: { id } });
    }

    return NextResponse.json({ success: false, message: 'type tidak dikenali' }, { status: 400 });
  } catch (error) {
    console.error('[InventarisMasterRoute] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
