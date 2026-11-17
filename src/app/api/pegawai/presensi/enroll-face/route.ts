import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { PresensiRepository } from '@/server/repositories/presensi.repository';
import { resolvePegawaiForCaller } from '@/server/utils/resolvePegawaiCaller';
import { uploadBase64ImageToR2 } from '@/server/utils/r2Presensi';

const presensiRepository = new PresensiRepository();

export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { descriptor, photoBase64, pegawaiId: overridePegawaiId } = body;

    if (!Array.isArray(descriptor) || descriptor.length !== 1024) {
      return NextResponse.json(
        { success: false, message: 'Data vektor wajah tidak valid (harus 1024 dimensi).' },
        { status: 400 }
      );
    }
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      return NextResponse.json({ success: false, message: 'Foto wajah wajib diambil.' }, { status: 400 });
    }

    const pegawai = await resolvePegawaiForCaller(presensiRepository, caller, overridePegawaiId);
    if (!pegawai) {
      return NextResponse.json(
        { success: false, message: 'Akun Anda belum terhubung dengan data Pegawai.' },
        { status: 404 }
      );
    }

    const photoUrl = await uploadBase64ImageToR2(photoBase64, 'enroll');
    await presensiRepository.saveFaceEnrollment(pegawai.id, descriptor.map(Number), photoUrl);

    return NextResponse.json({
      success: true,
      data: { face_photo_url: photoUrl },
      message: 'Wajah berhasil didaftarkan untuk verifikasi presensi.',
    });
  } catch (error) {
    console.error('[PresensiEnrollFace] POST error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mendaftarkan wajah' }, { status: 500 });
  }
}
