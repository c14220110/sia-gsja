import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get('month'); // 1 to 12
    
    if (!monthStr || isNaN(Number(monthStr))) {
      return NextResponse.json({ success: false, message: 'Invalid month' }, { status: 400 });
    }
    
    const month = Number(monthStr);

    const satelitId = searchParams.get('satelit_id');

    let finalSatelitId = satelitId;
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      finalSatelitId = caller.satelit_id?.toString() || '';
    }

    let whereClause = `WHERE EXTRACT(MONTH FROM tanggal_lahir) = $1 AND is_deleted = false AND status_jemaat = 'Aktif'`;
    const values: any[] = [month];

    if (finalSatelitId) {
      whereClause += ` AND satelit_id = $2`;
      values.push(finalSatelitId);
    }

    const query = `
      SELECT id, jemaat_id, nama_lengkap, foto_url, tanggal_lahir, jenis_kelamin, status_jemaat
      FROM jemaat
      ${whereClause}
      ORDER BY EXTRACT(DAY FROM tanggal_lahir) ASC
    `;
    const res = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      data: res.rows
    });
  } catch (error) {
    console.error('[API Birthdays] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
