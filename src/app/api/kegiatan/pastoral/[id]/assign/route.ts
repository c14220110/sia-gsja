import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { notifyMajelisPastoralDitugaskan } from '@/lib/notificationService';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || caller.role_name?.toLowerCase() === 'jemaat') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Izin: cuma SEKRETARIS_PUSAT (sama SUPER_ADMIN) yang dikasih wewenang buat nge-assign
    const callerRole = (caller.role_name || '').toUpperCase();
    if (!['SEKRETARIS_PUSAT', 'SUPER_ADMIN'].includes(callerRole)) {
      return NextResponse.json({ success: false, message: 'Hanya Sekretaris Pusat yang dapat menugaskan penanggung jawab.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { pengguna_id, tanggal_fix, waktu_fix } = body;

    if (!pengguna_id) {
      return NextResponse.json({ success: false, message: 'ID Penanggung Jawab wajib diisi!' }, { status: 400 });
    }
    if (!tanggal_fix || !waktu_fix) {
      return NextResponse.json({ success: false, message: 'Tanggal dan Waktu Fix wajib diisi!' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get current ticket info
      const checkRes = await client.query(`
        SELECT 
          p.status_permohonan,
          p.jemaat_pemohon_id,
          p.nomor_tiket,
          p.no_hp_kontak,
          p.keterangan,
          p.is_urgent,
          p.untuk_siapa,
          p.nama_target_luar,
          p.waktu_diterima,
          pemohon.nama_lengkap as nama_pemohon,
          jk.nama_jenis_kegiatan,
          CASE 
            WHEN p.untuk_siapa = 'Saya Sendiri' THEN pemohon.nama_lengkap
            WHEN jt.nama_lengkap IS NOT NULL THEN jt.nama_lengkap
            ELSE p.nama_target_luar
          END as target_pelayanan
        FROM public.permohonan_layanan_pastoral p
        JOIN public.jemaat pemohon ON p.jemaat_pemohon_id = pemohon.id
        LEFT JOIN public.jenis_kegiatan jk ON p.jenis_kegiatan_id = jk.id
        LEFT JOIN public.jemaat jt ON jt.id = p.jemaat_target_id
        WHERE p.id = $1
      `, [id]);

      if (checkRes.rows.length === 0) throw new Error('Tiket tidak ditemukan');
      const ticket = checkRes.rows[0];
      const statusSebelumnya = ticket.status_permohonan;

      // 2. Validasi pengguna memiliki role MAJELIS / GEMBALA_SIDANG / GEMBALA_SATELIT
      const pjRes = await client.query(`
        SELECT pn.id, j.nama_lengkap, pn.email
        FROM public.pengguna pn
        JOIN public.jemaat j ON j.id = pn.jemaat_id
        JOIN public.user_role ur ON ur.user_id = pn.id
        JOIN public.role r ON r.id = ur.role_id
        WHERE pn.id = $1
          AND pn.is_active = true
          AND r.nama_role IN ('MAJELIS', 'GEMBALA_SIDANG', 'GEMBALA_SATELIT')
          AND ur.is_active = true
          AND (ur.tanggal_selesai IS NULL OR ur.tanggal_selesai >= CURRENT_DATE)
        LIMIT 1
      `, [pengguna_id]);

      if (pjRes.rows.length === 0) {
        throw new Error('Penanggung jawab tidak valid atau tidak memiliki role Majelis/Gembala yang aktif');
      }
      const pj = pjRes.rows[0];

      // 3. Update tiket pastoral
      await client.query(`
        UPDATE public.permohonan_layanan_pastoral
        SET 
          penanggung_jawab_id = $1,
          status_permohonan = 'Ditugaskan',
          waktu_ditugaskan = CURRENT_TIMESTAMP,
          jadwal_tanggal = $2,
          jadwal_waktu = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [pengguna_id, tanggal_fix, waktu_fix, id]);

      // 4. Audit Log
      await client.query(`
        INSERT INTO public.permohonan_layanan_audit_log 
        (permohonan_id, status_sebelumnya, status_baru, diubah_oleh_id, catatan_perubahan)
        VALUES ($1, $2, 'Ditugaskan', $3, $4)
      `, [id, statusSebelumnya, caller.user_id,
          `Ditugaskan kepada ${pj.nama_lengkap}, jadwal: ${tanggal_fix} pukul ${waktu_fix.substring(0, 5)} WIB`]);

      await client.query('COMMIT');

      // 5. Push Notification ke Jemaat pemohon (fire-and-forget)
      try {
        const { sendPushNotificationToJemaat } = await import('@/server/utils/pushNotification');
        const formattedDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(tanggal_fix));
        const formattedTime = waktu_fix.substring(0, 5);
        await sendPushNotificationToJemaat(
          ticket.jemaat_pemohon_id,
          'Layanan Pastoral Dijadwalkan',
          `Permohonan Anda telah dijadwalkan pada ${formattedDate} pukul ${formattedTime} WIB. PJ: ${pj.nama_lengkap}.`,
          `/layanan-pastoral/${id}`
        );
      } catch (e) {
        console.error('[Pastoral Assign] Gagal push notification:', e);
      }

      // 6. Email ke PJ yang ditugaskan (fire-and-forget)
      if (pj.email && pj.email.includes('@')) {
        notifyMajelisPastoralDitugaskan(pj.email, pj.nama_lengkap, {
          id: Number(id),
          nomor_tiket: ticket.nomor_tiket,
          jenis_layanan: ticket.nama_jenis_kegiatan,
          target_pelayanan: ticket.target_pelayanan,
          nama_pemohon: ticket.nama_pemohon,
          no_hp_kontak: ticket.no_hp_kontak,
          keterangan: ticket.keterangan || undefined,
          is_urgent: !!ticket.is_urgent,
          waktu_diterima: ticket.waktu_diterima?.toISOString?.() || String(ticket.waktu_diterima),
          tanggal_fix,
          waktu_fix,
        });
      }

      return NextResponse.json({ success: true, message: 'Penanggung Jawab berhasil ditugaskan' });

    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.message === 'Tiket tidak ditemukan') {
        return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
      }
      if (err.message.includes('tidak valid') || err.message.includes('tidak memiliki role')) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      throw err;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('API Error [PATCH /kegiatan/pastoral/[id]/assign]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal', error: error.message }, { status: 500 });
  }
}
