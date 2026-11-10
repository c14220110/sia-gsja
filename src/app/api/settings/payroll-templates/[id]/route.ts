import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET: full detail of one template (header + all komponen lines)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });

  try {
    // Header
    const headerRes = await pool.query(`
      SELECT pt.*, jpm.nama_jabatan
      FROM public.payroll_template pt
      LEFT JOIN public.jabatan_pegawai_master jpm ON jpm.id = pt.jabatan_pegawai_id
      WHERE pt.id = $1
    `, [id]);

    if (headerRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Template tidak ditemukan.' }, { status: 404 });
    }

    // Detail items
    const detailRes = await pool.query(`
      SELECT
        ptd.id,
        ptd.template_id,
        ptd.komponen_id,
        ptd.nominal_default,
        ptd.satuan,
        ptd.hari_kerja_default,
        ptd.is_active,
        pkm.nama_komponen,
        pkm.tipe,
        pkm.calculation_type,
        pkm.is_employer_portion,
        pkm.global_rate_field,
        pkm.is_system
      FROM public.payroll_template_detail ptd
      JOIN public.payroll_komponen_master pkm ON pkm.id = ptd.komponen_id
      WHERE ptd.template_id = $1
      ORDER BY pkm.urutan ASC, pkm.id ASC
    `, [id]);

    return NextResponse.json({
      success: true,
      data: {
        template: headerRes.rows[0],
        detail: detailRes.rows,
      }
    });
  } catch (error: any) {
    console.error('GET payroll-templates/[id] error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

// PUT: save full template detail (header update + upsert all detail lines)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const body = await request.json();
    const { nama_template, pph21_method, is_active, detail } = body;

    // Update header (only fields that are provided)
    await client.query(
      `UPDATE public.payroll_template 
       SET nama_template = COALESCE($1, nama_template),
           pph21_method  = COALESCE($2, pph21_method),
           is_active     = COALESCE($3, is_active),
           updated_at    = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [nama_template || null, pph21_method || null, is_active ?? null, id]
    );

    // Upsert each detail line atomically
    if (Array.isArray(detail)) {
      for (const line of detail) {
        const { komponen_id, nominal_default, satuan, hari_kerja_default, is_active: lineActive } = line;
        await client.query(
          `INSERT INTO public.payroll_template_detail
            (template_id, komponen_id, nominal_default, satuan, hari_kerja_default, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (template_id, komponen_id) DO UPDATE SET
            nominal_default    = EXCLUDED.nominal_default,
            satuan             = EXCLUDED.satuan,
            hari_kerja_default = EXCLUDED.hari_kerja_default,
            is_active          = EXCLUDED.is_active`,
          [
            id,
            komponen_id,
            nominal_default ?? 0,
            satuan || 'bulan',
            hari_kerja_default ?? 22,
            lineActive ?? true,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Template berhasil disimpan.' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('PUT payroll-templates/[id] error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
