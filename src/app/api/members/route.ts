import { NextRequest, NextResponse } from 'next/server';
import { JemaatRepository, JemaatFilterParams } from '@/server/repositories/jemaat.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

function formatDobPassword(val: any): string {
  if (!val) return 'gsja' + new Date().getFullYear();
  if (val instanceof Date) {
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${day}/${month}/${year}`;
  }
  if (typeof val === 'string') {
    const parts = val.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  }
  return 'gsja' + new Date().getFullYear();
}

const jemaatRepository = new JemaatRepository();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: JemaatFilterParams = {
      search: searchParams.get('search') || undefined,
      satelit_id: searchParams.get('satelit_id') || undefined,
      komisi_id: searchParams.get('komisi_id') || undefined,
      status_jemaat: searchParams.get('status_jemaat') || undefined,
      status_baptis: searchParams.get('status_baptis') || undefined,
      jenis_kelamin: searchParams.get('jenis_kelamin') || undefined,
      rentang_umur: searchParams.get('rentang_umur') || undefined,
      has_foto: searchParams.get('has_foto') || undefined,
      hide_dummy: searchParams.get('hide_dummy') === 'true',
      limit: searchParams.has('limit') ? parseInt(searchParams.get('limit')!) : 10,
      offset: searchParams.has('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    // Cek hak akses (RBAC)
    const caller = getCallerFromRequest(request);

    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('jemaat_view'))) {
      return NextResponse.json({
        success: false,
        message: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat data jemaat (jemaat_view) atau token Anda kadaluarsa/tidak valid.',
      }, { status: 403 });
    }

    // Kalau kagak dapet view muti_satelit -> yah kepaksa harus disaring satelit sendiri
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
       params.satelit_id = caller.satelit_id?.toString();
    }

    const result = await jemaatRepository.getJemaatPagination(params);

    return NextResponse.json({
      success: true,
      message: 'Berhasil mengambil data jemaat',
      data: result.data,
      meta: {
        total: result.total,
        jemaat_baru: result.jemaat_baru,
        limit: params.limit,
        offset: params.offset,
      }
    });
  } catch (error: any) {
    console.error('GET /api/members error:', error);
    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan pada server saat mengambil data jemaat.',
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Satpam pengecekan: Dia punya kunci buat nyiptain data jemaat gak?
    const caller = getCallerFromRequest(request);

    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('jemaat_create'))) {
      return NextResponse.json({
        success: false,
        message: 'Akses Ditolak: Anda tidak memiliki izin untuk mendaftarkan jemaat baru (jemaat_create).',
      }, { status: 403 });
    }

    const body = await request.json();

    // Validasi: nama_lengkap wajib diisi
    if (!body.nama_lengkap || typeof body.nama_lengkap !== 'string' || body.nama_lengkap.trim() === '') {
      return NextResponse.json({
        success: false,
        message: 'Nama lengkap wajib diisi',
      }, { status: 400 });
    }

    // Penting: Wajib bin harus ngisi satelit_id (Tabelnya nangis kalo kosong)
    if (!body.satelit_id && body.satelit_id !== 0) {
      return NextResponse.json({
        success: false,
        message: 'Satelit wajib dipilih',
      }, { status: 400 });
    }

    // Validasi username unik SEBELUM membuat data jemaat (hindari orphan data)
    if (body.tidak_punya_kontak && body.username) {
      const username = body.username.trim();
      if (!username) {
        return NextResponse.json({
          success: false,
          message: 'Username wajib diisi jika tidak memiliki Email/No. Telepon.',
        }, { status: 400 });
      }
      const existingUser = await pool.query(
        `SELECT id FROM pengguna WHERE username = $1`,
        [username]
      );
      if (existingUser.rowCount && existingUser.rowCount > 0) {
        return NextResponse.json({
          success: false,
          message: `Username "${username}" sudah digunakan. Silakan gunakan username lain.`,
        }, { status: 400 });
      }
    }

    const newId = await jemaatRepository.createJemaat(body);

    // === AUTO-CREATE AKUN PENGGUNA ===
    // Otomatis buatkan akun login untuk semua jemaat yang baru didaftarkan.
    // Login identifier: no_hp + email (jika ada), atau username (jika tidak punya kontak).
    // Password default: tanggal_lahir format DD/MM/YYYY, atau fallback gsja<tahun>.
    const hasEmail = body.email && body.email.trim() !== '';
    const hasNoHp = body.no_hp && body.no_hp.trim() !== '';
    const hasUsername = body.tidak_punya_kontak && body.username && body.username.trim() !== '';

    if (hasEmail || hasNoHp || hasUsername) {
      // Cek apakah jemaat sudah punya akun (seharusnya belum karena baru dibuat, tapi aman untuk dicek)
      const existCheck = await pool.query(`SELECT id FROM pengguna WHERE jemaat_id = $1`, [newId]);
      if (!existCheck.rowCount || existCheck.rowCount === 0) {
        // Generate password dari tanggal lahir (format DD/MM/YYYY)
        const defaultPassword = formatDobPassword(body.tanggal_lahir);
        const password_hash = await bcrypt.hash(defaultPassword, 10);

        const emailToInsert = hasEmail ? body.email.trim() : null;
        const noHpToInsert = hasNoHp ? body.no_hp.trim() : null;
        const usernameToInsert = hasUsername ? body.username.trim() : null;

        // Cek konflik identifier — null-kan yang konflik agar tidak gagal total
        let finalEmail = emailToInsert;
        let finalNoHp = noHpToInsert;
        const finalUsername = usernameToInsert;

        if (finalEmail) {
          const emailConflict = await pool.query(`SELECT id FROM pengguna WHERE email = $1`, [finalEmail]);
          if (emailConflict.rowCount && emailConflict.rowCount > 0) finalEmail = null;
        }
        if (finalNoHp) {
          const noHpConflict = await pool.query(`SELECT id FROM pengguna WHERE no_hp = $1`, [finalNoHp]);
          if (noHpConflict.rowCount && noHpConflict.rowCount > 0) finalNoHp = null;
        }
        // username sudah dicek unik di atas (sebelum createJemaat)

        // Pastikan minimal ada 1 identifier valid setelah deduplikasi
        if (finalEmail || finalNoHp || finalUsername) {
          const insUser = await pool.query(`
            INSERT INTO pengguna (email, no_hp, username, password_hash, jemaat_id, requires_password_change)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING id
          `, [finalEmail, finalNoHp, finalUsername, password_hash, newId]);

          const userId = insUser.rows[0].id;

          // Assign role JEMAAT otomatis
          const roleRow = await pool.query(`SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT' LIMIT 1`);
          if (roleRow.rowCount && roleRow.rowCount > 0) {
            const roleJemaatId = roleRow.rows[0].id;
            const satelitId = parseInt(body.satelit_id);
            await pool.query(`
              INSERT INTO user_role (user_id, role_id, satelit_id)
              VALUES ($1, $2, $3)
              ON CONFLICT DO NOTHING
            `, [userId, roleJemaatId, satelitId]);
          }
        }
      }
    }

    // Catat riwayat audit untuk aksi pembuatan
    if (caller) {
      await auditLogRepository.insertAuditLog({
        jemaat_id:  newId,
        aksi:       'CREATE',
        user_id:    caller.user_id,
        role_id:    caller.role_id,
        satelit_id: caller.satelit_id,
        keterangan: 'Data jemaat baru ditambahkan',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Berhasil menambahkan data jemaat',
      data: { id: newId }
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/members error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Gagal menambahkan data jemaat',
    }, { status: 500 });
  }
}
