import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { PresensiRepository } from '@/server/repositories/presensi.repository';
import { resolvePegawaiForCaller } from '@/server/utils/resolvePegawaiCaller';
import { getTodayWibDateString } from '@/lib/presensiTime';

const presensiRepository = new PresensiRepository();

export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const pegawaiIdParam = searchParams.get('pegawai_id');
    const overrideId = pegawaiIdParam ? Number(pegawaiIdParam) : null;

    const [pegawai, satelits] = await Promise.all([
      resolvePegawaiForCaller(presensiRepository, caller, overrideId),
      presensiRepository.listActiveSatelit(),
    ]);

    const today = getTodayWibDateString();
    if (!pegawai) {
      const canPreviewAll =
        caller.is_super_admin ||
        caller.permissions.includes('presensi_monitoring_view') ||
        caller.permissions.includes('presensi_monitoring_manage');
      const availablePegawai = canPreviewAll
        ? (await presensiRepository.listActivePegawaiSimple()).map((p) => ({
            id: p.id,
            id_pegawai: p.id_pegawai,
            nama_lengkap: p.nama_lengkap,
            nama_satelit: p.nama_satelit,
          }))
        : [];
      return NextResponse.json({
        success: true,
        data: {
          pegawai: null,
          isFaceEnrolled: false,
          today,
          presensi: null,
          visits: [],
          satelits,
          availablePegawai,
        },
      });
    }

    const [presensi, visits] = await Promise.all([
      presensiRepository.getPresensiByDate(pegawai.id, today),
      presensiRepository.getKunjunganByDate(pegawai.id, today),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pegawai: {
          id: pegawai.id,
          id_pegawai: pegawai.id_pegawai,
          nama_lengkap: pegawai.nama_lengkap,
          satelit_id: pegawai.satelit_id,
          nama_satelit: pegawai.nama_satelit,
          nama_jabatan: pegawai.nama_jabatan,
          nama_departemen: pegawai.nama_departemen,
          face_photo_url: pegawai.face_photo_url,
          face_enrolled_at: pegawai.face_enrolled_at,
        },
        isFaceEnrolled: Array.isArray(pegawai.face_descriptor) && pegawai.face_descriptor.length === 1024,
        today,
        presensi,
        visits,
        satelits,
      },
    });
  } catch (error) {
    console.error('[PresensiToday] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
