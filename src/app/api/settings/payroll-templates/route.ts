import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET: list all templates (with jabatan name + active component count)
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const result = await pool.query(`
      SELECT 
        pt.id,
        pt.nama_template,
        pt.pph21_method,
        pt.is_active,
        pt.jabatan_pegawai_id,
        jpm.nama_jabatan,
        COUNT(ptd.id) FILTER (WHERE ptd.is_active = TRUE) AS active_komponen_count
      FROM public.payroll_template pt
      LEFT JOIN public.jabatan_pegawai_master jpm ON jpm.id = pt.jabatan_pegawai_id
      LEFT JOIN public.payroll_template_detail ptd ON ptd.template_id = pt.id
      GROUP BY pt.id, jpm.nama_jabatan
      ORDER BY pt.id ASC
    `);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('GET payroll-templates error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

// POST: Tolong buatkan template kinyis-kinyis untuk si jabatannya
export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { jabatan_pegawai_id, nama_template, pph21_method } = body;

    if (!jabatan_pegawai_id || !nama_template) {
      return NextResponse.json({ success: false, message: 'jabatan_pegawai_id dan nama_template wajib diisi.' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO public.payroll_template (jabatan_pegawai_id, nama_template, pph21_method)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [jabatan_pegawai_id, nama_template, pph21_method || 'Netto']
    );

    return NextResponse.json({ success: true, message: 'Template berhasil dibuat.', data: { id: result.rows[0].id } }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Jabatan ini sudah punya template gaji.' }, { status: 400 });
    }
    console.error('POST payroll-templates error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
