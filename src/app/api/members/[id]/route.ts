import { NextRequest, NextResponse } from 'next/server';
import { JemaatRepository } from '@/server/repositories/jemaat.repository';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';

const jemaatRepository = new JemaatRepository();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Silakan login terlebih dahulu.' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const jemaat = await jemaatRepository.getJemaatById(id);
    
    if (!jemaat) {
      return NextResponse.json({ success: false, message: 'Jemaat tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: jemaat }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/members/[id]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('jemaat_edit'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah data jemaat (jemaat_edit).' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const body = await request.json();

    // Validasi: nama_lengkap wajib diisi
    if (!body.nama_lengkap || typeof body.nama_lengkap !== 'string' || body.nama_lengkap.trim() === '') {
      return NextResponse.json({ success: false, message: 'Nama lengkap wajib diisi' }, { status: 400 });
    }

    // ── Cek uniqueness SEBELUM update ───────────────────────────────────────
    // Cari akun pengguna yang terhubung ke jemaat ini
    const penggunaRes = await pool.query(
      'SELECT id, email, no_hp, username FROM pengguna WHERE jemaat_id = $1 LIMIT 1',
      [parseInt(id)]
    );
    const penggunaRow = penggunaRes.rows[0] ?? null;

    if (penggunaRow) {
      // Cek email baru sudah dipakai orang lain?
      const newEmail = body.email?.trim() || null;
      if (newEmail && newEmail !== penggunaRow.email) {
        const emailCheck = await pool.query(
          'SELECT id FROM pengguna WHERE email = $1 AND id != $2',
          [newEmail, penggunaRow.id]
        );
        if (emailCheck.rowCount && emailCheck.rowCount > 0) {
          return NextResponse.json({ success: false, message: `Email "${newEmail}" sudah digunakan oleh jemaat lain.` }, { status: 400 });
        }
      }

      // Cek no_hp baru sudah dipakai orang lain?
      const newNoHp = body.no_hp?.trim() || null;
      if (newNoHp && newNoHp !== penggunaRow.no_hp) {
        const hpCheck = await pool.query(
          'SELECT id FROM pengguna WHERE no_hp = $1 AND id != $2',
          [newNoHp, penggunaRow.id]
        );
        if (hpCheck.rowCount && hpCheck.rowCount > 0) {
          return NextResponse.json({ success: false, message: `No. HP "${newNoHp}" sudah terdaftar sebagai akun login jemaat lain.` }, { status: 400 });
        }
      }

      // Cek username baru sudah dipakai orang lain?
      // Hanya proses jika field 'username' benar-benar dikirim dalam payload
      if ('username' in body) {
        const newUsername = typeof body.username === 'string' ? body.username.trim() || null : null;
        if (newUsername !== penggunaRow.username) {
          if (newUsername) {
            const usernameCheck = await pool.query(
              'SELECT id FROM pengguna WHERE username = $1 AND id != $2',
              [newUsername, penggunaRow.id]
            );
            if (usernameCheck.rowCount && usernameCheck.rowCount > 0) {
              return NextResponse.json({ success: false, message: `Username "${newUsername}" sudah digunakan oleh pengguna lain.` }, { status: 400 });
            }
          }
          // Jaga constraint chk_min_satu_identifier: setelah save, min 1 harus terisi
          // afterEmail = nilai baru jika email dikirim, else nilai lama di pengguna
          const afterEmail = ('email' in body) ? (body.email?.trim() || null) : penggunaRow.email;
          const afterHp    = ('no_hp' in body) ? (body.no_hp?.trim() || null) : penggunaRow.no_hp;
          if (!newUsername && !afterEmail && !afterHp) {
            return NextResponse.json({ success: false, message: 'Tidak bisa menghapus username karena jemaat ini tidak punya email atau no HP.' }, { status: 400 });
          }
        }
      }
    }


    // ── Update tabel jemaat ─────────────────────────────────────────────────
    const updated = await jemaatRepository.updateJemaat(id, body);
    
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Jemaat tidak ditemukan atau gagal diupdate' }, { status: 404 });
    }

    // ── Sync ke tabel pengguna jika ada akun login ──────────────────────────
    if (penggunaRow) {
      const syncUpdates: string[] = [];
      const syncVals: any[] = [];
      let idx = 1;

      const syncEmail = body.email?.trim() || null;
      const syncNoHp = body.no_hp?.trim() || null;
      // Hanya sync username jika benar-benar dikirim dalam payload
      const syncUsername = 'username' in body
        ? (typeof body.username === 'string' ? body.username.trim() || null : null)
        : undefined;

      if (syncEmail !== penggunaRow.email) {
        syncUpdates.push(`email = $${idx++}`);
        syncVals.push(syncEmail);
      }
      if (syncNoHp !== penggunaRow.no_hp) {
        syncUpdates.push(`no_hp = $${idx++}`);
        syncVals.push(syncNoHp);
      }
      if (syncUsername !== undefined && syncUsername !== penggunaRow.username) {
        syncUpdates.push(`username = $${idx++}`);
        syncVals.push(syncUsername);
      }

      if (syncUpdates.length > 0) {
        syncUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
        syncVals.push(penggunaRow.id);
        await pool.query(
          `UPDATE pengguna SET ${syncUpdates.join(', ')} WHERE id = $${idx}`,
          syncVals
        );
      }
    }

    // Catat riwayat audit untuk aksi ubah — jalankan di background agar tidak memperlambat respons
    if (caller) {
      auditLogRepository.insertAuditLog({
        jemaat_id:  parseInt(id),
        aksi:       'UPDATE',
        user_id:    caller.user_id,
        role_id:    caller.role_id,
        satelit_id: caller.satelit_id,
        keterangan: 'Data jemaat diperbarui',
      }).catch(err => console.error('[AuditLog] Failed to insert UPDATE log:', err));
    }

    return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' }, { status: 200 });
  } catch (error) {
    console.error('Error in PUT /api/members/[id]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}


// PATCH /api/members/:id → Untuk mengubah status jemaat (Nonaktifkan/Aktifkan)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('jemaat_edit'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah status jemaat (jemaat_edit).' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const body = await request.json();
    const { status_jemaat } = body;

    if (!status_jemaat) {
      return NextResponse.json({ success: false, message: 'Status must be provided' }, { status: 400 });
    }

    const updated = await jemaatRepository.updateJemaatStatus(id, status_jemaat);
    
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Jemaat tidak ditemukan atau gagal diupdate' }, { status: 404 });
    }

    // Hanya catat sebagai aksi DEACTIVATE jika statusnya berubah jadi tidak aktif
    const isDeactivation = status_jemaat === 'Tidak Aktif' || status_jemaat === 'Keluar';
    if (caller) {
      auditLogRepository.insertAuditLog({
        jemaat_id:  parseInt(id),
        aksi:       isDeactivation ? 'DEACTIVATE' : 'UPDATE',
        user_id:    caller.user_id,
        role_id:    caller.role_id,
        satelit_id: caller.satelit_id,
        keterangan: isDeactivation
          ? `Status jemaat diubah menjadi "${status_jemaat}"`
          : `Status jemaat diubah menjadi "${status_jemaat}"`,
      }).catch(err => console.error('[AuditLog] Failed to insert PATCH log:', err));
    }

    return NextResponse.json({ success: true, message: 'Status berhasil diperbarui' }, { status: 200 });
  } catch (error) {
    console.error('Error in PATCH /api/members/[id]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
