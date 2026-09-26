import { NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!caller.is_super_admin && !caller.permissions?.includes('jemaat_create')) {
    return NextResponse.json({ success: false, message: 'Akses ditolak' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const res = await pool.query(
      `SELECT p.*, s.nama_satelit
       FROM pendaftaran_jemaat p
       LEFT JOIN satelit s ON p.satelit_id = s.id
       WHERE p.id = $1`,
      [parseInt(id, 10)]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
    }

    const row = res.rows[0];
    if (!caller.is_super_admin && caller.satelit_id && caller.satelit_id !== 1) {
      if (row.satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Akses ditolak: Pendaftaran ini milik satelit lain' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: row });
  } catch (error: any) {
    console.error('[pendaftaran-jemaat/id GET]', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!caller.is_super_admin && !caller.permissions?.includes('jemaat_create')) {
    return NextResponse.json({ success: false, message: 'Akses ditolak' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, catatan } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, message: 'action harus approve atau reject' }, { status: 400 });
    }

    // Fetch the pendaftaran record
    const pending = await client.query(
      `SELECT * FROM pendaftaran_jemaat WHERE id = $1`,
      [parseInt(id, 10)]
    );

    if ((pending.rowCount ?? 0) === 0) {
      return NextResponse.json({ success: false, message: 'Data tidak ditemukan' }, { status: 404 });
    }

    const p = pending.rows[0];

    // Satelit scope check
    if (!caller.is_super_admin && caller.satelit_id && caller.satelit_id !== 1) {
      if (p.satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Akses ditolak: Pendaftaran ini milik satelit lain' }, { status: 403 });
      }
    }

    if (p.status !== 'menunggu') {
      return NextResponse.json({ success: false, message: `Pendaftaran sudah diproses (status: ${p.status})` }, { status: 400 });
    }

    await client.query('BEGIN');

    if (action === 'reject') {
      await client.query(
        `UPDATE pendaftaran_jemaat SET status='ditolak', catatan_review=$1, reviewed_by=$2, reviewed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$3`,
        [catatan || null, caller.user_id, parseInt(id, 10)]
      );
      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Pendaftaran ditolak.' });
    }

    // === APPROVE: generate jemaat_id and insert into jemaat ===

    // Generate jemaat_id
    const tglLahir = p.tanggal_lahir ? new Date(p.tanggal_lahir) : null;
    const dd = tglLahir ? String(tglLahir.getDate()).padStart(2, '0') : '01';
    const mm = tglLahir ? String(tglLahir.getMonth() + 1).padStart(2, '0') : '01';
    const yy = tglLahir ? String(tglLahir.getFullYear()).slice(-2) : '00';
    const dateCode = `${dd}${mm}${yy}`;
    const existing = await client.query(
      `SELECT jemaat_id FROM jemaat WHERE jemaat_id LIKE $1 ORDER BY jemaat_id DESC LIMIT 1`,
      [`${dateCode}%`]
    );
    let nextNum = 0;
    if ((existing.rowCount ?? 0) > 0) {
      const last = existing.rows[0].jemaat_id;
      const lastCounter = parseInt(last.slice(-2), 10);
      nextNum = lastCounter + 1;
    }
    const jemaat_id = `${dateCode}${String(nextNum).padStart(2, '0')}`;

    // Insert into jemaat
    const insertRes = await client.query(
      `INSERT INTO jemaat (
        jemaat_id, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir,
        alamat, kota, kecamatan, kelurahan, kode_pos,
        no_hp, email, pekerjaan, pekerjaan_id, satelit_id, foto_url,
        status_baptis, status_pernikahan, status_jemaat,
        ayah_id, ayah_nama, gereja_asal_ayah,
        ibu_id, ibu_nama, gereja_asal_ibu,
        pasangan_id, pasangan_nama, gereja_asal_pasangan,
        is_deleted
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22,
        $23, $24, $25,
        $26, $27, $28,
        false
      ) RETURNING id`,
      [
        jemaat_id, p.nama_lengkap, p.jenis_kelamin, p.tempat_lahir, p.tanggal_lahir,
        p.alamat, p.kota, p.kecamatan, p.kelurahan, p.kode_pos,
        p.no_hp || null, p.email || null, p.pekerjaan || null, p.pekerjaan_id || null, p.satelit_id, p.foto_url || null,
        p.status_baptis, p.status_pernikahan || null, 'Aktif',
        p.ayah_id || null, p.ayah_nama || null, p.gereja_asal_ayah || null,
        p.ibu_id || null, p.ibu_nama || null, p.gereja_asal_ibu || null,
        p.pasangan_id || null, p.pasangan_nama || null, p.gereja_asal_pasangan || null,
      ]
    );

    const newJemaatId = insertRes.rows[0].id;

    // Insert anak relasi
    const anakList: any[] = p.anak || [];
    for (const anak of anakList) {
      if (!anak.nama_anak && !anak.anak_jemaat_id) continue;
      await client.query(
        `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait, gereja_asal)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newJemaatId,
          anak.anak_jemaat_id ? parseInt(anak.anak_jemaat_id, 10) : null,
          2, // jenis_relasi 'Anak'
          anak.nama_anak || null,
          anak.gereja_asal_anak || null,
        ]
      );
    }

    // Insert saudara relasi (bidirectional)
    const saudaraList: any[] = p.saudara || [];
    for (const saudara of saudaraList) {
      if (!saudara.nama_saudara && !saudara.saudara_jemaat_id) continue;
      await client.query(
        `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait, gereja_asal)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newJemaatId,
          saudara.saudara_jemaat_id ? parseInt(saudara.saudara_jemaat_id, 10) : null,
          1, // jenis_relasi 'Saudara Kandung'
          saudara.nama_saudara || null,
          saudara.gereja_asal_saudara || null,
        ]
      );
      // Bidirectional: if existing jemaat, also add reverse relation
      if (saudara.saudara_jemaat_id) {
        await client.query(
          `INSERT INTO relasi_jemaat (jemaat_id, jemaat_terkait_id, jenis_relasi_id, nama_terkait, gereja_asal)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [
            parseInt(saudara.saudara_jemaat_id, 10),
            newJemaatId,
            1,
            p.nama_lengkap,
            null,
          ]
        );
      }
    }

    // Update pendaftaran status
    await client.query(
      `UPDATE pendaftaran_jemaat
       SET status='disetujui', reviewed_by=$1, reviewed_at=CURRENT_TIMESTAMP,
           jemaat_result_id=$2, updated_at=CURRENT_TIMESTAMP
       WHERE id=$3`,
      [caller.user_id, newJemaatId, parseInt(id, 10)]
    );

    // === AUTO-CREATE / LINK AKUN PENGGUNA ===
    // Saat disetujui, link/buat akun pengguna ke jemaat yang baru dibuat.
    // Kasus 1: Pengguna sudah ada (dari self-registration) → update jemaat_id
    // Kasus 2: Pengguna belum ada (approve langsung tanpa self-reg) → buat baru
    const hasEmail = p.email && p.email.trim() !== '';
    const hasNoHp = p.no_hp && p.no_hp.trim() !== '';
    const hasUsername = p.tidak_punya_kontak && p.username && p.username.trim() !== '';

    if (hasEmail || hasNoHp || hasUsername) {
      // Cari akun pendaftaran sementara (yang dibuat saat self-registration, dengan jemaat_id IS NULL)
      let existingUserId: number | null = null;

      if (hasEmail) {
        const ec = await client.query(`SELECT id FROM pengguna WHERE email = $1 AND jemaat_id IS NULL`, [p.email.trim()]);
        if (ec.rowCount && ec.rowCount > 0) existingUserId = ec.rows[0].id;
      }
      if (!existingUserId && hasNoHp) {
        const nc = await client.query(`SELECT id FROM pengguna WHERE no_hp = $1 AND jemaat_id IS NULL`, [p.no_hp.trim()]);
        if (nc.rowCount && nc.rowCount > 0) existingUserId = nc.rows[0].id;
      }
      if (!existingUserId && hasUsername) {
        const uc = await client.query(`SELECT id FROM pengguna WHERE username = $1 AND jemaat_id IS NULL`, [p.username.trim()]);
        if (uc.rowCount && uc.rowCount > 0) existingUserId = uc.rows[0].id;
      }

      if (existingUserId) {
        // Pengguna sudah ada → tautkan jemaat_id dan pastikan role JEMAAT terupdate dengan satelit yang benar
        await client.query(
          `UPDATE pengguna SET jemaat_id = $1, updated_at = NOW() WHERE id = $2`,
          [newJemaatId, existingUserId]
        );
        // Update satelit_id di user_role ke yang benar
        const roleRow = await client.query(`SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT' LIMIT 1`);
        if (roleRow.rowCount && roleRow.rowCount > 0) {
          await client.query(`
            INSERT INTO user_role (user_id, role_id, satelit_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, role_id, satelit_id) DO UPDATE SET is_active = true
          `, [existingUserId, roleRow.rows[0].id, p.satelit_id]);
        }
      } else {
        // Pengguna belum ada → buat akun baru
        const defaultPassword = formatDobPassword(p.tanggal_lahir);
        const password_hash = await bcrypt.hash(defaultPassword, 10);

        let finalEmail = hasEmail ? p.email.trim() : null;
        let finalNoHp = hasNoHp ? p.no_hp.trim() : null;
        const finalUsername = hasUsername ? p.username.trim() : null;

        // Null-kan identifier yang sudah dipakai pengguna lain (jangan gagalkan approve)
        if (finalEmail) {
          const ec = await client.query(`SELECT id FROM pengguna WHERE email = $1`, [finalEmail]);
          if (ec.rowCount && ec.rowCount > 0) finalEmail = null;
        }
        if (finalNoHp) {
          const nc = await client.query(`SELECT id FROM pengguna WHERE no_hp = $1`, [finalNoHp]);
          if (nc.rowCount && nc.rowCount > 0) finalNoHp = null;
        }

        if (finalEmail || finalNoHp || finalUsername) {
          const insUser = await client.query(`
            INSERT INTO pengguna (email, no_hp, username, password_hash, jemaat_id, requires_password_change)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING id
          `, [finalEmail, finalNoHp, finalUsername, password_hash, newJemaatId]);

          const userId = insUser.rows[0].id;
          const roleRow = await client.query(`SELECT id FROM role WHERE UPPER(nama_role) = 'JEMAAT' LIMIT 1`);
          if (roleRow.rowCount && roleRow.rowCount > 0) {
            await client.query(`
              INSERT INTO user_role (user_id, role_id, satelit_id)
              VALUES ($1, $2, $3)
              ON CONFLICT DO NOTHING
            `, [userId, roleRow.rows[0].id, p.satelit_id]);
          }
        }
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Pendaftaran disetujui. Jemaat baru ${p.nama_lengkap} berhasil terdaftar dengan ID ${jemaat_id}.`,
      jemaat_id: jemaat_id,
      jemaat_db_id: newJemaatId,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[pendaftaran-jemaat/id PUT]', error);
    return NextResponse.json({ success: false, message: error.message || 'Gagal memproses' }, { status: 500 });
  } finally {
    client.release();
  }
}
