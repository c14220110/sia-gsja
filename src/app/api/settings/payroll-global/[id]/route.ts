import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// PUT: edit existing rate row by id
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID tidak valid' }, { status: 400 });

  try {
    const body = await request.json();
    const {
      effective_date,
      bpjs_kes_employer_pct, bpjs_kes_employee_pct,
      bpjs_tk_jht_employer_pct, bpjs_tk_jht_employee_pct,
      bpjs_tk_jp_employer_pct, bpjs_tk_jp_employee_pct,
      bpjs_tk_jkk_pct, bpjs_tk_jkm_pct,
      keterangan,
    } = body;

    const result = await pool.query(
      `UPDATE public.payroll_global_settings SET
        effective_date           = COALESCE($1, effective_date),
        bpjs_kes_employer_pct    = COALESCE($2, bpjs_kes_employer_pct),
        bpjs_kes_employee_pct    = COALESCE($3, bpjs_kes_employee_pct),
        bpjs_tk_jht_employer_pct = COALESCE($4, bpjs_tk_jht_employer_pct),
        bpjs_tk_jht_employee_pct = COALESCE($5, bpjs_tk_jht_employee_pct),
        bpjs_tk_jp_employer_pct  = COALESCE($6, bpjs_tk_jp_employer_pct),
        bpjs_tk_jp_employee_pct  = COALESCE($7, bpjs_tk_jp_employee_pct),
        bpjs_tk_jkk_pct          = COALESCE($8, bpjs_tk_jkk_pct),
        bpjs_tk_jkm_pct          = COALESCE($9, bpjs_tk_jkm_pct),
        keterangan               = $10
       WHERE id = $11
       RETURNING id`,
      [
        effective_date || null,
        bpjs_kes_employer_pct ?? null,    bpjs_kes_employee_pct ?? null,
        bpjs_tk_jht_employer_pct ?? null, bpjs_tk_jht_employee_pct ?? null,
        bpjs_tk_jp_employer_pct ?? null,  bpjs_tk_jp_employee_pct ?? null,
        bpjs_tk_jkk_pct ?? null,          bpjs_tk_jkm_pct ?? null,
        keterangan || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Data tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Tarif regulasi berhasil diperbarui.' });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Tanggal efektif ini sudah dipakai baris lain.' }, { status: 400 });
    }
    console.error('PUT payroll-global/[id] error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
