import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/server/utils/jwt';
import { UserRepository } from '@/server/repositories/user.repository';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const userRepository = new UserRepository();

// GET /api/kegiatan/registrasi/saya
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    // Extract user identity
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    const user = await userRepository.findById(decoded.user_id);
    
    if (!user || (!user.jemaat_id && !user.is_super_admin)) {
       return NextResponse.json({ success: true, data: [] }); // User is not linked to any jemaat_id
    }

    const targetJemaatId = user.jemaat_id;

    const query = `
      SELECT 
        r.*,
        k.nama_kegiatan,
        k.kode_kegiatan,
        k.tanggal_mulai,
        k.waktu_mulai,
        k.lokasi_kegiatan,
        k.url_banner,
        s.nama_satelit
      FROM public.kegiatan_registrasi r
      JOIN public.kegiatan k ON r.kegiatan_id = k.id
      LEFT JOIN public.satelit s ON k.satelit_id = s.id
      WHERE r.jemaat_id = $1
      ORDER BY r.tanggal_daftar DESC
    `;

    const result = await pool.query(query, [targetJemaatId]);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching my registrations:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
