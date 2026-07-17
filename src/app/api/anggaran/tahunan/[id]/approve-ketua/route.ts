import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';
import { notifyMajelisRaSubmitted } from '@/lib/notificationService';

/**
 * POST /api/anggaran/tahunan/[id]/approve-ketua
 *
 * Gembala Satelit (Ketua Satelit) step — approve or return an RA
 * before it moves on to Majelis review.
 *
 * Body: { action: 'setujui' | 'minta_revisi', catatan_ketua?: string }
 *
 * Permission: caller must have 'anggaran_approve_ketua' OR is_super_admin.
 * Cross-satellite guard: non-admin callers can only act on their own satelit.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Permission guard: must have anggaran_approve_ketua OR be super admin
  if (!caller.is_super_admin && !caller.permissions.includes('anggaran_approve_ketua')) {
    return NextResponse.json(
      { success: false, message: 'Akses Ditolak: Anda tidak memiliki izin sebagai Ketua Satelit untuk menyetujui RA.' },
      { status: 403 }
    );
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { action, catatan_ketua } = body;
    // action: 'setujui' | 'minta_revisi'

    if (action !== 'setujui' && action !== 'minta_revisi') {
      return NextResponse.json({ success: false, message: 'Action tidak valid. Gunakan "setujui" atau "minta_revisi".' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Fetch the RA
    const raRes = await client.query(
      `SELECT at.id, at.status, at.kode_dokumen, at.satelit_id,
              at.nama_rancangan, at.total_anggaran,
              s.nama_satelit, k.nama_komisi,
              p.email AS pengaju_email,
              COALESCE(j.nama_lengkap, p.email) AS pengaju_nama
       FROM public.anggaran_tahunan at
       LEFT JOIN public.satelit  s ON s.id = at.satelit_id
       LEFT JOIN public.komisi   k ON k.id = at.komisi_id
       LEFT JOIN public.pengguna p ON p.id = at.created_by
       LEFT JOIN public.jemaat   j ON j.id = p.jemaat_id
       WHERE at.id = $1`,
      [id]
    );

    if (raRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Rancangan Anggaran tidak ditemukan.' }, { status: 404 });
    }

    const ra = raRes.rows[0];

    // Status guard: RA must be waiting for Ketua approval
    if (ra.status !== 'Menunggu Persetujuan Ketua') {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, message: `Tidak bisa diproses: status RA saat ini "${ra.status}". Hanya RA berstatus "Menunggu Persetujuan Ketua" yang bisa diproses di sini.` },
        { status: 400 }
      );
    }

    // Cross-satellite guard: non-super-admin can only approve their own satellite's RAs
    if (!caller.is_super_admin && ra.satelit_id !== caller.satelit_id) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Anda hanya dapat menyetujui RA dari satelit Anda sendiri.' },
        { status: 403 }
      );
    }

    let newStatus: string;
    let successMessage: string;

    if (action === 'setujui') {
      newStatus = 'Menunggu Review';
      successMessage = 'RA berhasil diteruskan ke Majelis untuk review.';
    } else {
      newStatus = 'Revisi';
      successMessage = 'RA dikembalikan ke Bendahara untuk revisi.';
    }

    // Update the RA header
    await client.query(
      `UPDATE public.anggaran_tahunan
       SET status            = $1,
           catatan_reviewer  = $2,
           reviewed_by       = $3,
           reviewed_at       = CURRENT_TIMESTAMP,
           updated_at        = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [newStatus, catatan_ketua || null, caller.user_id, id]
    );

    await client.query('COMMIT');

    // ── Audit Log (awaited — must complete before response to avoid Vercel kill) ──
    try {
      const snapshot = await resolveCallerSnapshot(caller);
      const auditAksi = action === 'setujui' ? 'Disetujui Ketua' as const : 'Revisi' as const;
      await auditLogRepository.insertAnggaranAuditLog({
        anggaran_id: id,
        kode_dokumen: ra.kode_dokumen,
        aksi: auditAksi,
        status_sebelum: 'Menunggu Persetujuan Ketua',
        status_sesudah: newStatus,
        user_id: caller.user_id,
        role_id: caller.role_id,
        satelit_id: caller.satelit_id,
        ...snapshot,
        keterangan: catatan_ketua || `Ketua Satelit: ${action === 'setujui' ? 'RA diteruskan ke Majelis' : 'RA dikembalikan untuk revisi'}`,
      });
    } catch (err) {
      console.error('[AuditLog] approve-ketua: Failed to insert audit log:', err);
    }

    // ── Notify Majelis (fire-and-forget — only when forwarding to Majelis) ──
    if (action === 'setujui') {
      Promise.all([
        pool.query(
          `SELECT DISTINCT p.email
           FROM public.user_role ur
           JOIN public.pengguna p ON p.id = ur.user_id
           WHERE ur.role_id IN (2, 3) AND ur.is_active = true
             AND p.email IS NOT NULL AND p.email <> ''`
        ),
      ]).then(([majelisRes]) => {
        const majelisEmails = majelisRes.rows.map((r: any) => r.email);
        if (majelisEmails.length > 0) {
          notifyMajelisRaSubmitted(
            majelisEmails,
            {
              kode_dokumen: ra.kode_dokumen,
              nama_rancangan: ra.nama_rancangan,
              nama_satelit: ra.nama_satelit,
              nama_komisi: ra.nama_komisi,
              total_pengajuan: parseFloat(ra.total_anggaran) || 0,
            },
            false // not a resubmit from Bendahara's perspective
          ).catch(err => console.error('[Notification] approve-ketua: Majelis notify failed:', err));
        }
      }).catch(err => console.error('[Notification] approve-ketua: Email query failed:', err));
    }

    return NextResponse.json({ success: true, message: successMessage, newStatus });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in approve-ketua:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memproses persetujuan.', error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
