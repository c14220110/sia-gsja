import { NextRequest, NextResponse } from 'next/server';
import { pelayanRepository } from '@/server/repositories/pelayan.repository';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
    const caller = getCallerFromRequest(request);
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
