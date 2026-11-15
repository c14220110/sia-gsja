import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { PresensiRepository } from '@/server/repositories/presensi.repository';
import { getTodayWibDateString } from '@/lib/presensiTime';

const presensiRepository = new PresensiRepository();

export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Forbidden: Khusus Super Admin' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tanggal = searchParams.get('date') || getTodayWibDateString();
    const roleId = searchParams.get('role_id') ? Number(searchParams.get('role_id')) : undefined;
    const satelitId = searchParams.get('satelit_id') ? Number(searchParams.get('satelit_id')) : undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search')?.trim() || undefined;

    const result = await presensiRepository.getMonitoringByDate({
      tanggal,
      roleId,
      satelitId,
      status,
      search,
    });

    return NextResponse.json({
      success: true,
      data: {
        date: tanggal,
        ...result,
      },
    });
  } catch (error) {
    console.error('[PresensiMonitoring] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Forbidden: Khusus Super Admin' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'reset_face') {
      const pegawaiId = Number(body.pegawaiId);
      if (!pegawaiId) {
        return NextResponse.json({ success: false, message: 'pegawaiId wajib diisi' }, { status: 400 });
      }
      await presensiRepository.resetFaceEnrollment(pegawaiId);
      return NextResponse.json({ success: true, message: 'Face ID pegawai berhasil direset.' });
    }

    if (action === 'update_satelit_gps') {
      const satelitId = Number(body.satelitId);
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const radiusMeter = Math.max(20, Math.min(5000, Number(body.radiusMeter) || 100));
      const gpsLocation = body.gpsLocation ? String(body.gpsLocation) : undefined;

      if (!satelitId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return NextResponse.json(
          { success: false, message: 'Satelit, latitude, dan longitude harus valid.' },
          { status: 400 }
        );
      }

      const updated = await presensiRepository.updateSatelitGeofence(
        satelitId,
        latitude,
        longitude,
        radiusMeter,
        gpsLocation
      );
      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Lokasi GPS & radius satelit berhasil diperbarui.',
      });
    }

    return NextResponse.json({ success: false, message: 'Action tidak dikenal' }, { status: 400 });
  } catch (error) {
    console.error('[PresensiMonitoring] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
