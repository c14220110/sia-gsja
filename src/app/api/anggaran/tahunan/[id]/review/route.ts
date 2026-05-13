import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository, AnggaranAuditAksi } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';
import {
  notifyPengajuRaApproved,
  notifyPengajuRaRejected,
  notifyPengajuRaRevision,
} from '@/lib/notificationService';

// Reviewer roles: Super Admin (1), Majelis (2), Gembala Sidang (3), Bendahara Pusat (5)
// Note: Triggers #1 & #4 only notify role 3 & 5 (key decision makers).
// Role 2 (12 anggota Majelis) dapat review tapi tidak di-notify real-time per RA.
const REVIEWER_ROLES = [1, 2, 3, 5];

// POST: Submit review decision for an RA
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  // Validate reviewer role
  try {
    const userRes = await pool.query(
      `SELECT p.id, pr.role_id FROM public.pengguna p
       JOIN public.user_role pr ON p.id = pr.user_id
       WHERE p.id = $1 AND pr.is_active = true`,
      [caller.user_id]
    );
    const userRole = userRes.rows[0];
    if (!userRole || !REVIEWER_ROLES.includes(userRole.role_id)) {
      return NextResponse.json({ success: false, message: 'Anda tidak memiliki akses untuk melakukan review' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ success: false, message: 'Gagal memverifikasi akses' }, { status: 500 });
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { action, catatan_reviewer, item_decisions } = body;
    // action: 'setujui_penuh' | 'setujui_sebagian' | 'minta_revisi' | 'tolak'
    // catatan_reviewer: string (overall note)
    // item_decisions: [{ detail_id, status: 'ACC'|'Ditolak'|'Revisi', catatan, nominal_disetujui? }]

    // Validate the RA is in 'Menunggu Review' status
    const raRes = await pool.query(
      `SELECT at.status, at.kode_dokumen, at.nama_rancangan, at.total_anggaran,
              s.nama_satelit, k.nama_komisi,
              p.email AS pengaju_email,
              COALESCE(j.nama_lengkap, p.email) AS pengaju_nama,
              at.created_by AS pengaju_id
       FROM public.anggaran_tahunan at
       LEFT JOIN public.satelit  s ON s.id = at.satelit_id
       LEFT JOIN public.komisi   k ON k.id = at.komisi_id
       LEFT JOIN public.pengguna p ON p.id = at.created_by
       LEFT JOIN public.jemaat   j ON j.id = p.jemaat_id
       WHERE at.id = $1`,
      [id]
    );
    if (raRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Rancangan Anggaran tidak ditemukan' }, { status: 404 });
    }
    if (raRes.rows[0].status !== 'Menunggu Review') {
      return NextResponse.json({ success: false, message: `Tidak bisa review: status saat ini "${raRes.rows[0].status}"` }, { status: 400 });
    }

    // Determine new status based on action
    let newStatus: string;
    let message: string;
    switch (action) {
      case 'setujui_penuh':
        newStatus = 'Disetujui Penuh';
        message = 'Rancangan Anggaran berhasil disetujui penuh! Plafon terbentuk.';
        break;
      case 'setujui_sebagian':
        newStatus = 'Disetujui Sebagian';
        message = 'Rancangan Anggaran disetujui sebagian. Plafon terbentuk untuk item yang di-ACC.';
        break;
      case 'minta_revisi':
        newStatus = 'Revisi';
        message = 'Rancangan Anggaran dikembalikan untuk revisi.';
        break;
      case 'tolak':
        newStatus = 'Ditolak';
        message = 'Rancangan Anggaran telah ditolak.';
        break;
      default:
        return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Update header status + reviewer info
    await client.query(
      `UPDATE public.anggaran_tahunan 
       SET status = $1, 
           catatan_reviewer = $2, 
           reviewed_by = $3, 
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [newStatus, catatan_reviewer || null, caller.user_id, id]
    );

    // 2. Update per-item decisions (if provided)
    if (item_decisions && item_decisions.length > 0) {
      for (const decision of item_decisions) {
        if (decision.status === 'ACC') {
          // Check if nominal was customized (partial cut)
          const itemRes = await client.query(
            `SELECT total FROM public.anggaran_tahunan_detail WHERE id = $1`,
            [decision.detail_id]
          );
          const originalTotal = parseFloat(itemRes.rows[0]?.total || 0);
          const customNominal = decision.nominal_disetujui != null
            ? parseFloat(decision.nominal_disetujui)
            : originalTotal;

          // Clamp to [0, originalTotal]
          const finalNominal = Math.min(Math.max(customNominal, 0), originalTotal);
          const itemStatus = finalNominal < originalTotal ? 'ACC_DIPOTONG' : 'ACC';

          await client.query(
            `UPDATE public.anggaran_tahunan_detail 
             SET status_item = $1, 
                 catatan_reviewer = $2, 
                 nominal_disetujui = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND anggaran_tahunan_id = $5`,
            [itemStatus, decision.catatan || null, finalNominal, decision.detail_id, id]
          );
        } else {
          await client.query(
            `UPDATE public.anggaran_tahunan_detail 
             SET status_item = $1, 
                 catatan_reviewer = $2, 
                 nominal_disetujui = 0,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND anggaran_tahunan_id = $4`,
            [decision.status || null, decision.catatan || null, decision.detail_id, id]
          );
        }
      }
    } else if (action === 'setujui_penuh') {
      // Auto-ACC all items and set nominal_disetujui to match total
      await client.query(
        `UPDATE public.anggaran_tahunan_detail 
         SET status_item = 'ACC', 
             nominal_disetujui = total,
             updated_at = CURRENT_TIMESTAMP
         WHERE anggaran_tahunan_id = $1`,
        [id]
      );
    } else if (action === 'tolak') {
      // Auto-Tolak all items and set nominal_disetujui to 0
      await client.query(
        `UPDATE public.anggaran_tahunan_detail 
         SET status_item = 'Ditolak', 
             nominal_disetujui = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE anggaran_tahunan_id = $1`,
        [id]
      );
    }

    // 3. If final, recalculate total_disetujui from actual nominal_disetujui values
    if (['Disetujui Penuh', 'Disetujui Sebagian'].includes(newStatus)) {
      const approvedTotal = await client.query(
        `SELECT COALESCE(SUM(nominal_disetujui), 0) as total_approved
         FROM public.anggaran_tahunan_detail 
         WHERE anggaran_tahunan_id = $1 AND status_item IN ('ACC', 'ACC_DIPOTONG')`,
        [id]
      );
      await client.query(
        `UPDATE public.anggaran_tahunan SET total_disetujui = $1 WHERE id = $2`,
        [approvedTotal.rows[0].total_approved, id]
      );
    }

    await client.query('COMMIT');

    // ── Audit Log (fire-and-forget) ──────────────────────────────────────────
    const prevStatus = raRes.rows[0].status; // always 'Menunggu Review' at this point
    const kode_dokumen = raRes.rows[0].kode_dokumen;

    // Map review action → audit aksi
    const aksiMap: Record<string, AnggaranAuditAksi> = {
      'setujui_penuh':    'Disetujui Penuh',
      'setujui_sebagian': 'Disetujui Sebagian',
      'minta_revisi':     'Revisi',
      'tolak':            'Ditolak',
    };
    const auditAksi = aksiMap[action];

    if (auditAksi) {
      resolveCallerSnapshot(caller).then(snapshot => {
        auditLogRepository.insertAnggaranAuditLog({
          anggaran_id: id,
          kode_dokumen,
          aksi: auditAksi,
          status_sebelum: prevStatus,
          status_sesudah: newStatus,
          user_id: caller.user_id,
          role_id: caller.role_id,
          satelit_id: caller.satelit_id,
          ...snapshot,
          keterangan: catatan_reviewer || `Review: ${auditAksi}`,
        }).catch(err => console.error('[AuditLog] Failed to insert review log:', err));
      }).catch(err => console.error('[AuditLog] Snapshot resolution failed:', err));
    }

    // ── Notifications (fire-and-forget) ────────────────────────────────────────
    const raRow = raRes.rows[0];
    const raData = {
      kode_dokumen: raRow.kode_dokumen,
      nama_rancangan: raRow.nama_rancangan,
      nama_satelit: raRow.nama_satelit,
      nama_komisi: raRow.nama_komisi,
      catatan_reviewer: catatan_reviewer || null,
      total_pengajuan: parseFloat(raRow.total_anggaran) || 0,
    };

    if (raRow.pengaju_email) {
      if (action === 'setujui_penuh' || action === 'setujui_sebagian') {
        // Fetch final total_disetujui for notification
        pool.query(
          `SELECT total_disetujui FROM public.anggaran_tahunan WHERE id = $1`, [id]
        ).then(r => {
          notifyPengajuRaApproved(
            raRow.pengaju_email, raRow.pengaju_nama,
            { ...raData, total_disetujui: parseFloat(r.rows[0]?.total_disetujui) || 0 },
            action === 'setujui_sebagian'
          ).catch(err => console.error('[Notification] ra-approved failed:', err));
        }).catch(err => console.error('[Notification] fetch total_disetujui failed:', err));

      } else if (action === 'minta_revisi') {
        notifyPengajuRaRevision(
          raRow.pengaju_email, raRow.pengaju_nama, raData, id
        ).catch(err => console.error('[Notification] ra-revision failed:', err));

      } else if (action === 'tolak') {
        notifyPengajuRaRejected(
          raRow.pengaju_email, raRow.pengaju_nama, raData
        ).catch(err => console.error('[Notification] ra-rejected failed:', err));
      }
    }

    return NextResponse.json({ success: true, message, newStatus });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error reviewing anggaran:', error);
    return NextResponse.json({ success: false, message: 'Gagal menyimpan review.', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
