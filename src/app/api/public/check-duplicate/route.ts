import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const field = searchParams.get('field'); // 'no_hp' | 'email' | 'username'
    const value = searchParams.get('value');

    if (!field || !value) {
      return NextResponse.json({ success: false, message: 'field and value required' }, { status: 400 });
    }

    if (!['no_hp', 'email', 'username'].includes(field)) {
      return NextResponse.json({ success: false, message: 'Invalid field' }, { status: 400 });
    }

    let available = true;
    let source = '';

    if (field === 'username') {
      // Check pengguna table
      const res = await pool.query(`SELECT id FROM pengguna WHERE username = $1 LIMIT 1`, [value]);
      if ((res.rowCount ?? 0) > 0) { available = false; source = 'pengguna'; }
      if (available) {
        // Check pending registrations
        const res2 = await pool.query(
          `SELECT id FROM pendaftaran_jemaat WHERE username = $1 AND status = 'menunggu' LIMIT 1`,
          [value]
        );
        if ((res2.rowCount ?? 0) > 0) { available = false; source = 'pendaftaran'; }
      }
    } else {
      // no_hp or email — check pengguna table
      const res = await pool.query(`SELECT id FROM pengguna WHERE ${field} = $1 LIMIT 1`, [value]);
      if ((res.rowCount ?? 0) > 0) { available = false; source = 'pengguna'; }
      if (available) {
        // Check pending registrations
        const res2 = await pool.query(
          `SELECT id FROM pendaftaran_jemaat WHERE ${field} = $1 AND status = 'menunggu' LIMIT 1`,
          [value]
        );
        if ((res2.rowCount ?? 0) > 0) { available = false; source = 'pendaftaran'; }
      }
    }

    return NextResponse.json({ success: true, available, source: available ? null : source });
  } catch (error: any) {
    console.error('[public/check-duplicate]', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
