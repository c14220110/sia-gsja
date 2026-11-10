import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const repo = new InventarisRepository();

// GET /api/inventaris/stok-opname/[id] — detail session + items
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
    const data = await repo.getStokOpnameById(parseInt(id, 10));
    if (!data) {
      return NextResponse.json({ success: false, message: 'Sesi stok opname tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[StokOpname/id] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/inventaris/stok-opname/[id] — action: start | update_detail | verify
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('inventaris_stok_opname')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    const body = await request.json();
    const { action } = body;

    if (action === 'start') {
      const ok = await repo.startStokOpname(sessionId);
      if (!ok) {
        return NextResponse.json({ success: false, message: 'Tidak dapat memulai — sesi harus berstatus Draft' }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Sesi opname dimulai' });
    }

    if (action === 'update_detail') {
      const { detail_id, jumlah_fisik, kondisi_fisik, keterangan, foto_bukti } = body;
      if (detail_id === undefined || jumlah_fisik === undefined) {
        return NextResponse.json({ success: false, message: 'detail_id dan jumlah_fisik wajib diisi' }, { status: 400 });
      }

      // ── Lock check: hanya bisa edit saat sesi Berjalan ──
      const session = await repo.getStokOpnameById(sessionId);
      if (!session) {
        return NextResponse.json({ success: false, message: 'Sesi tidak ditemukan' }, { status: 404 });
      }
      if (session.status !== 'Berjalan') {
        return NextResponse.json({
          success: false,
          message: `Sesi sudah ${session.status}. Tidak dapat mengubah data yang sudah diverifikasi.`
        }, { status: 403 });
      }

      const ok = await repo.updateStokOpnameDetail({
        detail_id: parseInt(detail_id, 10),
        jumlah_fisik: parseInt(jumlah_fisik, 10),
        kondisi_fisik: kondisi_fisik || undefined,
        keterangan: keterangan || undefined,
        foto_bukti: foto_bukti || undefined,
        checked_by: caller.user_id,
      });
      if (!ok) {
        return NextResponse.json({ success: false, message: 'Detail item tidak ditemukan' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Hasil hitung berhasil disimpan' });
    }

    if (action === 'verify') {
      const ok = await repo.verifyStokOpname(sessionId, caller.user_id);
      if (!ok) {
        return NextResponse.json({ success: false, message: 'Tidak dapat memverifikasi — sesi harus berstatus Berjalan' }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Stok opname berhasil diverifikasi dan diselesaikan' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak dikenal' }, { status: 400 });
  } catch (error) {
    console.error('[StokOpname/id] PUT error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
