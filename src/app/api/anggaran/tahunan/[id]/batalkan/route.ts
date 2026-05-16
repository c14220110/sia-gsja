import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';

// Roles yang bisa membatalkan RA yang sudah di-approve (Approver)
const ROLES_APPROVER = [1, 2, 3, 5]; // Super Admin, Majelis, Gembala Sidang, Bendahara Pusat

// Roles pembuat RA (hanya bisa batalkan Draft / Menunggu Review)
const ROLES_PEMBUAT = [5, 6, 8, 9]; // Bendahara Pusat, Bendahara Satelit, Ketua Komisi, Ketua Dept

// Status RA yang masing-masing kelompok role boleh batalkan
const ALLOWED_STATUS_PEMBUAT  = ['Draft', 'Menunggu Review'];
const ALLOWED_STATUS_APPROVER = ['Draft', 'Menunggu Review', 'Disetujui', 'Disetujui Penuh', 'Disetujui Sebagian'];

// Status kegiatan yang memblokir pembatalan (kegiatan sudah berjalan / selesai)
const BLOCKED_KEGIATAN_STATUS = ['Ongoing', 'Menunggu LPJ', 'Selesai', 'Menunggu Dimulai'];

// PATCH /api/anggaran/tahunan/[id]/batalkan
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Auth: baca JWT dari cookie (seragam dengan route lain)
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const isApprover = caller.is_super_admin || ROLES_APPROVER.includes(caller.role_id);
  const isPembuat  = ROLES_PEMBUAT.includes(caller.role_id);

  if (!isApprover && !isPembuat) {
    return NextResponse.json({ success: false, message: 'Anda tidak memiliki izin untuk membatalkan RA.' }, { status: 403 });
  }

  // 2. Parse body
  let alasan = '';
  try {
    const body = await request.json();
    alasan = (body.alasan || '').trim();
  } catch { /* ok */ }

  if (!alasan) {
    return NextResponse.json({ success: false, message: 'Alasan pembatalan wajib diisi.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 3. Fetch RA — ambil semua field yang diperlukan untuk audit + validasi
    const raRes = await pool.query(
      `SELECT at.id, at.status, at.pola_penggunaan, at.kode_dokumen,
              at.nama_rancangan, at.satelit_id
       FROM public.anggaran_tahunan at
       WHERE at.id = $1`,
      [id]
    );

    if (raRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Rancangan Anggaran tidak ditemukan.' }, { status: 404 });
    }

    const ra = raRes.rows[0];
    const statusRA: string = ra.status;

    // 4. Guard: sudah dibatalkan?
    if (statusRA === 'Dibatalkan') {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'RA ini sudah berstatus Dibatalkan.' }, { status: 400 });
    }

    // 5. Guard: cek status RA vs role
    if (isApprover) {
      if (!ALLOWED_STATUS_APPROVER.includes(statusRA)) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          message: `RA berstatus "${statusRA}" tidak dapat dibatalkan.`,
        }, { status: 400 });
      }
    } else {
      // Pembuat hanya bisa batalkan Draft / Menunggu Review
      if (!ALLOWED_STATUS_PEMBUAT.includes(statusRA)) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          message: `Anda hanya dapat membatalkan RA berstatus Draft atau Menunggu Review. RA ini berstatus "${statusRA}". Hubungi Bendahara/Majelis untuk membatalkan.`,
        }, { status: 403 });
      }
    }

    // 6. Guard: cek kegiatan yang terkoneksi
    const blockedKeg = await client.query(
      `SELECT k.nama_kegiatan, k.status_kegiatan::text AS status_kegiatan
       FROM public.kegiatan k
       WHERE k.anggaran_tahunan_id = $1
         AND k.status_kegiatan::text = ANY($2::text[])
       LIMIT 5`,
      [id, BLOCKED_KEGIATAN_STATUS]
    );

    if ((blockedKeg.rowCount ?? 0) > 0) {
      const namaList = blockedKeg.rows
        .map((r: any) => `"${r.nama_kegiatan}" (${r.status_kegiatan})`)
        .join(', ');
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        message: `Tidak dapat dibatalkan. RA ini terhubung dengan kegiatan yang sedang berjalan atau selesai: ${namaList}.`,
      }, { status: 400 });
    }

    // 7. Update RA → Dibatalkan (soft delete with audit columns)
    await client.query(
      `UPDATE public.anggaran_tahunan
       SET status            = 'Dibatalkan',
           alasan_pembatalan = $1,
           dibatalkan_oleh   = $2,
           dibatalkan_at     = CURRENT_TIMESTAMP,
           updated_at        = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [alasan, caller.user_id, id]
    );

    await client.query('COMMIT');

    // 8. Audit Log (fire-and-forget — seragam dengan review route)
    resolveCallerSnapshot(caller).then(snapshot => {
      auditLogRepository.insertAnggaranAuditLog({
        anggaran_id:    id,
        kode_dokumen:   ra.kode_dokumen,
        aksi:           'Dibatalkan',
        status_sebelum: statusRA,
        status_sesudah: 'Dibatalkan',
        user_id:        caller.user_id,
        role_id:        caller.role_id,
        satelit_id:     caller.satelit_id,
        ...snapshot,
        keterangan: `Alasan: ${alasan}`,
      }).catch(err => console.error('[AuditLog] Failed to insert batalkan log:', err));
    }).catch(err => console.error('[AuditLog] Snapshot resolution failed:', err));

    return NextResponse.json({
      success: true,
      message: `Rancangan Anggaran "${ra.nama_rancangan || ra.kode_dokumen}" berhasil dibatalkan.`,
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[BATALKAN RA ERROR]', error);
    return NextResponse.json({
      success: false,
      message: 'Gagal membatalkan RA.',
      error: error.message,
    }, { status: 500 });
  } finally {
    client.release();
  }
}
