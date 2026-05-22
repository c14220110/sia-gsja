import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

/**
 * GET /api/settings/survei-template
 * - Tanpa query param: List semua jenis kegiatan + status template + jumlah pertanyaan
 * - Dengan ?jenis_kegiatan_id=XX: Detail pertanyaan template untuk 1 jenis kegiatan
 */
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jenisKegiatanId = searchParams.get('jenis_kegiatan_id');

  try {
    if (jenisKegiatanId) {
      // Detail: pertanyaan template untuk 1 jenis kegiatan
      const templateRes = await pool.query(
        `SELECT st.id, st.is_active 
         FROM public.survei_template st 
         WHERE st.jenis_kegiatan_id = $1`,
        [jenisKegiatanId]
      );

      if (templateRes.rows.length === 0) {
        return NextResponse.json({
          success: true,
          data: { template: null, pertanyaan: [] },
        });
      }

      const template = templateRes.rows[0];
      const pertanyaanRes = await pool.query(
        `SELECT id, urutan, teks_pertanyaan, tipe_jawaban, is_required
         FROM public.survei_template_pertanyaan
         WHERE template_id = $1
         ORDER BY urutan`,
        [template.id]
      );

      return NextResponse.json({
        success: true,
        data: {
          template: { id: template.id, is_active: template.is_active },
          pertanyaan: pertanyaanRes.rows,
        },
      });
    }

    // List: semua jenis kegiatan + status template
    const result = await pool.query(`
      SELECT 
        jk.id,
        jk.nama_jenis_kegiatan,
        jk.kategori,
        st.id as template_id,
        COALESCE(st.is_active, true) as is_active,
        CASE WHEN st.id IS NOT NULL THEN true ELSE false END as has_template,
        COALESCE(
          (SELECT COUNT(*) FROM public.survei_template_pertanyaan stp WHERE stp.template_id = st.id),
          0
        )::int as jumlah_pertanyaan
      FROM public.jenis_kegiatan jk
      LEFT JOIN public.survei_template st ON st.jenis_kegiatan_id = jk.id
      ORDER BY jk.kategori, jk.nama_jenis_kegiatan
    `);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('API Error [GET /settings/survei-template]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}

/**
 * POST /api/settings/survei-template
 * Buat/update template survei untuk 1 jenis kegiatan (upsert).
 * Body: { jenis_kegiatan_id, is_active, pertanyaan: [{ urutan, teks_pertanyaan, tipe_jawaban, is_required }] }
 */
export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Hanya Super Admin yang dapat mengelola template survei' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { jenis_kegiatan_id, is_active, pertanyaan } = body;

    if (!jenis_kegiatan_id) {
      return NextResponse.json({ success: false, message: 'jenis_kegiatan_id wajib diisi' }, { status: 400 });
    }
    if (!Array.isArray(pertanyaan) || pertanyaan.length === 0) {
      return NextResponse.json({ success: false, message: 'Minimal 1 pertanyaan wajib diisi' }, { status: 400 });
    }

    // Validasi setiap pertanyaan
    for (let i = 0; i < pertanyaan.length; i++) {
      const p = pertanyaan[i];
      if (!p.teks_pertanyaan || !p.teks_pertanyaan.trim()) {
        return NextResponse.json({ success: false, message: `Pertanyaan ke-${i + 1} tidak boleh kosong` }, { status: 400 });
      }
      if (!['skala', 'teks'].includes(p.tipe_jawaban)) {
        return NextResponse.json({ success: false, message: `Tipe jawaban pertanyaan ke-${i + 1} tidak valid` }, { status: 400 });
      }
    }

    await client.query('BEGIN');

    // Upsert template
    const existingRes = await client.query(
      `SELECT id FROM public.survei_template WHERE jenis_kegiatan_id = $1`,
      [jenis_kegiatan_id]
    );

    let templateId: number;
    if (existingRes.rows.length > 0) {
      templateId = existingRes.rows[0].id;
      await client.query(
        `UPDATE public.survei_template SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [is_active !== false, templateId]
      );
      // Hapus pertanyaan lama (replace strategy)
      await client.query(
        `DELETE FROM public.survei_template_pertanyaan WHERE template_id = $1`,
        [templateId]
      );
    } else {
      const insertRes = await client.query(
        `INSERT INTO public.survei_template (jenis_kegiatan_id, is_active) VALUES ($1, $2) RETURNING id`,
        [jenis_kegiatan_id, is_active !== false]
      );
      templateId = insertRes.rows[0].id;
    }

    // Insert pertanyaan baru
    for (let i = 0; i < pertanyaan.length; i++) {
      const p = pertanyaan[i];
      await client.query(
        `INSERT INTO public.survei_template_pertanyaan (template_id, urutan, teks_pertanyaan, tipe_jawaban, is_required)
         VALUES ($1, $2, $3, $4, $5)`,
        [templateId, i + 1, p.teks_pertanyaan.trim(), p.tipe_jawaban, p.is_required !== false]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Template survei berhasil disimpan',
      data: { template_id: templateId },
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('API Error [POST /settings/survei-template]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * PATCH /api/settings/survei-template
 * Toggle is_active saja (tanpa mengubah pertanyaan).
 * Body: { jenis_kegiatan_id, is_active }
 */
export async function PATCH(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Hanya Super Admin yang dapat mengelola template survei' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { jenis_kegiatan_id, is_active } = body;

    if (!jenis_kegiatan_id || typeof is_active !== 'boolean') {
      return NextResponse.json({ success: false, message: 'jenis_kegiatan_id dan is_active wajib diisi' }, { status: 400 });
    }

    // Cek apakah template ada
    const existingRes = await pool.query(
      `SELECT id FROM public.survei_template WHERE jenis_kegiatan_id = $1`,
      [jenis_kegiatan_id]
    );

    if (existingRes.rows.length === 0) {
      // Belum ada template — buat template baru dengan default pertanyaan
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const insertRes = await client.query(
          `INSERT INTO public.survei_template (jenis_kegiatan_id, is_active) VALUES ($1, $2) RETURNING id`,
          [jenis_kegiatan_id, is_active]
        );
        const templateId = insertRes.rows[0].id;

        // Insert default pertanyaan
        const defaults = [
          { urutan: 1, teks: 'Seberapa puas Anda dengan kegiatan ini secara keseluruhan?', tipe: 'skala', required: true },
          { urutan: 2, teks: 'Seberapa baik pelayanan dan fasilitas yang disediakan?', tipe: 'skala', required: true },
          { urutan: 3, teks: 'Masukan atau saran untuk perbaikan ke depan:', tipe: 'teks', required: false },
        ];
        for (const d of defaults) {
          await client.query(
            `INSERT INTO public.survei_template_pertanyaan (template_id, urutan, teks_pertanyaan, tipe_jawaban, is_required) VALUES ($1, $2, $3, $4, $5)`,
            [templateId, d.urutan, d.teks, d.tipe, d.required]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    } else {
      await pool.query(
        `UPDATE public.survei_template SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE jenis_kegiatan_id = $2`,
        [is_active, jenis_kegiatan_id]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Survei otomatis ${is_active ? 'diaktifkan' : 'dinonaktifkan'}`,
    });
  } catch (error: any) {
    console.error('API Error [PATCH /settings/survei-template]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
