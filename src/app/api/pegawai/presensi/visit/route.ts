import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { PresensiRepository } from '@/server/repositories/presensi.repository';
import { resolvePegawaiForCaller } from '@/server/utils/resolvePegawaiCaller';
import { getTodayWibDateString } from '@/lib/presensiTime';
import { uploadBase64ImageToR2 } from '@/server/utils/r2Presensi';

const presensiRepository = new PresensiRepository();

export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      kategori = 'Pelayanan Pastoral',
      satelitTujuanId,
      lokasiBebas,
      lat,
      lng,
      accuracy = 15,
      photoBase64,
      notes,
      pegawaiId: overridePegawaiId,
    } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ success: false, message: 'Koordinat GPS wajib aktif.' }, { status: 400 });
    }
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return NextResponse.json({ success: false, message: 'Selfie lokasi kunjungan wajib diambil.' }, { status: 400 });
    }
    if (!notes || !String(notes).trim()) {
      return NextResponse.json({ success: false, message: 'Catatan aktivitas kunjungan wajib diisi.' }, { status: 400 });
    }
    if (!satelitTujuanId && (!lokasiBebas || !String(lokasiBebas).trim())) {
      return NextResponse.json({ success: false, message: 'Pilih satelit tujuan atau isi lokasi kunjungan.' }, { status: 400 });
    }

    const pegawai = await resolvePegawaiForCaller(presensiRepository, caller, overridePegawaiId);
    if (!pegawai) {
      return NextResponse.json({ success: false, message: 'Data Pegawai tidak ditemukan.' }, { status: 404 });
    }

    const today = getTodayWibDateString();
    const existingPresensi = await presensiRepository.getPresensiByDate(pegawai.id, today);
    if (!existingPresensi?.check_in_at) {
      return NextResponse.json(
        { success: false, message: 'Silakan Check-In terlebih dahulu sebelum mencatat kunjungan.' },
        { status: 400 }
      );
    }

    // Visit tetap boleh ditambahkan meskipun pegawai sudah Check-Out (kunjungan di luar jam kerja)
    const selfieUrl = await uploadBase64ImageToR2(photoBase64, 'visits');
    const created = await presensiRepository.addKunjungan({
      presensiId: existingPresensi.id,
      pegawaiId: pegawai.id,
      tanggal: today,
      kategori: String(kategori).trim(),
      satelitTujuanId: satelitTujuanId ? Number(satelitTujuanId) : null,
      lokasiBebas: lokasiBebas ? String(lokasiBebas).trim() : null,
      lat,
      lng,
      gpsAccuracy: Number(accuracy) || 15,
      selfieUrl,
      notes: String(notes).trim(),
    });

    return NextResponse.json({
      success: true,
      data: created,
      message: 'Kunjungan pastoral berhasil dicatat.',
    });
  } catch (error) {
    console.error('[PresensiVisit] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
