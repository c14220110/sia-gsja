import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET: list all BPJS rate history, newest first
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const result = await pool.query(`
      SELECT * FROM public.payroll_global_settings
      ORDER BY effective_date DESC
    `);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('GET payroll-global error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

// POST: add new effective-date rate row
export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

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

    if (!effective_date) {
      return NextResponse.json({ success: false, message: 'effective_date wajib diisi.' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO public.payroll_global_settings (
        effective_date,
        bpjs_kes_employer_pct, bpjs_kes_employee_pct,
        bpjs_tk_jht_employer_pct, bpjs_tk_jht_employee_pct,
        bpjs_tk_jp_employer_pct, bpjs_tk_jp_employee_pct,
        bpjs_tk_jkk_pct, bpjs_tk_jkm_pct, keterangan
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        effective_date,
        bpjs_kes_employer_pct ?? 4.0,    bpjs_kes_employee_pct ?? 1.0,
        bpjs_tk_jht_employer_pct ?? 3.7, bpjs_tk_jht_employee_pct ?? 2.0,
        bpjs_tk_jp_employer_pct ?? 2.0,  bpjs_tk_jp_employee_pct ?? 1.0,
        bpjs_tk_jkk_pct ?? 0.24,         bpjs_tk_jkm_pct ?? 0.3,
        keterangan || null,
      ]
    );

    return NextResponse.json({ success: true, message: 'Tarif regulasi baru berhasil disimpan.', data: { id: result.rows[0].id } }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Tanggal efektif ini sudah ada. Gunakan Edit jika ingin mengubah.' }, { status: 400 });
    }
    console.error('POST payroll-global error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
