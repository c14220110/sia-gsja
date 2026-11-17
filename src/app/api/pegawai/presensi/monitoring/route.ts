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

    if (action === 'admin_save_presensi') {
      const pegawaiId = Number(body.pegawaiId);
      const tanggal = String(body.tanggal || '').trim();
      if (!pegawaiId || !tanggal) {
        return NextResponse.json({ success: false, message: 'pegawaiId dan tanggal wajib diisi' }, { status: 400 });
      }
      const toWibTimestamptz = (timeStr?: string | null) => {
        if (!timeStr || !timeStr.trim()) return null;
        const clean = timeStr.trim();
        // Accept HH:MM or full ISO
        if (/^\d{2}:\d{2}$/.test(clean)) {
          return `${tanggal}T${clean}:00+07:00`;
        }
        return clean;
      };
      const checkInAt = toWibTimestamptz(body.checkInTime);
      const checkOutAt = toWibTimestamptz(body.checkOutTime);
      const checkInStatus = body.checkInStatus === 'TERLAMBAT' ? 'TERLAMBAT' : 'TEPAT_WAKTU';
      const overviewNote = body.overviewNote ? String(body.overviewNote) : null;
      const reason = body.reason ? String(body.reason) : undefined;
      const actorName = await presensiRepository.getActorDisplayName(caller.user_id);

      const saved = await presensiRepository.adminUpsertPresensi({
        pegawaiId,
        tanggal,
        checkInAt,
        checkOutAt,
        checkInStatus,
        overviewNote,
        actorUserId: caller.user_id,
        actorName,
        reason,
      });

      return NextResponse.json({
        success: true,
        data: saved,
        message: 'Data presensi berhasil diperbarui dan dicatat di Chatter.',
      });
    }

    if (action === 'admin_delete_presensi') {
      const pegawaiId = Number(body.pegawaiId);
      const tanggal = String(body.tanggal || '').trim();
      if (!pegawaiId || !tanggal) {
        return NextResponse.json({ success: false, message: 'pegawaiId dan tanggal wajib diisi' }, { status: 400 });
      }
      const actorName = await presensiRepository.getActorDisplayName(caller.user_id);
      const deleted = await presensiRepository.adminHardDeletePresensi({
        pegawaiId,
        tanggal,
        actorUserId: caller.user_id,
        actorName,
        reason: body.reason ? String(body.reason) : undefined,
      });
      if (!deleted) {
        return NextResponse.json({ success: false, message: 'Data presensi tidak ditemukan untuk dihapus.' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: 'Data presensi berhasil dihapus permanen (Hard Delete). Pegawai kini dapat Check-In ulang.',
      });
    }

    if (action === 'add_chatter_note') {
      const pegawaiId = Number(body.pegawaiId);
      const tanggal = String(body.tanggal || '').trim();
      const message = String(body.message || '').trim();
      const presensiId = body.presensiId ? Number(body.presensiId) : null;
      if (!pegawaiId || !tanggal || !message) {
        return NextResponse.json({ success: false, message: 'Catatan chatter tidak boleh kosong.' }, { status: 400 });
      }
      const actorName = await presensiRepository.getActorDisplayName(caller.user_id);
      const note = await presensiRepository.addChatterNote({
        pegawaiId,
        tanggal,
        presensiId,
        actorUserId: caller.user_id,
        actorName,
        message,
      });
      return NextResponse.json({
        success: true,
        data: note,
        message: 'Log note berhasil ditambahkan ke Chatter.',
      });
    }

    return NextResponse.json({ success: false, message: 'Action tidak dikenal' }, { status: 400 });
  } catch (error) {
    console.error('[PresensiMonitoring] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
