import { NextRequest, NextResponse } from 'next/server';
import { pelayanRepository } from '@/server/repositories/pelayan.repository';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('pelayan_manage'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah status pelayan (pelayan_manage).' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const body = await request.json();
    const { status_pelayan } = body;

    if (!status_pelayan) {
      return NextResponse.json({ success: false, message: 'Status must be provided' }, { status: 400 });
    }

    const updated = await pelayanRepository.updatePelayanStatus(id, status_pelayan);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Pelayan tidak ditemukan atau gagal diupdate' }, { status: 404 });
    }

    // Audit log (fire-and-forget)
    if (caller) {
      const isDeactivation = status_pelayan === 'Tidak Aktif';
      auditLogRepository.insertPelayanAuditLog({
        pelayan_id:  parseInt(id),
        aksi:        isDeactivation ? 'DEACTIVATE' : 'UPDATE',
        user_id:     caller.user_id,
        role_id:     caller.role_id,
        satelit_id:  caller.satelit_id,
        keterangan:  `Status pelayan diubah menjadi "${status_pelayan}"`,
      }).catch(err => console.error('[AuditLog] pelayan PATCH:', err));
    }

    return NextResponse.json({ success: true, message: 'Status berhasil diperbarui' });
  } catch (error) {
    console.error('[PelayanRoute] PATCH error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: 'Invalid ID' }, { status: 400 });
    }

    const pelayan = await pelayanRepository.getPelayanById(id);
    if (!pelayan) {
      return NextResponse.json({ success: false, message: 'Pelayan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: pelayan });
  } catch (error: any) {
    console.error('GET Pelayan Details error:', error.message);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || (!caller.is_super_admin && !caller.permissions.includes('pelayan_manage'))) {
      return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah data pelayan (pelayan_manage).' }, { status: 403 });
    }

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();

    const result = await pelayanRepository.updatePelayan(id, {
      tanggal_mulai: body.tanggal_mulai,
      status_pelayan: body.status_pelayan,
      catatan: body.catatan,
      roles: body.roles || [],
      user_id: caller.user_id,
      user_role_id: caller.role_id,
      jemaat_id: body.jemaat_id,
      satelit_id: body.satelit_id || caller.satelit_id,
    });

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error: any) {
    console.error('PUT Pelayan error:', error.message);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
