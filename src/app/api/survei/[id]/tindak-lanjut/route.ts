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

    // Fetch flagged responses with tindak lanjut status
    const query = `
      SELECT 
        st.id AS tindak_lanjut_id,
        st.respons_id,
        st.status,
        st.catatan_tindakan,
        st.updated_by,
        st.updated_at,
        st.created_at AS tindak_lanjut_created_at,
        sr.survei_id,
        sr.pertanyaan_id,
        sr.jemaat_id,
        sr.skor,
        sr.jawaban_teks,
        sr.is_flagged,
        sr.created_at AS respons_created_at,
        sp.urutan,
        sp.teks_pertanyaan,
        sp.tipe_jawaban,
        CASE WHEN sv.is_anonim THEN 'Anonim' ELSE COALESCE(j.nama_lengkap, 'N/A') END AS nama_jemaat,
        COALESCE(handler_j.nama_lengkap, handler_p.email) AS ditangani_oleh_nama
      FROM public.survei_tindak_lanjut st
      JOIN public.survei_respons sr ON st.respons_id = sr.id
      JOIN public.survei sv ON sr.survei_id = sv.id
      JOIN public.survei_pertanyaan sp ON sr.pertanyaan_id = sp.id
      LEFT JOIN public.jemaat j ON sr.jemaat_id = j.id
      LEFT JOIN public.pengguna handler_p ON st.updated_by = handler_p.id
      LEFT JOIN public.jemaat handler_j ON handler_p.jemaat_id = handler_j.id
      WHERE sr.survei_id = $1
      ORDER BY st.created_at DESC, sp.urutan ASC
    `;

    const result = await pool.query(query, [id]);

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.rows.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching tindak lanjut:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('survei_manage')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin mengelola survei' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { respons_id, status, catatan_tindakan } = body;

    if (!respons_id || !status) {
      return NextResponse.json({ success: false, message: 'respons_id dan status wajib diisi' }, { status: 400 });
    }

    // Validate status value
    const validStatuses = ['Belum Ditangani', 'Sedang Ditangani', 'Selesai'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        message: `Status tidak valid. Pilihan: ${validStatuses.join(', ')}`,
      }, { status: 400 });
    }

    // Verify tindak lanjut exists for this respons in this survei
    const existing = await pool.query(
      `SELECT st.id FROM public.survei_tindak_lanjut st
       JOIN public.survei_respons sr ON st.respons_id = sr.id
       WHERE st.respons_id = $1 AND sr.survei_id = $2`,
      [respons_id, id]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Tindak lanjut tidak ditemukan untuk respons ini' }, { status: 404 });
    }

    // Build dynamic update based on status
    const values: any[] = [status, catatan_tindakan || null, caller.user_id, respons_id];

    await pool.query(
      `UPDATE public.survei_tindak_lanjut 
       SET status = $1, catatan_tindakan = $2, updated_by = $3, updated_at = NOW() AT TIME ZONE 'Asia/Jakarta'
       WHERE respons_id = $4`,
      values
    );

    return NextResponse.json({
      success: true,
      message: `Status tindak lanjut berhasil diubah menjadi "${status}"`,
    });
  } catch (error: any) {
    console.error('Error updating tindak lanjut:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
