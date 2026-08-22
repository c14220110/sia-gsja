import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { InventarisRepository } from '@/server/repositories/inventaris.repository';

const inventarisRepository = new InventarisRepository();

export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.permissions.includes('inventaris_view')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search          = searchParams.get('search') || undefined;
    const kategori_id     = searchParams.get('kategori_id') || undefined;
    const lokasi_satelit_id = searchParams.get('lokasi_satelit_id') || undefined;
    const lokasi_sublokasi_id = searchParams.get('lokasi_sublokasi_id') || undefined;
    const pemilik_satelit_id = searchParams.get('pemilik_satelit_id') || undefined;
    const kondisi         = searchParams.get('kondisi') || undefined;
    const status          = searchParams.get('status') || undefined;
    const is_aktiva_tetap = searchParams.get('is_aktiva_tetap') || undefined;
    const limit           = Math.min(parseInt(searchParams.get('limit') ?? '10'), 100);
    const offset          = parseInt(searchParams.get('offset') ?? '0');

    const { data, total } = await inventarisRepository.getBarangPagination({
      search, kategori_id, lokasi_satelit_id, lokasi_sublokasi_id,
      pemilik_satelit_id, kondisi, status, is_aktiva_tetap,
      limit, offset,
    });

    return NextResponse.json({ success: true, data, meta: { total, limit, offset } });
  } catch (error) {
    console.error('[InventarisRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.permissions.includes('inventaris_manage')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (!body.nama || !body.kategori_id) {
      return NextResponse.json({ success: false, message: 'Nama dan kategori wajib diisi' }, { status: 400 });
    }

    const newId = await inventarisRepository.createBarang({
      ...body,
      kategori_id: parseInt(body.kategori_id, 10),
      jumlah: parseInt(body.jumlah, 10) || 1,
      nilai_perolehan: parseFloat(body.nilai_perolehan) || 0,
      tahun_perolehan: body.tahun_perolehan ? parseInt(body.tahun_perolehan, 10) : undefined,
      pemilik_satelit_id: body.pemilik_satelit_id ? parseInt(body.pemilik_satelit_id, 10) : undefined,
      pemilik_jemaat_id: body.pemilik_jemaat_id ? parseInt(body.pemilik_jemaat_id, 10) : undefined,
      lokasi_satelit_id: body.lokasi_satelit_id ? parseInt(body.lokasi_satelit_id, 10) : undefined,
      lokasi_sublokasi_id: body.lokasi_sublokasi_id ? parseInt(body.lokasi_sublokasi_id, 10) : undefined,
      created_by: caller.user_id,
    });

    return NextResponse.json({
      success: true,
      data: { id: newId },
      message: 'Barang berhasil ditambahkan',
    }, { status: 201 });
  } catch (error) {
    console.error('[InventarisRoute] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
