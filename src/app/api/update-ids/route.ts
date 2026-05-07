export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller || !caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Forbidden: Super Admin only' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Ambil semua jemaat dengan jemaat_id yang dimulai dengan TEMP
    const jemaatRes = await client.query('SELECT id, satelit_id, tanggal_lahir FROM jemaat WHERE jemaat_id LIKE $1 ORDER BY id ASC', ['TEMP%']);
    
    // Ambil semua satelit untuk tau kode_satelitnya
    const satelitRes = await client.query('SELECT id, kode_satelit FROM satelit');
    const satelitMap: Record<number, string> = {};
    for (const s of satelitRes.rows) {
      satelitMap[s.id] = s.kode_satelit ? s.kode_satelit.substring(0, 2).padStart(2, '0') : '00';
    }

    const updated = [];

    for (const row of jemaatRes.rows) {
      let satelitCode = satelitMap[row.satelit_id] || '00';
      
      let dateCode = '000000';
      if (row.tanggal_lahir) {
        const d = new Date(row.tanggal_lahir);
        if (!isNaN(d.getTime())) {
          const dd = d.getDate().toString().padStart(2, '0');
          const mm = (d.getMonth() + 1).toString().padStart(2, '0');
          const yy = d.getFullYear().toString().slice(-2);
          dateCode = `${dd}${mm}${yy}`;
        }
      }

      const idPrefix = `${satelitCode}${dateCode}`;

      // Hitung increment untuk idPrefix ini
      const countRes = await client.query(
        `SELECT jemaat_id FROM jemaat WHERE jemaat_id LIKE $1 AND jemaat_id NOT LIKE 'TEMP%' ORDER BY jemaat_id DESC LIMIT 1`,
        [`${idPrefix}%`]
      );

      let nextNum = 0;
      if (countRes.rows.length > 0) {
        const lastId = countRes.rows[0].jemaat_id; 
        if (lastId && lastId.length >= 10) {
           const lastCounter = parseInt(lastId.slice(-2), 10);
           if (!isNaN(lastCounter)) {
             nextNum = lastCounter + 1;
           }
        }
      }
      
      const newJemaatId = `${idPrefix}${nextNum.toString().padStart(2, '0')}`;
      
      await client.query('UPDATE jemaat SET jemaat_id = $1 WHERE id = $2', [newJemaatId, row.id]);
      updated.push({ id: row.id, newJemaatId, dob: row.tanggal_lahir });
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, count: updated.length, updated });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ success: false, error: err?.message, stack: err?.stack }, { status: 500 });
  } finally {
    client.release();
  }
}
