import { NextResponse } from 'next/server';
import { JemaatRepository } from '@/server/repositories/jemaat.repository';

const jemaatRepository = new JemaatRepository();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    return NextResponse.json({ success: true, message: 'Status berhasil diperbarui' }, { status: 200 });
  } catch (error) {
    console.error('Error in PATCH /api/members/[id]/status', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
