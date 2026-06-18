import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { sendPushNotificationToJemaat } from '@/server/utils/pushNotification';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('survei_manage')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin mengelola survei' }, { status: 403 });
  }

  try {
    // 1. Ambil data survei
    const surveiRes = await pool.query(
      `SELECT s.id, s.judul, s.satelit_id, s.is_active, s.periode_mulai, s.periode_selesai, s.kegiatan_id
       FROM public.survei s
       WHERE s.id = $1`,
      [id]
    );
    if (surveiRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Survei tidak ditemukan' }, { status: 404 });
    }

    const survei = surveiRes.rows[0];

    // 2. Validasi: survei harus aktif dan dalam periode
    if (!survei.is_active) {
      return NextResponse.json({ success: false, message: 'Survei ini sudah tidak aktif' }, { status: 400 });
    }
    const periodCheck = await pool.query(
      `SELECT CASE WHEN CURRENT_DATE BETWEEN $1 AND $2 THEN true ELSE false END AS is_valid`,
      [survei.periode_mulai, survei.periode_selesai]
    );
    if (!periodCheck.rows[0].is_valid) {
      return NextResponse.json({ success: false, message: 'Survei ini sudah di luar periode pengisian' }, { status: 400 });
    }

    // Satpam: periksa nih kepemilikan si satelit
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (survei.satelit_id && survei.satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Akses ditolak: survei bukan milik satelit Anda' }, { status: 403 });
      }
    }

    // 3. Tentukan target jemaat
    let jemaatIds: number[] = [];

    if (survei.kegiatan_id) {
      // Survei terkait kegiatan → kirim ke jemaat yang hadir saja
      const absensiRes = await pool.query(
        `SELECT DISTINCT jemaat_id 
         FROM public.kegiatan_absensi 
         WHERE kegiatan_id = $1 AND jemaat_id IS NOT NULL`,
        [survei.kegiatan_id]
      );
      jemaatIds = absensiRes.rows.map((r: any) => r.jemaat_id);
    } else {
      // Mandiri beraksi survei: serbarkan segenap isinya ke semua jemaat satelit ini
      const jemaatRes = await pool.query(
        `SELECT j.id 
         FROM public.jemaat j
         WHERE j.status_keanggotaan = 'Aktif' 
           AND ($1::integer IS NULL OR j.satelit_id = $1)`,
        [survei.satelit_id]
      );
      jemaatIds = jemaatRes.rows.map((r: any) => r.id);
    }

    if (jemaatIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada jemaat yang memenuhi kriteria untuk menerima notifikasi.',
        data: { terkirim: 0, target: 0 },
      });
    }

    // 4. Filter jemaat yang sudah mengisi (jangan kirim ke mereka)
    const respondedRes = await pool.query(
      `SELECT DISTINCT jemaat_id FROM public.survei_respons WHERE survei_id = $1`,
      [id]
    );
    const respondedSet = new Set(respondedRes.rows.map((r: any) => r.jemaat_id));
    const filteredIds = jemaatIds.filter(jId => !respondedSet.has(jId));

    if (filteredIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Semua jemaat target sudah mengisi survei ini. Tidak ada notifikasi yang dikirim.',
        data: { terkirim: 0, target: jemaatIds.length, sudah_mengisi: respondedSet.size },
      });
    }

    // 5. Kirim push notification
    let terkirim = 0;
    for (const jemaatId of filteredIds) {
      try {
        await sendPushNotificationToJemaat(
          jemaatId,
          '📋 Survei Baru Tersedia',
          `Kami butuh masukan Anda: "${survei.judul}". Isi survei sekarang!`,
          '/'
        );
        terkirim++;
      } catch (pushErr) {
        console.error(`[SurveiPush] Gagal kirim ke Jemaat ID ${jemaatId}:`, pushErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Notifikasi berhasil dikirim ke ${terkirim} dari ${filteredIds.length} jemaat.`,
      data: { terkirim, target: filteredIds.length, sudah_mengisi: respondedSet.size },
    });
  } catch (error: any) {
    console.error('API Error [POST /survei/[id]/push]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
