import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get('month'); // 1 to 12
    
    if (!monthStr || isNaN(Number(monthStr))) {
      return NextResponse.json({ success: false, message: 'Invalid month' }, { status: 400 });
    }
    
    const month = Number(monthStr);

    const query = `
      SELECT id, jemaat_id, nama_lengkap, foto_url, tanggal_lahir, jenis_kelamin, status_jemaat
      FROM jemaat
      WHERE EXTRACT(MONTH FROM tanggal_lahir) = $1
        AND is_deleted = false
        AND status_jemaat = 'Aktif'
      ORDER BY EXTRACT(DAY FROM tanggal_lahir) ASC
    `;
    const res = await pool.query(query, [month]);

    return NextResponse.json({
      success: true,
      data: res.rows
    });
  } catch (error) {
    console.error('[API Birthdays] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
