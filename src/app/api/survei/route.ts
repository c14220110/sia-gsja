import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (!caller.is_super_admin && !caller.permissions.includes('survei_view')) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin melihat survei' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'semua';
    const satelitId = searchParams.get('satelit_id') || '';
    const tipeSurvei = searchParams.get('tipe_survei') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let whereClauses: string[] = [];
    let values: any[] = [];
    let paramIndex = 1;

    // 1. Search by judul
    if (search) {
      whereClauses.push(`s.judul ILIKE $${paramIndex}`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    // 2. Status filter (using status column)
    if (status === 'aktif') {
      whereClauses.push(`s.status = 'aktif'`);
    } else if (status === 'selesai') {
      whereClauses.push(`(s.status = 'selesai' OR (s.status = 'aktif' AND CURRENT_DATE > s.periode_selesai))`);
    } else if (status === 'terjadwal') {
      whereClauses.push(`s.status = 'terjadwal'`);
    } else if (status === 'nonaktif') {
      whereClauses.push(`s.status = 'nonaktif'`);
    }
    // 'semua' → no status filter

    // 3. Satelit RBAC
    let finalSatelitId = satelitId;
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      finalSatelitId = caller.satelit_id?.toString() || '';
    }
    if (finalSatelitId) {
      whereClauses.push(`s.satelit_id = $${paramIndex}`);
      values.push(finalSatelitId);
      paramIndex++;
    }

    // 4. Tipe Survei filter
    if (tipeSurvei) {
      whereClauses.push(`s.tipe_survei = $${paramIndex}`);
      values.push(tipeSurvei);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Totalan itungan buat bantu paginasinya dong
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM public.survei s ${whereString}`,
      values
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Sedot data hasil campuran JOIN + statistik itungan subquery-nya lho
    const query = `
      SELECT 
        s.id,
        s.judul,
        s.deskripsi,
        s.kegiatan_id,
        s.satelit_id,
        s.periode_mulai,
        s.periode_selesai,
        s.is_active,
        s.is_anonim,
        s.threshold_flag,
        s.tipe_survei,
        s.status,
        s.created_by,
        s.created_at,
        s.updated_at,
        kg.nama_kegiatan,
        sat.nama_satelit,
        p.email AS created_by_email,
        (SELECT COUNT(DISTINCT sr.jemaat_id) FROM public.survei_respons sr WHERE sr.survei_id = s.id) AS total_responden,
        (SELECT COALESCE(ROUND(AVG(sr.skor)::numeric, 2), 0) FROM public.survei_respons sr WHERE sr.survei_id = s.id AND sr.skor IS NOT NULL) AS rata_rata_skor
      FROM public.survei s
      LEFT JOIN public.kegiatan kg ON s.kegiatan_id = kg.id
      LEFT JOIN public.satelit sat ON s.satelit_id = sat.id
      LEFT JOIN public.pengguna p ON s.created_by = p.id
      ${whereString}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await pool.query(query, [...values, limit, offset]);

    // Data statistik se-global tp ngikut alunan saringanya yak
    const statsResult = await pool.query(
      `SELECT
        COUNT(DISTINCT s.id) AS total_survei,
        (SELECT COUNT(DISTINCT sr.jemaat_id) FROM public.survei_respons sr JOIN public.survei sv ON sr.survei_id = sv.id ${whereString ? whereString.replace(/\bs\./g, 'sv.') : ''}) AS total_responden,
        (SELECT COALESCE(ROUND(AVG(sr.skor)::numeric, 2), 0) FROM public.survei_respons sr JOIN public.survei sv ON sr.survei_id = sv.id ${whereString ? whereString.replace(/\bs\./g, 'sv.') : ''} AND sr.skor IS NOT NULL) AS rata_rata_skor
      FROM public.survei s
      ${whereString}`,
      values
    );

    return NextResponse.json({
      success: true,
      data: dataResult.rows,
      meta: {
        total: totalCount,
        limit,
        offset,
        total_survei: parseInt(statsResult.rows[0].total_survei, 10),
        total_responden: parseInt(statsResult.rows[0].total_responden, 10),
        rata_rata_skor: parseFloat(statsResult.rows[0].rata_rata_skor) || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching survei:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      client.release();
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (!caller.is_super_admin && !caller.permissions.includes('survei_manage')) {
      client.release();
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin mengelola survei' }, { status: 403 });
    }

    const body = await request.json();
    const {
      judul,
      deskripsi,
      kegiatan_id,
      satelit_id,
      periode_mulai,
      periode_selesai,
      is_anonim,
      threshold_flag,
      tipe_survei,
      pertanyaan,
    } = body;

    // Validation
    if (!judul || !periode_mulai || !periode_selesai) {
      client.release();
      return NextResponse.json({ success: false, message: 'Judul, periode mulai, dan periode selesai wajib diisi' }, { status: 400 });
    }
    if (!pertanyaan || !Array.isArray(pertanyaan) || pertanyaan.length === 0) {
      client.release();
      return NextResponse.json({ success: false, message: 'Minimal satu pertanyaan wajib diisi' }, { status: 400 });
    }

    // Satelit RBAC
    let finalSatelitId = satelit_id || null;
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      finalSatelitId = caller.satelit_id;
    }

    await client.query('BEGIN');

    // Insert survei
    const surveiResult = await client.query(
      `INSERT INTO public.survei (judul, deskripsi, kegiatan_id, satelit_id, periode_mulai, periode_selesai, is_active, is_anonim, threshold_flag, tipe_survei, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, 'terjadwal', $10)
       RETURNING id`,
      [
        judul,
        deskripsi || null,
        kegiatan_id || null,
        finalSatelitId,
        periode_mulai,
        periode_selesai,
        is_anonim ?? false,
        threshold_flag ?? 3,
        tipe_survei || 'manual',
        caller.user_id,
      ]
    );
    const surveiId = surveiResult.rows[0].id;

    // Insert pertanyaan
    for (const p of pertanyaan) {
      await client.query(
        `INSERT INTO public.survei_pertanyaan (survei_id, urutan, teks_pertanyaan, tipe_jawaban, is_required)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          surveiId,
          p.urutan,
          p.teks_pertanyaan,
          p.tipe_jawaban || 'skala',
          p.is_required ?? true,
        ]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: { id: surveiId },
      message: 'Survei berhasil dibuat',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating survei:', error);
    return NextResponse.json({ success: false, message: 'Gagal membuat survei. Terjadi kesalahan server.' }, { status: 500 });
  } finally {
    client.release();
  }
}
