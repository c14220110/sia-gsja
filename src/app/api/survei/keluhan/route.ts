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
      return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const satelitId = searchParams.get('satelit_id') || '';
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build WHERE clauses
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 0;

    if (status) {
      paramIdx++;
      conditions.push(`st.status = $${paramIdx}`);
      values.push(status);
    }
    if (satelitId) {
      paramIdx++;
      conditions.push(`sv.satelit_id = $${paramIdx}`);
      values.push(parseInt(satelitId, 10));
    }
    if (search) {
      paramIdx++;
      conditions.push(`(sv.judul ILIKE $${paramIdx} OR sp.teks_pertanyaan ILIKE $${paramIdx})`);
      values.push(`%${search}%`);
    }

    // RBAC: non-super-admin can only see their own satelit
    if (!caller.is_super_admin && caller.satelit_id) {
      paramIdx++;
      conditions.push(`sv.satelit_id = $${paramIdx}`);
      values.push(caller.satelit_id);
    }

    const whereString = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Main query
    const dataQuery = `
      SELECT 
        st.id AS tindak_lanjut_id,
        st.respons_id,
        st.status,
        st.catatan_tindakan,
        st.updated_by,
        st.updated_at,
        st.created_at AS tindak_lanjut_created_at,
        sr.survei_id,
        sr.skor,
        sr.jawaban_teks,
        sr.is_flagged,
        sr.created_at AS respons_created_at,
        sp.urutan,
        sp.teks_pertanyaan,
        sp.tipe_jawaban,
        sv.judul AS survei_judul,
        sv.tipe_survei,
        sv.is_anonim,
        CASE WHEN sv.is_anonim THEN 'Anonim' ELSE COALESCE(j.nama_lengkap, 'N/A') END AS nama_jemaat,
        COALESCE(handler_j.nama_lengkap, handler_p.email) AS ditangani_oleh_nama,
        COALESCE(kg.nama_kegiatan, '') AS nama_kegiatan,
        COALESCE(sat.nama_satelit, '') AS nama_satelit
      FROM public.survei_tindak_lanjut st
      JOIN public.survei_respons sr ON st.respons_id = sr.id
      JOIN public.survei sv ON sr.survei_id = sv.id
      JOIN public.survei_pertanyaan sp ON sr.pertanyaan_id = sp.id
      LEFT JOIN public.jemaat j ON sr.jemaat_id = j.id
      LEFT JOIN public.pengguna handler_p ON st.updated_by = handler_p.id
      LEFT JOIN public.jemaat handler_j ON handler_p.jemaat_id = handler_j.id
      LEFT JOIN public.kegiatan kg ON sv.kegiatan_id = kg.id
      LEFT JOIN public.satelit sat ON sv.satelit_id = sat.id
      ${whereString}
      ORDER BY 
        CASE st.status 
          WHEN 'Belum Ditangani' THEN 1 
          WHEN 'Sedang Ditangani' THEN 2 
          WHEN 'Selesai' THEN 3 
        END ASC,
        st.created_at DESC
      LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}
    `;

    const dataResult = await pool.query(dataQuery, [...values, limit, offset]);

    // Count query for pagination (with all filters)
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM public.survei_tindak_lanjut st
      JOIN public.survei_respons sr ON st.respons_id = sr.id
      JOIN public.survei sv ON sr.survei_id = sv.id
      JOIN public.survei_pertanyaan sp ON sr.pertanyaan_id = sp.id
      ${whereString}
    `;
    const countResult = await pool.query(countQuery, values);

    // Global summary (without status filter, but keep other filters like satelit/search/RBAC)
    const summaryConditions = conditions.filter(c => !c.startsWith('st.status'));
    const summaryValues = values.filter((_, i) => !conditions[i]?.startsWith('st.status'));
    const summaryWhere = summaryConditions.length > 0 ? `WHERE ${summaryConditions.join(' AND ')}` : '';

    const summaryQuery = `
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE st.status = 'Belum Ditangani') AS total_belum,
        COUNT(*) FILTER (WHERE st.status = 'Sedang Ditangani') AS total_sedang,
        COUNT(*) FILTER (WHERE st.status = 'Selesai') AS total_selesai
      FROM public.survei_tindak_lanjut st
      JOIN public.survei_respons sr ON st.respons_id = sr.id
      JOIN public.survei sv ON sr.survei_id = sv.id
      JOIN public.survei_pertanyaan sp ON sr.pertanyaan_id = sp.id
      ${summaryWhere}
    `;
    const summaryResult = await pool.query(summaryQuery, summaryValues);

    return NextResponse.json({
      success: true,
      data: dataResult.rows,
      meta: {
        total: parseInt(countResult.rows[0].total, 10),
        total_belum: parseInt(summaryResult.rows[0].total_belum, 10),
        total_sedang: parseInt(summaryResult.rows[0].total_sedang, 10),
        total_selesai: parseInt(summaryResult.rows[0].total_selesai, 10),
      },
    });
  } catch (error: any) {
    console.error('Error fetching all keluhan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('survei_manage')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { respons_id, status, catatan_tindakan } = body;

    if (!respons_id || !status) {
      return NextResponse.json({ success: false, message: 'respons_id dan status wajib diisi' }, { status: 400 });
    }

    const validStatuses = ['Belum Ditangani', 'Sedang Ditangani', 'Selesai'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, message: `Status tidak valid` }, { status: 400 });
    }

    const existing = await pool.query(
      `SELECT id FROM public.survei_tindak_lanjut WHERE respons_id = $1`,
      [respons_id]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Tindak lanjut tidak ditemukan' }, { status: 404 });
    }

    await pool.query(
      `UPDATE public.survei_tindak_lanjut 
       SET status = $1, catatan_tindakan = $2, updated_by = $3, updated_at = NOW()
       WHERE respons_id = $4`,
      [status, catatan_tindakan || null, caller.user_id, respons_id]
    );

    return NextResponse.json({
      success: true,
      message: `Status tindak lanjut berhasil diubah menjadi "${status}"`,
    });
  } catch (error: any) {
    console.error('Error updating keluhan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
