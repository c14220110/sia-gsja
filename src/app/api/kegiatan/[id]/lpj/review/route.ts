// src/app/api/kegiatan/[id]/lpj/review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';

// Reviewer roles: Super Admin (1), Majelis (2), Gembala Sidang (3), Bendahara Pusat (5)
const REVIEWER_ROLES = [1, 2, 3, 5];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  // Validate reviewer role
  try {
    const userRes = await pool.query(
      `SELECT pr.role_id FROM public.pengguna p
       JOIN public.user_role pr ON p.id = pr.user_id
       WHERE p.id = $1 AND pr.is_active = true`,
      [caller.user_id]
    );
    const userRole = userRes.rows[0];
    if (!userRole || !REVIEWER_ROLES.includes(userRole.role_id)) {
      return NextResponse.json({ success: false, message: 'Anda tidak memiliki akses untuk mereview LPJ.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ success: false, message: 'Gagal memverifikasi akses.' }, { status: 500 });
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { action, catatan_reviewer } = body;
    // action: 'setujui' | 'minta_revisi'

    // Fetch current LPJ & kegiatan info
    const lpjRes = await pool.query(
      `SELECT kl.status_lpj, k.nama_kegiatan, k.status_kegiatan
       FROM public.kegiatan_lpj kl
       JOIN public.kegiatan k ON k.id = kl.kegiatan_id
       WHERE kl.kegiatan_id = $1`,
      [numId]
    );
    if (lpjRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'LPJ tidak ditemukan.' }, { status: 404 });
    }
    const lpj = lpjRes.rows[0];
    if (lpj.status_lpj !== 'Menunggu Review') {
      return NextResponse.json({
        success: false,
        message: `Tidak bisa review: status LPJ saat ini "${lpj.status_lpj}", harus "Menunggu Review".`
      }, { status: 400 });
    }

    let newLpjStatus: string;
    let newKegiatanStatus: string | null = null;
    let auditAksi: 'Disetujui' | 'Revisi';
    let message: string;

    switch (action) {
      case 'setujui':
        newLpjStatus = 'Disetujui';
        newKegiatanStatus = 'Selesai'; // trigger otomatis
        auditAksi = 'Disetujui';
        message = 'LPJ berhasil disetujui. Kegiatan sekarang berstatus Selesai.';
        break;
      case 'minta_revisi':
        newLpjStatus = 'Revisi';
        auditAksi = 'Revisi';
        message = 'LPJ dikembalikan untuk revisi. Panitia akan diberitahu.';
        break;
      default:
        return NextResponse.json({ success: false, message: 'Action tidak valid. Gunakan "setujui" atau "minta_revisi".' }, { status: 400 });
    }

    await client.query('BEGIN');

    // 1. Update status_lpj + catatan_reviewer
    await client.query(
      `UPDATE public.kegiatan_lpj
       SET status_lpj = $1,
           catatan_reviewer = $2,
           reviewed_by = $3,
           reviewed_at = NOW()
       WHERE kegiatan_id = $4`,
      [newLpjStatus, catatan_reviewer || null, caller.user_id, numId]
    );

    // 2. If approved, also update kegiatan status to 'Selesai'
    if (newKegiatanStatus) {
      await client.query(
        `UPDATE public.kegiatan SET status_kegiatan = $1 WHERE id = $2`,
        [newKegiatanStatus, numId]
      );
    }

    await client.query('COMMIT');

    // Audit log (fire-and-forget)
    resolveCallerSnapshot(caller).then(snapshot => {
      auditLogRepository.insertLpjAuditLog({
        kegiatan_id: numId,
        aksi: auditAksi,
        status_sebelum: 'Menunggu Review',
        status_sesudah: newLpjStatus,
        user_id: caller.user_id,
        role_id: caller.role_id,
        nama_pelaksana: snapshot.nama_pelaksana,
        nama_role: snapshot.nama_role,
        keterangan: catatan_reviewer || `Review: ${auditAksi}`,
      }).catch(err => console.error('[AuditLog LPJ] review insert failed:', err));
    }).catch(err => console.error('[AuditLog LPJ] snapshot failed:', err));

    return NextResponse.json({ success: true, message, newStatus: newLpjStatus });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[API LPJ Review] Error:', error);
    return NextResponse.json({ success: false, message: 'Gagal menyimpan review.', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
