import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { PresensiRepository } from '@/server/repositories/presensi.repository';
import { resolvePegawaiForCaller } from '@/server/utils/resolvePegawaiCaller';
import { getTodayWibDateString } from '@/lib/presensiTime';
import { uploadFileToR2 } from '@/server/utils/r2Presensi';

const presensiRepository = new PresensiRepository();

export async function PUT(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const overviewNote = String(formData.get('overview_note') || '').trim();
    const file = formData.get('attachment') as File | null;
    const overridePegawaiIdRaw = formData.get('pegawai_id');
    const overridePegawaiId = overridePegawaiIdRaw ? Number(overridePegawaiIdRaw) : null;

    if (!overviewNote && (!file || file.size === 0)) {
      return NextResponse.json(
        { success: false, message: 'Isi catatan overview atau pilih lampiran terlebih dahulu.' },
        { status: 400 }
      );
    }

    const pegawai = await resolvePegawaiForCaller(presensiRepository, caller, overridePegawaiId);
    if (!pegawai) {
      return NextResponse.json({ success: false, message: 'Data Pegawai tidak ditemukan.' }, { status: 404 });
    }

    const today = getTodayWibDateString();
    const existing = await presensiRepository.getPresensiByDate(pegawai.id, today);
    if (!existing?.check_in_at) {
      return NextResponse.json(
        { success: false, message: 'Silakan Check-In terlebih dahulu sebelum mengisi overview harian.' },
        { status: 400 }
      );
    }

    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    if (file && file.size > 0) {
      attachmentUrl = await uploadFileToR2(file, 'attachments');
      attachmentName = file.name;
    }

    const updated = await presensiRepository.updateOverview({
      presensiId: existing.id,
      overviewNote: overviewNote || existing.overview_note || null,
      attachmentUrl,
      attachmentName,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Catatan & lampiran overview harian berhasil disimpan.',
    });
  } catch (error: any) {
    console.error('[PresensiOverview] PUT error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal menyimpan overview harian' },
      { status: 500 }
    );
  }
}
