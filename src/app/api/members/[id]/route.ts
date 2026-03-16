import { NextRequest, NextResponse } from 'next/server';
import { JemaatRepository } from '@/server/repositories/jemaat.repository';
import { updateJemaatSchema } from '@/server/validations/jemaat.validation';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';

const jemaatRepository = new JemaatRepository();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const jemaat = await jemaatRepository.getJemaatById(id);
    
    if (!jemaat) {
      return NextResponse.json({ success: false, message: 'Jemaat tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: jemaat }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/members/[id]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const body = await request.json();

    // Validate input with Zod
    const parsed = updateJemaatSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ success: false, message: 'Data tidak valid', errors }, { status: 400 });
    }

    const updated = await jemaatRepository.updateJemaat(id, parsed.data);
    
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Jemaat tidak ditemukan atau gagal diupdate' }, { status: 404 });
    }

    // Insert audit log for UPDATE — fire-and-forget, don't block response
    const caller = getCallerFromRequest(request);
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

// PATCH /api/members/:id → Update status jemaat (Nonaktifkan/Aktifkan)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    // Only record DEACTIVATE when status is changed to non-active
    const isDeactivation = status_jemaat === 'Tidak Aktif' || status_jemaat === 'Keluar';
    const caller = getCallerFromRequest(request);
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
