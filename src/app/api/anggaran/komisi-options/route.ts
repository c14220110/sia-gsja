import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/anggaran/komisi-options?satelit_id=X
 * Mengembalikan daftar komisi aktif yang berada di bawah satelit tertentu.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const satelitId = searchParams.get('satelit_id');

  if (!satelitId) {
    return NextResponse.json({ success: false, message: 'satelit_id wajib diisi' }, { status: 400 });
  }

  try {
    const res = await pool.query(
      `SELECT id, nama_komisi FROM public.komisi
       WHERE satelit_id = $1 AND is_active = true
       ORDER BY nama_komisi ASC`,
      [satelitId]
    );
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('[KomisiOptions] Error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data komisi', error: error.message }, { status: 500 });
  }
}
