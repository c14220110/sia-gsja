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
      data = await masterService.searchJemaatOptions(q);
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
