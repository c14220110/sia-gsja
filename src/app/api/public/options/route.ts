import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'satelit') {
      const res = await pool.query(
        'SELECT id, nama_satelit FROM satelit WHERE is_active = true ORDER BY nama_satelit'
      );
      return NextResponse.json({ success: true, data: res.rows });
    }

    if (type === 'pekerjaan') {
      const res = await pool.query(
        "SELECT id, nama_pekerjaan FROM pekerjaan_master ORDER BY id"
      );
      return NextResponse.json({ success: true, data: res.rows });
    }

    if (type === 'jemaat_search') {
      const q = searchParams.get('q') || '';
      if (q.length < 2) {
        return NextResponse.json({ success: true, data: [] });
      }
      const res = await pool.query(
        `SELECT id, nama_lengkap, jemaat_id, jenis_kelamin
         FROM jemaat
         WHERE is_deleted = false
           AND (nama_lengkap ILIKE $1 OR jemaat_id ILIKE $1)
         ORDER BY nama_lengkap
         LIMIT 10`,
        [`%${q}%`]
      );
      return NextResponse.json({ success: true, data: res.rows });
    }

    return NextResponse.json({ success: false, message: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    console.error('[public/options]', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
