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
    const data = await inventarisRepository.getPeminjamanByBarangId(barangId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[InventarisPeminjamanRoute] GET error:', error);
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

    if (!body.peminjam_tipe) {
      return NextResponse.json({ success: false, message: 'Tipe peminjam wajib dipilih' }, { status: 400 });
    }
    if (body.peminjam_tipe === 'Jemaat' && !body.peminjam_jemaat_id) {
      return NextResponse.json({ success: false, message: 'Nama jemaat peminjam wajib dipilih' }, { status: 400 });
    }
    if (body.peminjam_tipe === 'Lain-lain' && !body.peminjam_nama_lain?.trim()) {
      return NextResponse.json({ success: false, message: 'Nama peminjam wajib diisi' }, { status: 400 });
    }

    const peminjamanId = await inventarisRepository.createPeminjamanBarang({
      barang_id: barangId,
      peminjam_tipe: body.peminjam_tipe,
      peminjam_satelit_id: body.peminjam_satelit_id ? parseInt(body.peminjam_satelit_id, 10) : null,
      peminjam_jemaat_id: body.peminjam_jemaat_id ? parseInt(body.peminjam_jemaat_id, 10) : null,
      peminjam_nama_lain: body.peminjam_nama_lain || null,
      tanggal_pinjam: body.tanggal_pinjam || undefined,
      tanggal_rencana_kembali: body.tanggal_rencana_kembali || null,
      catatan: body.catatan || null,
      dicatat_oleh: caller.user_id,
      role_id: caller.role_id,
    });

    return NextResponse.json({
      success: true,
      data: { id: peminjamanId },
      message: 'Peminjaman barang berhasil dicatat',
    });
  } catch (error: any) {
    console.error('[InventarisPeminjamanRoute] POST error:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
