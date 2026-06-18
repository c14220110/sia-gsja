import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { notifySekretarisCsatFlagged } from '@/lib/notificationService';

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      client.release();
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const jemaatId = caller.jemaat_id;
    if (!jemaatId) {
      client.release();
      return NextResponse.json({ success: false, message: 'Jemaat ID tidak ditemukan' }, { status: 400 });
    }

    const body = await request.json();
    const { survei_id, jawaban } = body;

    if (!survei_id || !jawaban || !Array.isArray(jawaban) || jawaban.length === 0) {
      client.release();
      return NextResponse.json({ success: false, message: 'Data survei tidak lengkap' }, { status: 400 });
    }

    // Validasi survei masih ada nafasnya dan posisinya emang nyala aktif ya
    const surveiCheck = await client.query(
      `SELECT id, threshold_flag, is_anonim, is_active, status
       FROM public.survei WHERE id = $1`,
      [survei_id]
    );
    if (surveiCheck.rows.length === 0) {
      client.release();
      return NextResponse.json({ success: false, message: 'Survei tidak ditemukan' }, { status: 404 });
    }

    const survei = surveiCheck.rows[0];
    if (survei.status !== 'aktif') {
      client.release();
      return NextResponse.json({ success: false, message: 'Survei ini sudah tidak menerima respons' }, { status: 400 });
    }

    // Liat lagi udah ada isi belum dari jemaatnya (Pokoknya patokan tetep pake ID aslinya biar ga ganda,
    // walau dia maen rahasia anonim juga tetep di cegat double kirimannya)
    const existingCheck = await client.query(
      `SELECT id FROM public.survei_respons WHERE survei_id = $1 AND jemaat_id = $2 LIMIT 1`,
      [survei_id, jemaatId]
    );
    if (existingCheck.rows.length > 0) {
      client.release();
      return NextResponse.json({ success: false, message: 'Anda sudah mengisi survei ini sebelumnya' }, { status: 409 });
    }

    const thresholdFlag = parseFloat(survei.threshold_flag) || 4;

    await client.query('BEGIN');

    for (const j of jawaban) {
      const { pertanyaan_id, skor, jawaban_teks } = j;
      const isFlagged = skor != null && skor < thresholdFlag;

      // Setor jemaat_id murni tanpa kompromi demi deduplikasi. Nah, anonimitasnya biarin diatur pas bagian displaynya aja ntar.
      const insertResult = await client.query(
        `INSERT INTO public.survei_respons (survei_id, pertanyaan_id, jemaat_id, skor, jawaban_teks, is_flagged)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          survei_id,
          pertanyaan_id,
          jemaatId,
          skor || null,
          jawaban_teks || null,
          isFlagged,
        ]
      );

      // Ngalir aja auto buatin riwayat lanjuttan buat jawaban nyeleneh (flagged)
      if (isFlagged && insertResult.rows.length > 0) {
        await client.query(
          `INSERT INTO public.survei_tindak_lanjut (respons_id) VALUES ($1)`,
          [insertResult.rows[0].id]
        );

        // Gas lepasin lsg (Fire n forget): hujani email ke sekretariat pusat semua sprti pola notifikasin pastoral biasa.
        pool.query(`
          SELECT DISTINCT p.email, j.nama_lengkap as nama_jemaat,
            sv.judul as survei_judul, sv.is_anonim,
            COALESCE(kg.nama_kegiatan, sv.judul) as nama_kegiatan,
            sv.id as survei_id
          FROM public.survei sv
          LEFT JOIN public.kegiatan kg ON kg.id = sv.kegiatan_id
          LEFT JOIN public.jemaat j ON j.id = $1
          CROSS JOIN (
            SELECT p2.email FROM public.pengguna p2
            JOIN public.user_role ur ON ur.user_id = p2.id AND ur.is_active = true
            JOIN public.role r ON r.id = ur.role_id
            WHERE r.nama_role = 'SEKRETARIS_PUSAT'
            AND p2.is_active = true AND p2.email IS NOT NULL AND p2.email LIKE '%@%'
          ) p
          WHERE sv.id = $2
        `, [jemaatId, survei_id]).then(notifRes => {
          if (notifRes.rows.length === 0) return;
          const row = notifRes.rows[0];
          const emails = notifRes.rows.map((r: any) => r.email as string).filter(Boolean);
          notifySekretarisCsatFlagged(emails, {
            survei_judul: row.survei_judul,
            nama_kegiatan: row.nama_kegiatan,
            skor: skor,
            threshold: thresholdFlag,
            jawaban_teks: jawaban_teks || null,
            nama_jemaat: row.is_anonim ? 'Anonim' : (row.nama_jemaat || 'Jemaat'),
            survei_id: row.survei_id,
          });
        }).catch(e => console.error('[CSAT Notif] Gagal fetch data untuk notifikasi:', e));
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Terima kasih! Respons Anda telah berhasil dikirim.',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('API Error [POST /survei/saya/submit]:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengirim survei. Silakan coba lagi.' }, { status: 500 });
  } finally {
    client.release();
  }
}
