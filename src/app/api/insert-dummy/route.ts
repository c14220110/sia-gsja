import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    await pool.query(`
      INSERT INTO public.kegiatan_jadwal_pelayan (kegiatan_id, pelayan_id, status_konfirmasi, role_id) 
      VALUES 
      (84, 2, 'Hadir', 6),
      (84, 3, 'Bersedia', 12),
      (84, 7, 'Berhalangan', 13),
      (84, 8, 'Menunggu Konfirmasi', 14),
      (84, 9, 'Hadir', 12),
      (84, 11, 'Hadir', 6);
    `);
    return NextResponse.json({ success: true, message: 'Dummy data inserted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
