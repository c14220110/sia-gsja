import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

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

    // Check survei exists and is active
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

    // Check if jemaat already responded (always use real jemaatId for duplicate detection,
    // even for anonim surveys — prevents re-submission)
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

      // Always store jemaat_id for dedup & filtering. Anonymity enforced at display layer.
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

      // Auto-create tindak_lanjut for flagged responses
      if (isFlagged && insertResult.rows.length > 0) {
        await client.query(
          `INSERT INTO public.survei_tindak_lanjut (respons_id) VALUES ($1)`,
          [insertResult.rows[0].id]
        );
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
