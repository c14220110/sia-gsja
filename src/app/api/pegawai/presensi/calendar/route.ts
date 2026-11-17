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
    const monthParam = searchParams.get('month') || getTodayWibDateString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ success: false, message: 'Format bulan harus YYYY-MM.' }, { status: 400 });
    }

    const pegawaiIdParam = searchParams.get('pegawai_id');
    const overrideId = pegawaiIdParam ? Number(pegawaiIdParam) : null;
    const pegawai = await resolvePegawaiForCaller(presensiRepository, caller, overrideId);

    if (!pegawai) {
      return NextResponse.json({
        success: true,
        data: { month: monthParam, presensi: [], kunjungan: [] },
      });
    }

    const calendarData = await presensiRepository.getMonthlyCalendar(pegawai.id, monthParam);
    return NextResponse.json({
      success: true,
      data: {
        month: monthParam,
        ...calendarData,
      },
    });
  } catch (error) {
    console.error('[PresensiCalendar] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
