import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const repo = new InventarisRepository();

// GET /api/inventaris/stok-opname — list sessions
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('inventaris_view')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const satelit_id = caller.is_super_admin
      ? (searchParams.get('satelit_id') || undefined)
      : caller.satelit_id.toString();
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { data, total } = await repo.getStokOpnamePagination({ satelit_id, status, limit, offset });
    return NextResponse.json({
      success: true,
      data,
      meta: { total, limit, offset }
    });
  } catch (error) {
    console.error('[StokOpname] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/inventaris/stok-opname — create new stok opname session
export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('inventaris_stok_opname')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { judul, tanggal, periode, catatan, satelit_id } = body;

    if (!judul || !tanggal) {
      return NextResponse.json({ success: false, message: 'Judul dan tanggal wajib diisi' }, { status: 400 });
    }

    // Gunakan satelit caller kecuali super admin pilih sendiri
    const targetSatelitId = caller.is_super_admin && satelit_id
      ? parseInt(satelit_id, 10)
      : caller.satelit_id;

    const id = await repo.createStokOpname({
      satelit_id: targetSatelitId,
      judul,
      tanggal,
      periode: periode || undefined,
      catatan: catatan || undefined,
      created_by: caller.user_id,
    });

    return NextResponse.json({ success: true, data: { id }, message: 'Sesi stok opname berhasil dibuat' }, { status: 201 });
  } catch (error) {
    console.error('[StokOpname] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
