import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const query = `
      SELECT 
        ka.id,
        ka.kegiatan_id,
        ka.jemaat_id,
        ka.role_kehadiran,
        ka.status_kehadiran,
        j.nama_lengkap,
        j.foto_url
      FROM public.kegiatan_absensi ka
      JOIN public.jemaat j ON ka.jemaat_id = j.id
      WHERE ka.kegiatan_id = $1 AND ka.role_kehadiran != 'Jemaat'
      ORDER BY ka.role_kehadiran ASC, j.nama_lengkap ASC
    `;

    const result = await pool.query(query, [id]);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching pelayan kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const body = await request.json();
    const { jemaat_id, role_kehadiran } = body;

    if (!jemaat_id || !role_kehadiran) {
      return NextResponse.json({ success: false, message: 'ID Jemaat dan Role wajib diisi' }, { status: 400 });
    }

    // Check if already exists
    const checkQuery = `SELECT id FROM public.kegiatan_absensi WHERE kegiatan_id = $1 AND jemaat_id = $2 AND role_kehadiran = $3`;
    const checkResult = await pool.query(checkQuery, [id, jemaat_id, role_kehadiran]);
    if (checkResult.rows.length > 0) {
      return NextResponse.json({ success: false, message: 'Pelayan dengan peran tersebut sudah ditambahkan' }, { status: 400 });
    }

    const insertQuery = `
      INSERT INTO public.kegiatan_absensi (kegiatan_id, jemaat_id, role_kehadiran, status_kehadiran)
      VALUES ($1, $2, $3, 'Hadir')
      RETURNING id
    `;
    const result = await pool.query(insertQuery, [id, jemaat_id, role_kehadiran]);

    return NextResponse.json({ success: true, message: 'Pelayan berhasil ditambahkan', data: { id: result.rows[0].id } });
  } catch (error) {
    console.error('Error adding pelayan kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
