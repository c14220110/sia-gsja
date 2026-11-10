import { NextRequest, NextResponse } from 'next/server';
import { akunAksesRepository } from '@/server/repositories/akunAkses.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    // Cek Keamanan: Super admin silakan masuk ATAU siapapun yang pegang tiket 'akses_sementara_manage'
    const isAuthorized = caller && (caller.is_super_admin || caller.permissions?.includes('akses_sementara_manage'));
    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { jemaat_id, email, password, role_id, satelit_id, tanggal_mulai, tanggal_selesai } = body;

    if (!jemaat_id || !role_id || !satelit_id || !tanggal_mulai || !tanggal_selesai) {
      return NextResponse.json({ success: false, message: 'Field jemaat, role, satelit, dan durasi wajib diisi!' }, { status: 400 });
    }

    // Muter-muter coba liat kali aja user-nya udah nongkrong
    const existUser = await pool.query(`SELECT id FROM pengguna WHERE jemaat_id = $1`, [jemaat_id]);
    let userId;

    if (existUser.rowCount && existUser.rowCount > 0) {
      // Ternyata udah ada toh akunnya, yaudah colong pake ID itu aja
      userId = existUser.rows[0].id;
    } else {
      // Kalau belom ada, ciptain user fresh buat Jemaat ini
      if (!email || !password) {
        return NextResponse.json({ success: false, message: 'Jemaat ini belum memiliki akun. Mohon isi Email dan Password untuk membuatkannya akses login baru.' }, { status: 400 });
      }
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const insUser = await pool.query(`
        INSERT INTO pengguna (email, password_hash, jemaat_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [email, password_hash, jemaat_id]);
      
      userId = insUser.rows[0].id;
    }

    const result = await akunAksesRepository.addTemporaryAccess({
      user_id: userId,
      role_id: parseInt(role_id),
      satelit_id: parseInt(satelit_id),
      tanggal_mulai,
      tanggal_selesai
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Akses sementara panitia berhasil dibuat!' });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/users/temp-access POST:', error);
    if (error.code === '23505') {
        return NextResponse.json({ success: false, message: 'Email sudah terdaftar untuk pengguna lain.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
