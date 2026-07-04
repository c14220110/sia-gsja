import { NextRequest, NextResponse } from 'next/server';
import { timPelayanRepository } from '@/server/repositories/timPelayan.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const timId = parseInt(id);
    const [tim, anggota] = await Promise.all([
      timPelayanRepository.getById(timId),
      timPelayanRepository.getAnggota(timId),
    ]);

    if (!tim) return NextResponse.json({ success: false, message: 'Tim tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ success: true, data: { ...tim, anggota } });
  } catch (error) {
    console.error('[TimPelayanRoute] GET[id] error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    if (!caller.is_super_admin && !caller.permissions.includes('pelayan_manage')) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const timId = parseInt(id);
    const body = await request.json();
    const { nama_tim, deskripsi, is_active, anggota } = body;

    if (!nama_tim) {
      return NextResponse.json({ success: false, message: 'Nama tim wajib diisi.' }, { status: 400 });
    }

    const updated = await timPelayanRepository.update(timId, { nama_tim, deskripsi, is_active });
    if (anggota !== undefined) {
      await timPelayanRepository.syncAnggota(timId, anggota);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[TimPelayanRoute] PUT error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    if (!caller.is_super_admin && !caller.permissions.includes('pelayan_manage')) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const ok = await timPelayanRepository.delete(parseInt(id));
    if (!ok) return NextResponse.json({ success: false, message: 'Tim tidak ditemukan' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Tim berhasil dihapus.' });
  } catch (error) {
    console.error('[TimPelayanRoute] DELETE error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
