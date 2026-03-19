import { NextRequest, NextResponse } from 'next/server';
import { PengurusRepository } from '@/server/repositories/pengurus.repository';
// import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import pool from '@/lib/db';

const pengurusRepository = new PengurusRepository();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('pengurus_manage'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah status pengurus (pengurus_manage).' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const body = await request.json();
    const { status_jabatan } = body;

    if (!status_jabatan) {
      return NextResponse.json({ success: false, message: 'Status must be provided' }, { status: 400 });
    }

    const updated = await pengurusRepository.updatePengurusStatus(id, status_jabatan);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Pengurus tidak ditemukan atau gagal diupdate' }, { status: 404 });
    }

    if (caller) {
      const isDeactivation = status_jabatan !== 'Aktif';
      try {
        await pool.query(`
          INSERT INTO pengurus_audit_log (pengurus_id, aksi, user_id, role_id, satelit_id, keterangan)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          parseInt(id),
          isDeactivation ? 'DEACTIVATE' : 'UPDATE',
          caller.user_id,
          caller.role_id,
          caller.satelit_id,
          `Status kepengurusan diubah menjadi "${status_jabatan}"`
        ]);
      } catch (err) {
        console.error('[AuditLog] pengurus PATCH:', err);
      }
    }

    return NextResponse.json({ success: true, message: 'Status berhasil diperbarui' });
  } catch (error) {
    console.error('[PengurusRoute] PATCH error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: 'Invalid ID' }, { status: 400 });
    }

    // Since we don't have getPengurusById implemented yet, returning 404
    // return NextResponse.json({ success: true, data: pengurus });
    console.log("Not implemented fully yet, requested ID: ", id);
    return NextResponse.json({ success: false, message: 'Not Implemented' }, { status: 501 });
  } catch (error: any) {
    console.error('GET Pengurus Details error:', error.message);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
