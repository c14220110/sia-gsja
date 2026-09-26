import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nama_lengkap,
      jenis_kelamin,
      tempat_lahir,
      tanggal_lahir,
      alamat,
      kota,
      kecamatan,
      kelurahan,
      kode_pos,
      no_hp,
      email,
      pekerjaan,
      pekerjaan_id,
      satelit_id,
      foto_url,
      status_baptis,
      status_pernikahan,
      status_jemaat,
      ayah_id,
      ayah_nama,
      gereja_asal_ayah,
      ibu_id,
      ibu_nama,
      gereja_asal_ibu,
      pasangan_id,
      pasangan_nama,
      gereja_asal_pasangan,
      anak,
      saudara,
      tidak_punya_kontak,
      username,
    } = body;

    // Basic validation
    if (!nama_lengkap?.trim()) {
      return NextResponse.json({ success: false, message: 'Nama lengkap wajib diisi.' }, { status: 400 });
    }
    if (!satelit_id) {
      return NextResponse.json({ success: false, message: 'Satelit wajib dipilih.' }, { status: 400 });
    }
    if (!kota?.trim()) {
      return NextResponse.json({ success: false, message: 'Kota wajib diisi.' }, { status: 400 });
    }
    if (!tidak_punya_kontak && !no_hp && !email) {
      return NextResponse.json({ success: false, message: 'Harap isi minimal No. Telepon atau Alamat Email.' }, { status: 400 });
    }
    if (tidak_punya_kontak && !username?.trim()) {
      return NextResponse.json({ success: false, message: 'Username wajib diisi jika tidak memiliki Email/No. Telepon.' }, { status: 400 });
    }

    // Get IP address for audit
    const ip_address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                       request.headers.get('x-real-ip') || null;
    const user_agent = request.headers.get('user-agent') || null;

    // Convert status_baptis string to boolean
    const statusBaptisBoolean = status_baptis === 'Sudah' || status_baptis === true;

    const res = await pool.query(
      `INSERT INTO pendaftaran_jemaat (
        nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir,
        alamat, kota, kecamatan, kelurahan, kode_pos,
        no_hp, email, pekerjaan, pekerjaan_id, satelit_id, foto_url,
        status_baptis, status_pernikahan, status_jemaat,
        ayah_id, ayah_nama, gereja_asal_ayah,
        ibu_id, ibu_nama, gereja_asal_ibu,
        pasangan_id, pasangan_nama, gereja_asal_pasangan,
        anak, saudara, tidak_punya_kontak, username,
        ip_address, user_agent
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21,
        $22, $23, $24,
        $25, $26, $27,
        $28, $29, $30, $31,
        $32, $33
      ) RETURNING id`,
      [
        nama_lengkap?.trim(),
        jenis_kelamin || null,
        tempat_lahir || null,
        tanggal_lahir || null,
        alamat || null,
        kota?.trim(),
        kecamatan || null,
        kelurahan || null,
        kode_pos || null,
        no_hp || null,
        email || null,
        pekerjaan || null,
        pekerjaan_id || null,
        parseInt(satelit_id, 10),
        foto_url || null,
        statusBaptisBoolean,
        status_pernikahan || null,
        status_jemaat || 'Aktif',
        ayah_id ? parseInt(ayah_id, 10) : null,
        ayah_nama || null,
        gereja_asal_ayah || null,
        ibu_id ? parseInt(ibu_id, 10) : null,
        ibu_nama || null,
        gereja_asal_ibu || null,
        pasangan_id ? parseInt(pasangan_id, 10) : null,
        pasangan_nama || null,
        gereja_asal_pasangan || null,
        JSON.stringify(anak || []),
        JSON.stringify(saudara || []),
        tidak_punya_kontak || false,
        username?.trim() || null,
        ip_address,
        user_agent,
      ]
    );

    const pendaftaranId = res.rows[0].id;

    // === AUTO-CREATE AKUN PENGGUNA ===
    // Buat akun login segera setelah pendaftaran dikirim agar jemaat bisa login langsung.
    // jemaat_id di pengguna = NULL dulu (akan diisi saat sekretaris approve).
    // Password = tanggal_lahir format DD/MM/YYYY, atau fallback gsja<tahun>.
    const hasIdentifier = !!(no_hp?.trim() || email?.trim() || (tidak_punya_kontak && username?.trim()));
    if (hasIdentifier) {
      const defaultPassword = formatDobPassword(tanggal_lahir);
      const password_hash = await bcrypt.hash(defaultPassword, 10);

      let finalEmail = email?.trim() || null;
      let finalNoHp = no_hp?.trim() || null;
      const finalUsername = (tidak_punya_kontak && username?.trim()) ? username.trim() : null;

      // Cek konflik identifier — null-kan yang konflik, jangan gagalkan pendaftaran
      if (finalEmail) {
        const ec = await pool.query(`SELECT id FROM pengguna WHERE email = $1`, [finalEmail]);
        if (ec.rowCount && ec.rowCount > 0) finalEmail = null;
      }
      if (finalNoHp) {
        const nc = await pool.query(`SELECT id FROM pengguna WHERE no_hp = $1`, [finalNoHp]);
        if (nc.rowCount && nc.rowCount > 0) finalNoHp = null;
      }
      let finalUsernameClean = finalUsername;
      if (finalUsernameClean) {
        const uc = await pool.query(`SELECT id FROM pengguna WHERE username = $1`, [finalUsernameClean]);
        if (uc.rowCount && uc.rowCount > 0) finalUsernameClean = null; // username sudah dipakai
      }

      // Buat pengguna jika minimal ada 1 identifier valid setelah dedup
      if (finalEmail || finalNoHp || finalUsernameClean) {
        const insUser = await pool.query(`
          INSERT INTO pengguna (email, no_hp, username, password_hash, jemaat_id, requires_password_change)
          VALUES ($1, $2, $3, $4, NULL, true)
          RETURNING id
        `, [finalEmail, finalNoHp, finalUsernameClean, password_hash]);
        const userId = insUser.rows[0].id;
        // Assign role JEMAAT sementara
        const roleRow = await pool.query(`SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT' LIMIT 1`);
        if (roleRow.rowCount && roleRow.rowCount > 0) {
          await pool.query(`
            INSERT INTO user_role (user_id, role_id, satelit_id)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [userId, roleRow.rows[0].id, parseInt(satelit_id, 10)]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Pendaftaran berhasil dikirim! Akun login Anda sudah siap — gunakan No. HP, Email, atau Username dan tanggal lahir Anda (contoh: 20112003 atau 20/11/2003) sebagai password.',
      id: pendaftaranId,
    });
  } catch (error: any) {
    console.error('[public/daftar-jemaat POST]', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Terjadi kesalahan. Silakan coba lagi.',
    }, { status: 500 });
  }
}
