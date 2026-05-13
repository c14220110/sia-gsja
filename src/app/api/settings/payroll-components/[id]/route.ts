import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// PUT: update komponen (nama, COA mapping, urutan, is_active)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });

  try {
    // Prevent editing system components' core fields
    const existing = await pool.query(
      `SELECT is_system FROM public.payroll_komponen_master WHERE id = $1`, [id]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Komponen tidak ditemukan.' }, { status: 404 });
    }

    const body = await request.json();
    const {
      nama_komponen, coa_debit_id, coa_kredit_id,
      urutan, is_active,
      // Only editable if not is_system:
      tipe, calculation_type, is_employer_portion, global_rate_field,
    } = body;

    const isSystem = existing.rows[0].is_system;

    const result = await pool.query(
      `UPDATE public.payroll_komponen_master SET
        nama_komponen       = COALESCE($1, nama_komponen),
        coa_debit_id        = $2,
        coa_kredit_id       = $3,
        urutan              = COALESCE($4, urutan),
        is_active           = COALESCE($5, is_active),
        tipe                = CASE WHEN $6 = TRUE THEN tipe ELSE COALESCE($7, tipe) END,
        calculation_type    = CASE WHEN $6 = TRUE THEN calculation_type ELSE COALESCE($8, calculation_type) END,
        is_employer_portion = CASE WHEN $6 = TRUE THEN is_employer_portion ELSE $9 END,
        global_rate_field   = CASE WHEN $6 = TRUE THEN global_rate_field ELSE $10 END
       WHERE id = $11
       RETURNING id`,
      [
        nama_komponen || null,
        coa_debit_id || null,
        coa_kredit_id || null,
        urutan ?? null,
        is_active ?? null,
        isSystem,   // $6 — if true, skip type/calc edits
        tipe || null,
        calculation_type || null,
        is_employer_portion ?? null,
        global_rate_field || null,
        id,
      ]
    );

    return NextResponse.json({ success: true, message: 'Komponen berhasil diperbarui.', data: result.rows[0] });
  } catch (error: any) {
    console.error('PUT payroll-components/[id] error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
