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

    const isOwner = caller.jemaat_id != null && String(caller.jemaat_id) === String(id);
    const canView = caller.is_super_admin || caller.permissions.includes('jemaat_view');

    if (!isOwner && !canView) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin melihat data jemaat ini.' }, { status: 403 });
    }

    const jemaat = await jemaatRepository.getJemaatById(id);
    
    if (!jemaat) {
      return NextResponse.json({ success: false, message: 'Jemaat tidak ditemukan' }, { status: 404 });
    }

    // Jika bukan Superadmin & tidak punya izin multi_satelit_view, pastikan jemaat satu satelit
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view') && !isOwner) {
      if (Number(jemaat.satelit_id) !== Number(caller.satelit_id)) {
        return NextResponse.json({ success: false, message: 'Akses Ditolak: Jemaat berbeda satelit.' }, { status: 403 });
      }
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

    // ── Ambil state jemaat saat ini untuk deteksi perubahan yang akurat ─────
    // Jemaat.email dan pengguna.email bisa BERBEDA (tidak selalu sinkron).
    // Baseline perbandingan harus dari jemaat, bukan dari pengguna, agar tidak
    // false-positive saat admin tidak mengubah email/no_hp sama sekali.
    const currentJemaatRes = await pool.query(
      'SELECT email, no_hp FROM jemaat WHERE id = $1 LIMIT 1',
      [parseInt(id)]
    );
    const currentJemaatEmail = currentJemaatRes.rows[0]?.email?.trim() || null;
    const currentJemaatNoHp  = currentJemaatRes.rows[0]?.no_hp?.trim()  || null;

    const newEmail    = body.email?.trim()  || null;
    const newNoHp     = body.no_hp?.trim()  || null;

    // Apakah benar-benar berubah dari nilai di jemaat sekarang?
    const emailChanged = newEmail !== currentJemaatEmail;
    const noHpChanged  = newNoHp  !== currentJemaatNoHp;

    // Cari akun pengguna yang terhubung ke jemaat ini
    const penggunaRes = await pool.query(
      'SELECT id, email, no_hp, username FROM pengguna WHERE jemaat_id = $1 LIMIT 1',
      [parseInt(id)]
    );
    const penggunaRow = penggunaRes.rows[0] ?? null;

    if (penggunaRow) {

      // Cek email: hanya jika email BENAR-BENAR berubah, baru perlu cek duplikat
      if (emailChanged && newEmail && newEmail !== penggunaRow.email) {
        const emailCheck = await pool.query(
          'SELECT id FROM pengguna WHERE email = $1 AND id != $2',
          [newEmail, penggunaRow.id]
        );
        if (emailCheck.rowCount && emailCheck.rowCount > 0) {
          return NextResponse.json({ success: false, message: `Email "${newEmail}" sudah digunakan oleh jemaat lain.` }, { status: 400 });
        }
      }

      // Cek no_hp: hanya jika no_hp BENAR-BENAR berubah
      if (noHpChanged && newNoHp && newNoHp !== penggunaRow.no_hp) {
        const hpCheck = await pool.query(
          'SELECT id FROM pengguna WHERE no_hp = $1 AND id != $2',
          [newNoHp, penggunaRow.id]
        );
        if (hpCheck.rowCount && hpCheck.rowCount > 0) {
          return NextResponse.json({ success: false, message: `No. HP "${newNoHp}" sudah terdaftar sebagai akun login jemaat lain.` }, { status: 400 });
        }
      }

      // Cek username: hanya jika field dikirim dalam payload
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
          const afterEmail = ('email' in body) ? newEmail : penggunaRow.email;
          const afterHp    = ('no_hp' in body) ? newNoHp  : penggunaRow.no_hp;
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
    // Hanya sync field yang BENAR-BENAR berubah dari nilai jemaat sekarang.
    if (penggunaRow) {
      const syncUpdates: string[] = [];
      const syncVals: any[] = [];
      let idx = 1;

      // Sync username jika benar-benar dikirim dan berbeda
      const syncUsername = 'username' in body
        ? (typeof body.username === 'string' ? body.username.trim() || null : null)
        : undefined;

      // Email: sync jika berubah dari jemaat DAN berbeda dari pengguna saat ini
      if (emailChanged && newEmail !== penggunaRow.email) {
        syncUpdates.push(`email = $${idx++}`);
        syncVals.push(newEmail);
      }
      // No HP: sync jika berubah dari jemaat DAN berbeda dari pengguna saat ini
      if (noHpChanged && newNoHp !== penggunaRow.no_hp) {
        syncUpdates.push(`no_hp = $${idx++}`);
        syncVals.push(newNoHp);
      }
      // Username: sync jika field dikirim dan nilainya berbeda
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
