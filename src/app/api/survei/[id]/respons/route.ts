import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (!caller.is_super_admin && !caller.permissions.includes('survei_view')) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin melihat survei' }, { status: 403 });
    }

    // Verify survei exists
    const surveiCheck = await pool.query(`SELECT id, is_anonim FROM public.survei WHERE id = $1`, [id]);
    if (surveiCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Survei tidak ditemukan' }, { status: 404 });
    }

    const isAnonim = surveiCheck.rows[0].is_anonim;

    // Keruk aja sekalian jawaban-jawabannya lengkap ama nama jemaat & isi tanyanya
    const query = `
      SELECT 
        sr.id AS respons_id,
        sr.survei_id,
        sr.pertanyaan_id,
        sr.jemaat_id,
        sr.skor,
        sr.jawaban_teks,
        sr.is_flagged,
        sr.created_at,
        sp.urutan,
        sp.teks_pertanyaan,
        sp.tipe_jawaban,
        ${isAnonim ? `'Anonim' AS nama_jemaat` : `COALESCE(j.nama_lengkap, 'N/A') AS nama_jemaat`}
      FROM public.survei_respons sr
      JOIN public.survei_pertanyaan sp ON sr.pertanyaan_id = sp.id
      ${isAnonim ? '' : 'LEFT JOIN public.jemaat j ON sr.jemaat_id = j.id'}
      WHERE sr.survei_id = $1
      ORDER BY sr.created_at DESC, sp.urutan ASC
    `;

    const result = await pool.query(query, [id]);

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.rows.length,
        is_anonim: isAnonim,
      },
    });
  } catch (error: any) {
    console.error('Error fetching survei respons:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const jemaatId = caller.jemaat_id;
  if (!jemaatId) {
    return NextResponse.json({ success: false, message: 'Jemaat ID tidak ditemukan pada akun Anda' }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const body = await request.json();
    const { jawaban } = body;

    if (!jawaban || !Array.isArray(jawaban) || jawaban.length === 0) {
      client.release();
      return NextResponse.json({ success: false, message: 'Jawaban wajib diisi' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Cross check dong: Surveinya ada kah? idup kah? Apa masuk dalam eranya?
    const surveiResult = await client.query(
      `SELECT id, is_active, periode_mulai, periode_selesai, threshold_flag, is_anonim
       FROM public.survei 
       WHERE id = $1`,
      [id]
    );
    if (surveiResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Survei tidak ditemukan' }, { status: 404 });
    }

    const survei = surveiResult.rows[0];
    if (!survei.is_active) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Survei ini sudah tidak aktif' }, { status: 400 });
    }

    // Cross check: periodenya emang ke-check kah?
    const periodCheck = await client.query(
      `SELECT CASE WHEN CURRENT_DATE BETWEEN $1 AND $2 THEN true ELSE false END AS is_valid`,
      [survei.periode_mulai, survei.periode_selesai]
    );
    if (!periodCheck.rows[0].is_valid) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Survei ini sudah melewati periode pengisian' }, { status: 400 });
    }

    // Tahan ganda: Jangan lupa ngintip apa jemaat ini udah ngumpulin kerjaannya belom
    const dupCheck = await client.query(
      `SELECT COUNT(*) FROM public.survei_respons WHERE survei_id = $1 AND jemaat_id = $2`,
      [id, jemaatId]
    );
    if (parseInt(dupCheck.rows[0].count, 10) > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Anda sudah pernah mengisi survei ini' }, { status: 409 });
    }

    const threshold = survei.threshold_flag || 3;

    // Insert each jawaban
    for (const j of jawaban) {
      const isFlagged = j.skor != null && j.skor < threshold;

      const responsResult = await client.query(
        `INSERT INTO public.survei_respons (survei_id, pertanyaan_id, jemaat_id, skor, jawaban_teks, is_flagged)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          id,
          j.pertanyaan_id,
          jemaatId,
          j.skor ?? null,
          j.jawaban_teks || null,
          isFlagged,
        ]
      );

      // Langsung gas bikin lanjuttan buat jawban yang ditandain merah
      if (isFlagged) {
        await client.query(
          `INSERT INTO public.survei_tindak_lanjut (respons_id, status, catatan_tindakan)
           VALUES ($1, 'Belum Ditangani', NULL)`,
          [responsResult.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Terima kasih! Jawaban survei Anda berhasil disimpan.',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error submitting survei respons:', error);
    return NextResponse.json({ success: false, message: 'Gagal menyimpan jawaban survei. Terjadi kesalahan server.' }, { status: 500 });
  } finally {
    client.release();
  }
}
