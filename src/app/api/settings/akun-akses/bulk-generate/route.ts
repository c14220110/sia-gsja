import { NextRequest, NextResponse } from 'next/server';
import { akunAksesRepository } from '@/server/repositories/akunAkses.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all'; // 'all' | 'no_account'

    let query = `
      SELECT 
        j.id, 
        j.jemaat_id, 
        j.nama_lengkap, 
        j.email,
        j.no_hp,
        s.nama_satelit,
        j.tanggal_lahir,
        CASE WHEN p.id IS NOT NULL THEN true ELSE false END as has_account
      FROM jemaat j
      LEFT JOIN satelit s ON j.satelit_id = s.id
      LEFT JOIN pengguna p ON j.id = p.jemaat_id
      WHERE j.is_deleted = false
    `;

    if (filter === 'no_account') {
      query += ` AND p.id IS NULL`;
    }

    query += ` ORDER BY j.nama_lengkap ASC`;

    const { rows } = await pool.query(query);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/bulk-generate GET:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerFromRequest(req);
    // Hanya Super Admin yang bisa melakukan bulk generate
    if (!caller || !caller.is_super_admin) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { jemaat_ids } = body; // Array of jemaat primary keys (number[])

    if (!Array.isArray(jemaat_ids) || jemaat_ids.length === 0) {
      return NextResponse.json({ success: false, message: 'Harap pilih minimal 1 jemaat' }, { status: 400 });
    }

    // Tarik sejelas-jelasnya data detail Jemaat mengacu ID dari seberang
    const jemaatQuery = `
      SELECT id, nama_lengkap, email, no_hp, tanggal_lahir, satelit_id
      FROM jemaat
      WHERE id = ANY($1::int[]) AND is_deleted = false
    `;
    const { rows: jemaatList } = await pool.query(jemaatQuery, [jemaat_ids]);

    let noIdentifierCount = 0;
    const dataToInsert = [];

    for (const j of jemaatList) {
      const hasEmail = j.email && j.email.trim() !== '';
      const hasNoHp = j.no_hp && j.no_hp.trim() !== '';

      if (!hasEmail && !hasNoHp) {
        noIdentifierCount++;
        continue;
      }

      // Format password default dari tanggal_lahir DD/MM/YYYY
      let defaultPassword = null;
      if (j.tanggal_lahir) {
        const d = new Date(j.tanggal_lahir);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        defaultPassword = `${day}/${month}/${year}`;
      } else {
        // Fallback default password jika tidak ada tanggal lahir
        defaultPassword = 'gsja' + new Date().getFullYear();
      }

      const password_hash = await bcrypt.hash(defaultPassword, 10);

      // Simpan KEDUANYA email + no_hp agar jemaat bisa login dengan salah satu.
      // Login API (findByIdentifier) sudah mendukung: WHERE email = $1 OR no_hp = $1
      dataToInsert.push({
        email: hasEmail ? j.email.trim() : null,
        no_hp: hasNoHp ? j.no_hp.trim() : null,
        password_hash,
        jemaat_id: j.id,
        satelit_id: j.satelit_id,
        nama_lengkap: j.nama_lengkap
      });
    }

    if (dataToInsert.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: `Gagal. Dari ${jemaat_ids.length} yang dipilih, tidak ada satupun yang memiliki alamat email atau nomor handphone.` 
      });
    }

    const result = await akunAksesRepository.bulkCreatePengguna(dataToInsert);

    if (result.success) {
      const skipped = result.noIdentifierCount ?? 0;
      const skippedList = result.skippedList ?? [];
      return NextResponse.json({ 
        success: true, 
        message: 'Berhasil membuat ' + result.createdCount + ' akun.' + (skipped > 0 ? ' ' + skipped + ' jemaat dilewati.' : ''),
        createdCount: result.createdCount,
        noIdentifierCount: skipped,
        skippedList
      });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error in /api/settings/akun-akses/bulk-generate POST:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
