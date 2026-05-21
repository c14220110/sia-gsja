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

    // Fetch survei header
    const surveiResult = await pool.query(
      `SELECT 
        s.id, s.judul, s.deskripsi, s.kegiatan_id, s.satelit_id,
        s.periode_mulai, s.periode_selesai, s.is_active, s.is_anonim,
        s.threshold_flag, s.created_by, s.created_at, s.updated_at,
        kg.nama_kegiatan,
        sat.nama_satelit,
        p.email AS created_by_email
      FROM public.survei s
      LEFT JOIN public.kegiatan kg ON s.kegiatan_id = kg.id
      LEFT JOIN public.satelit sat ON s.satelit_id = sat.id
      LEFT JOIN public.pengguna p ON s.created_by = p.id
      WHERE s.id = $1`,
      [id]
    );

    if (surveiResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Survei tidak ditemukan' }, { status: 404 });
    }

    const survei = surveiResult.rows[0];

    // RBAC: check satelit ownership
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (survei.satelit_id && survei.satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Akses ditolak: survei bukan milik satelit Anda' }, { status: 403 });
      }
    }

    // Fetch pertanyaan with per-pertanyaan stats
    const pertanyaanResult = await pool.query(
      `SELECT 
        sp.id, sp.urutan, sp.teks_pertanyaan, sp.tipe_jawaban, sp.is_required,
        COALESCE(ROUND(AVG(sr.skor)::numeric, 2), 0) AS avg_skor,
        COUNT(sr.id) AS count_respons,
        COUNT(CASE WHEN sr.skor = 1 THEN 1 END) AS skor_1,
        COUNT(CASE WHEN sr.skor = 2 THEN 1 END) AS skor_2,
        COUNT(CASE WHEN sr.skor = 3 THEN 1 END) AS skor_3,
        COUNT(CASE WHEN sr.skor = 4 THEN 1 END) AS skor_4,
        COUNT(CASE WHEN sr.skor = 5 THEN 1 END) AS skor_5
      FROM public.survei_pertanyaan sp
      LEFT JOIN public.survei_respons sr ON sp.id = sr.pertanyaan_id
      WHERE sp.survei_id = $1
      GROUP BY sp.id, sp.urutan, sp.teks_pertanyaan, sp.tipe_jawaban, sp.is_required
      ORDER BY sp.urutan ASC`,
      [id]
    );

    // Global stats
    const statsResult = await pool.query(
      `SELECT 
        COUNT(DISTINCT sr.jemaat_id) AS total_responden,
        COUNT(CASE WHEN sr.is_flagged = true THEN 1 END) AS total_flagged
      FROM public.survei_respons sr
      WHERE sr.survei_id = $1`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...survei,
        pertanyaan: pertanyaanResult.rows.map(row => ({
          ...row,
          avg_skor: parseFloat(row.avg_skor) || 0,
          count_respons: parseInt(row.count_respons, 10),
          distribusi: {
            1: parseInt(row.skor_1, 10),
            2: parseInt(row.skor_2, 10),
            3: parseInt(row.skor_3, 10),
            4: parseInt(row.skor_4, 10),
            5: parseInt(row.skor_5, 10),
          },
        })),
        total_responden: parseInt(statsResult.rows[0].total_responden, 10),
        total_flagged: parseInt(statsResult.rows[0].total_flagged, 10),
      },
    });
  } catch (error: any) {
    console.error('Error fetching survei detail:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('survei_manage')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin mengelola survei' }, { status: 403 });
  }

  const client = await pool.connect();

  try {
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
      pertanyaan,
    } = body;

    await client.query('BEGIN');

    // Check survei exists & RBAC
    const existing = await client.query(
      `SELECT id, satelit_id FROM public.survei WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Survei tidak ditemukan' }, { status: 404 });
    }

    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (existing.rows[0].satelit_id && existing.rows[0].satelit_id !== caller.satelit_id) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, message: 'Akses ditolak: survei bukan milik satelit Anda' }, { status: 403 });
      }
    }

    // Protect data integrity: cannot update pertanyaan if responses exist
    const responsCheck = await client.query(
      `SELECT COUNT(*) FROM public.survei_respons WHERE survei_id = $1`,
      [id]
    );
    const hasRespons = parseInt(responsCheck.rows[0].count, 10) > 0;

    // Satelit RBAC for update
    let finalSatelitId = satelit_id || null;
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      finalSatelitId = caller.satelit_id;
    }

    // Update survei header
    await client.query(
      `UPDATE public.survei SET 
        judul = $1, deskripsi = $2, kegiatan_id = $3, satelit_id = $4,
        periode_mulai = $5, periode_selesai = $6, is_anonim = $7, threshold_flag = $8,
        updated_at = NOW()
      WHERE id = $9`,
      [
        judul,
        deskripsi || null,
        kegiatan_id || null,
        finalSatelitId,
        periode_mulai,
        periode_selesai,
        is_anonim ?? false,
        threshold_flag ?? 3,
        id,
      ]
    );

    // Replace pertanyaan only if no responses yet (replace-all pattern from LPJ)
    if (pertanyaan && Array.isArray(pertanyaan) && pertanyaan.length > 0) {
      if (hasRespons) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          message: 'Pertanyaan tidak dapat diubah karena sudah ada respons. Hanya data header survei yang dapat diperbarui.',
        }, { status: 400 });
      }

      // Delete old pertanyaan → Insert new ones
      await client.query('DELETE FROM public.survei_pertanyaan WHERE survei_id = $1', [id]);
      for (const p of pertanyaan) {
        await client.query(
          `INSERT INTO public.survei_pertanyaan (survei_id, urutan, teks_pertanyaan, tipe_jawaban, is_required)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, p.urutan, p.teks_pertanyaan, p.tipe_jawaban || 'skala', p.is_required ?? true]
        );
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({ success: true, message: 'Survei berhasil diperbarui' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating survei:', error);
    return NextResponse.json({ success: false, message: 'Gagal memperbarui survei. Terjadi kesalahan server.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('survei_manage')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin mengelola survei' }, { status: 403 });
  }

  try {
    // Check survei exists & RBAC
    const existing = await pool.query(
      `SELECT id, satelit_id FROM public.survei WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Survei tidak ditemukan' }, { status: 404 });
    }

    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (existing.rows[0].satelit_id && existing.rows[0].satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Akses ditolak: survei bukan milik satelit Anda' }, { status: 403 });
      }
    }

    // Soft delete: set is_active = false
    await pool.query(
      `UPDATE public.survei SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ success: true, message: 'Survei berhasil dinonaktifkan' });
  } catch (error: any) {
    console.error('Error deleting survei:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
