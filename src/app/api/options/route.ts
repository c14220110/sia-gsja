import { NextResponse } from 'next/server';
import { MasterRepository } from '@/server/repositories/master.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

const masterRepository = new MasterRepository();

export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    let data;

    if (!type) {
      return NextResponse.json({ success: false, message: 'Invalid type parameter' }, { status: 400 });
    }

    if (type === 'satelit') {
      data = await masterRepository.getAllSatelit();
    } else if (type === 'komisi') {
      const satelitIdStr = searchParams.get('satelit_id') || undefined;
      if (satelitIdStr) {
        data = await masterRepository.getKomisiBySatelit(parseInt(satelitIdStr, 10));
      } else {
        data = await masterRepository.getAllKomisi();
      }
    } else if (type === 'jemaat_search') {
      const q = searchParams.get('q') || '';
      const onlyActive = searchParams.get('only_active') === 'true';
      data = await masterRepository.searchJemaat(q, onlyActive);
    } else if (type === 'pelayan_search') {
      const q = searchParams.get('q') || '';
      const roleId = searchParams.get('role_id') || undefined;
      const kegiatanId = searchParams.get('kegiatan_id') || undefined;
      data = await masterRepository.searchPelayan(q, roleId, kegiatanId);
    } else if (type === 'departemen') {
      data = await masterRepository.getAllDepartemen();
    } else if (type === 'pekerjaan') {
      data = await masterRepository.getAllPekerjaan();
    } else if (type === 'role_pelayan') {
      data = await masterRepository.getAllRolePelayan();
    } else if (type === 'jabatan') {
      data = await masterRepository.getAllJabatan();
    } else if (type === 'periode_kepengurusan') {
      data = await masterRepository.getAllPeriodeKepengurusan();
    } else if (type === 'jenis_kegiatan') {
      data = await masterRepository.getAllJenisKegiatan(); // returns butuh_permohonan = false only
    } else if (type === 'jenis_kegiatan_pastoral') {
      data = await masterRepository.getAllJenisKegiatanPastoral(); // returns butuh_permohonan = true only
    } else if (type === 'pengurus') {
      data = await masterRepository.getAllPengurus();
    } else if (type === 'jabatan_pegawai') {
      data = await masterRepository.getAllJabatanPegawai();
    } else if (type === 'bank') {
      data = await masterRepository.getAllBank();
    } else if (type === 'ra_approved') {
      // Ambil caller untuk filter satelit (non super admin hanya bisa lihat RA milik satelitnya)
      const caller = getCallerFromRequest(request);
      if (!caller) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      const satelitFilter = (!caller.is_super_admin && !caller.permissions?.includes('multi_satelit_view'))
        ? caller.satelit_id
        : null;
      data = await masterRepository.getApprovedAnggaranOptions(satelitFilter);

    } else {
      return NextResponse.json({ success: false, message: 'Invalid type parameter' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengambil opsi ${type}`,
      data
    });
  } catch (error: any) {
    console.error('GET /api/options error:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan pada server saat mengambil opsi.',
      error: error.message
    }, { status: 500 });
  }
}
