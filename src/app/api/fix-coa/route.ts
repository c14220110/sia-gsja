import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    await pool.query(`
      UPDATE public.buku_besar_coa 
      SET saldo_normal = 'Debit' 
      WHERE kode_akun LIKE '51%' OR kode_akun = 'H1-BIA-69' OR kode_akun LIKE 'H2-51%';
    `);
    return NextResponse.json({ success: true, message: 'Saldo Normal Fixed!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
