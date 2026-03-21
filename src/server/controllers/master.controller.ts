import { NextResponse } from 'next/server';
import * as masterService from '@/server/services/master.service';

export async function getOptionsController(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    let data;

    if (!type) {
      return NextResponse.json({ success: false, message: 'Invalid type parameter' }, { status: 400 });
    }

    if (type === 'satelit') {
      data = await masterService.getSatelitOptions();
    } else if (type === 'komisi') {
      const satelitId = searchParams.get('satelit_id') || undefined;
      data = await masterService.getKomisiOptions(satelitId);
    } else if (type === 'jemaat_search') {
      const q = searchParams.get('q') || '';
      const onlyActive = searchParams.get('only_active') === 'true';
      data = await masterService.searchJemaatOptions(q, onlyActive);
    } else if (type === 'departemen') {
      data = await masterService.getDepartemenOptions();
    } else if (type === 'pekerjaan') {
      data = await masterService.getPekerjaanOptions();
    } else if (type === 'role_pelayan') {
      data = await masterService.getRolePelayanOptions();
    } else if (type === 'jabatan') {
      data = await masterService.getJabatanOptions();
    } else if (type === 'periode_kepengurusan') {
      data = await masterService.getPeriodeKepengurusanOptions();
    } else if (type === 'jenis_kegiatan') {
      data = await masterService.getJenisKegiatanOptions();
    } else if (type === 'pengurus') {
      data = await masterService.getPengurusOptions();
    } else {
      return NextResponse.json({ success: false, message: 'Invalid type parameter' }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Berhasil mengambil opsi ${type}`,
      data
    });
  } catch (error: any) {
    console.error('getOptionsController error:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan pada server saat mengambil opsi.',
      error: error.message
    }, { status: 500 });
  }
}
