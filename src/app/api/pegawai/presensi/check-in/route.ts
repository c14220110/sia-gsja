import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { PresensiRepository } from '@/server/repositories/presensi.repository';
import { resolvePegawaiForCaller } from '@/server/utils/resolvePegawaiCaller';
import { findNearestSatelit } from '@/lib/geofence';
import { compareFaceEmbeddings } from '@/lib/faceCompare';
import { evaluateCheckInStatus, getTodayWibDateString } from '@/lib/presensiTime';
import { uploadBase64ImageToR2 } from '@/server/utils/r2Presensi';

const presensiRepository = new PresensiRepository();
const FACE_MATCH_THRESHOLD = 0.5;

export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { lat, lng, accuracy = 15, descriptor, photoBase64, pegawaiId: overridePegawaiId } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ success: false, message: 'Koordinat GPS tidak valid.' }, { status: 400 });
    }
    if (!Array.isArray(descriptor) || descriptor.length !== 1024) {
      return NextResponse.json({ success: false, message: 'Wajah tidak terdeteksi dengan jelas.' }, { status: 400 });
    }
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return NextResponse.json({ success: false, message: 'Selfie kamera langsung wajib diambil.' }, { status: 400 });
    }

    const pegawai = await resolvePegawaiForCaller(presensiRepository, caller, overridePegawaiId);
    if (!pegawai) {
      return NextResponse.json({ success: false, message: 'Data Pegawai tidak ditemukan.' }, { status: 404 });
    }

    if (!Array.isArray(pegawai.face_descriptor) || pegawai.face_descriptor.length !== 1024) {
      return NextResponse.json(
        { success: false, message: 'Wajah Anda belum terdaftar. Silakan daftar wajah terlebih dahulu.' },
        { status: 400 }
      );
    }

    const today = getTodayWibDateString();
    const existing = await presensiRepository.getPresensiByDate(pegawai.id, today);
    if (existing?.check_in_at) {
      return NextResponse.json({ success: false, message: 'Anda sudah melakukan Check-In hari ini.' }, { status: 409 });
    }

    const satelits = await presensiRepository.listActiveSatelit();
    const geo = findNearestSatelit(lat, lng, satelits);
    if (!geo.satelit || !geo.isWithinRadius) {
      const targetName = geo.satelit ? geo.satelit.nama_satelit : 'Kantor Gereja';
      const distLabel = Number.isFinite(geo.distanceMeters) ? `${geo.distanceMeters} m` : 'tidak diketahui';
      return NextResponse.json(
        {
          success: false,
          message: `Check-In ditolak: Anda berada di luar radius ${targetName} (jarak ${distLabel}). Harap Check-In dari area kantor/satelit GSJA.`,
        },
        { status: 400 }
      );
    }

    const { similarity } = compareFaceEmbeddings(pegawai.face_descriptor, descriptor.map(Number));
    if (similarity < FACE_MATCH_THRESHOLD) {
      return NextResponse.json(
        {
          success: false,
          message: `Verifikasi wajah gagal (${Math.round(similarity * 100)}% cocok). Pastikan pencahayaan cukup dan hadap langsung ke kamera.`,
        },
        { status: 400 }
      );
    }

    const photoUrl = await uploadBase64ImageToR2(photoBase64, 'selfies');
    const status = evaluateCheckInStatus(new Date());

    const record = await presensiRepository.recordCheckIn({
      pegawaiId: pegawai.id,
      tanggal: today,
      lat,
      lng,
      accuracy: Number(accuracy) || 15,
      distanceMeters: geo.distanceMeters,
      satelitId: geo.satelit.id,
      photoUrl,
      faceScore: similarity,
      status,
    });

    return NextResponse.json({
      success: true,
      data: { ...record, check_in_satelit_nama: geo.satelit.nama_satelit },
      message: `Check-In berhasil di ${geo.satelit.nama_satelit} (${status === 'TEPAT_WAKTU' ? 'Tepat Waktu' : 'Terlambat'}).`,
    });
  } catch (error) {
    console.error('[PresensiCheckIn] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
