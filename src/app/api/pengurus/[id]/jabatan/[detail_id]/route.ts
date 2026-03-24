import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import pool from '@/lib/db';

/**
 * PATCH /api/pengurus/[id]/jabatan/[detail_id]
 * Mengubah status jabatan menjadi Demisioner atau Non-Aktif.
 * TIDAK mengizinkan pengeditan jabatan_id, lingkup, dsb — immutable history.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; detail_id: string }> }
) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('pengurus_manage'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak' }, { status: 403 });
    }

    const { id: idStr, detail_id: detailIdStr } = await params;
    const pengurus_id = parseInt(idStr);
    const detail_id = parseInt(detailIdStr);

    if (isNaN(pengurus_id) || isNaN(detail_id)) {
      return NextResponse.json({ success: false, message: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { status_jabatan, tanggal_akhir_menjabat, catatan } = body;

    // Validasi nilai status
    if (!status_jabatan || !['Demisioner', 'Non-Aktif'].includes(status_jabatan)) {
      return NextResponse.json({
        success: false,
        message: 'Status harus "Demisioner" atau "Non-Aktif"'
      }, { status: 400 });
    }
    if (!tanggal_akhir_menjabat) {
      return NextResponse.json({
        success: false,
        message: 'Tanggal akhir menjabat wajib diisi'
      }, { status: 400 });
    }

    // Verify detail jabatan belongs to this pengurus and is currently Aktif
    const detailRes = await pool.query(
      `SELECT dk.id, dk.status_jabatan, p.jemaat_id, j.satelit_id AS jemaat_satelit_id
       FROM detail_kepengurusan dk
       JOIN pengurus p ON dk.pengurus_id = p.id
       JOIN jemaat j ON p.jemaat_id = j.id
       WHERE dk.id = $1 AND dk.pengurus_id = $2`,
      [detail_id, pengurus_id]
    );

    if (detailRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Data jabatan tidak ditemukan' }, { status: 404 });
    }

    const current = detailRes.rows[0];
    if (current.status_jabatan !== 'Aktif') {
      return NextResponse.json({
        success: false,
        message: `Jabatan ini sudah dalam status "${current.status_jabatan}" dan tidak dapat diubah lagi`
      }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update jabatan status — only these 3 fields, never jabatan_id/lingkup/etc
      await client.query(`
        UPDATE detail_kepengurusan
        SET status_jabatan = $1, tanggal_akhir_menjabat = $2, catatan = COALESCE($3, catatan)
        WHERE id = $4
      `, [status_jabatan, tanggal_akhir_menjabat, catatan || null, detail_id]);

      // Audit log
      await client.query(`
        INSERT INTO pengurus_audit_log (pengurus_id, aksi, user_id, role_id, satelit_id, keterangan)
        VALUES ($1, 'DEACTIVATE', $2, $3, $4, $5)
      `, [
        pengurus_id,
        caller.user_id,
        caller.role_id,
        current.jemaat_satelit_id,
        `Status jabatan (ID: ${detail_id}) diubah menjadi "${status_jabatan}"${catatan ? ` — Alasan: ${catatan}` : ''}`,
      ]);

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: `Jabatan berhasil ditetapkan sebagai ${status_jabatan}` });
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[PATCH /api/pengurus/[id]/jabatan/[detail_id]]', error.message);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
