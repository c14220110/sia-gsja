import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { sendPushNotificationToJemaat } from '@/server/utils/pushNotification';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (!caller.is_super_admin && !caller.permissions.includes('survei_manage')) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
    }

    // 1. Check current status
    const check = await pool.query(
      `SELECT id, judul, status, satelit_id FROM public.survei WHERE id = $1`,
      [id]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Survei tidak ditemukan' }, { status: 404 });
    }

    const survei = check.rows[0];
    if (survei.status !== 'terjadwal') {
      return NextResponse.json({ 
        success: false, 
        message: `Survei tidak bisa dipublish karena statusnya "${survei.status}". Hanya survei Terjadwal yang bisa dipublish.` 
      }, { status: 400 });
    }

    // 2. Update status → aktif
    await pool.query(
      `UPDATE public.survei SET status = 'aktif', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // 3. Send push notifications to all jemaat in the satelit (async)
    let notifikasiTerkirim = 0;
    try {
      const jemaatRes = await pool.query(
        `SELECT j.id FROM public.jemaat j
         JOIN public.pengguna p ON j.id = p.jemaat_id
         WHERE j.satelit_id = $1 AND p.is_active = true`,
        [survei.satelit_id]
      );

      for (const row of jemaatRes.rows) {
        try {
          const sent = await sendPushNotificationToJemaat(
            row.id,
            '📋 Survei Baru Tersedia',
            `"${survei.judul}" — Mohon berikan penilaian Anda.`,
            '/survei-saya'
          );
          if (sent) notifikasiTerkirim++;
        } catch (pushErr) {
          console.error(`[Publish Survei] Gagal kirim ke Jemaat ID ${row.id}:`, pushErr);
        }
      }
    } catch (pushErr) {
      console.error('[Publish Survei] Error saat mengirim notifikasi:', pushErr);
    }

    return NextResponse.json({
      success: true,
      message: `Survei berhasil dipublish! ${notifikasiTerkirim} notifikasi terkirim.`,
    });
  } catch (error: any) {
    console.error('Error publishing survei:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
