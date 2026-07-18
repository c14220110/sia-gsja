import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  if (!caller.is_super_admin && !caller.permissions.includes('anggaran_create')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT status, kode_dokumen, satelit_id, created_by FROM public.anggaran_tahunan WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'RA tidak ditemukan' }, { status: 404 });
    }
    const ra = res.rows[0];

    if (ra.status !== 'Menunggu Persetujuan Ketua') {
      return NextResponse.json({
        success: false,
        message: `Hanya RA berstatus "Menunggu Persetujuan Ketua" yang dapat ditarik. Status saat ini: ${ra.status}`
      }, { status: 403 });
    }

    if (!caller.is_super_admin && ra.satelit_id !== caller.satelit_id) {
      return NextResponse.json({ success: false, message: 'Akses ditolak: bukan RA milik satelit Anda' }, { status: 403 });
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE public.anggaran_tahunan SET status = 'Draft', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    await client.query('COMMIT');

    // Audit log (fire-and-forget)
    try {
      const snapshot = await resolveCallerSnapshot(caller);
      await auditLogRepository.insertAnggaranAuditLog({
        anggaran_id: id,
        kode_dokumen: ra.kode_dokumen,
        aksi: 'Revisi' as const,
        status_sebelum: ra.status,
        status_sesudah: 'Draft',
        user_id: caller.user_id,
        role_id: caller.role_id,
        satelit_id: caller.satelit_id,
        ...snapshot,
        keterangan: 'RA ditarik kembali ke Draft oleh Bendahara',
      });
    } catch (err) {
      console.error('[AuditLog] retract: Failed to insert audit log:', err);
    }

    return NextResponse.json({ success: true, message: `RA ${ra.kode_dokumen} berhasil ditarik kembali ke Draft.` });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error retract RA:', error);
    return NextResponse.json({ success: false, message: 'Gagal menarik kembali RA', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
