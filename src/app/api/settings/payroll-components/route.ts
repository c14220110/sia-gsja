import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET: list all komponen + their COA info
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const tipe = searchParams.get('tipe') || '';

    let query = `
      SELECT 
        pkm.id,
        pkm.nama_komponen,
        pkm.tipe,
        pkm.calculation_type,
        pkm.is_employer_portion,
        pkm.global_rate_field,
        pkm.is_system,
        pkm.is_active,
        pkm.urutan,
        pkm.coa_debit_id,
        pkm.coa_kredit_id,
        cd.kode_akun  AS coa_debit_kode,
        cd.nama_akun  AS coa_debit_nama,
        ck.kode_akun  AS coa_kredit_kode,
        ck.nama_akun  AS coa_kredit_nama
      FROM public.payroll_komponen_master pkm
      LEFT JOIN public.buku_besar_coa cd ON cd.id = pkm.coa_debit_id
      LEFT JOIN public.buku_besar_coa ck ON ck.id = pkm.coa_kredit_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (tipe) {
      query += ` AND pkm.tipe = $${idx++}`;
      params.push(tipe);
    }
    query += ` ORDER BY pkm.urutan ASC, pkm.id ASC`;

    const result = await pool.query(query, params);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('GET payroll-components error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

// POST: create new komponen
export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      nama_komponen, tipe, calculation_type,
      is_employer_portion, global_rate_field,
      coa_debit_id, coa_kredit_id, urutan
    } = body;

    if (!nama_komponen || !tipe || !calculation_type) {
      return NextResponse.json({ success: false, message: 'nama_komponen, tipe, dan calculation_type wajib diisi.' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO public.payroll_komponen_master
        (nama_komponen, tipe, calculation_type, is_employer_portion, global_rate_field, coa_debit_id, coa_kredit_id, is_system, urutan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8)
       RETURNING id`,
      [
        nama_komponen, tipe, calculation_type,
        is_employer_portion ?? null,
        global_rate_field || null,
        coa_debit_id || null,
        coa_kredit_id || null,
        urutan ?? 99,
      ]
    );

    return NextResponse.json({ success: true, message: 'Komponen berhasil ditambahkan.', data: { id: result.rows[0].id } }, { status: 201 });
  } catch (error: any) {
    console.error('POST payroll-components error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
