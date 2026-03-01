import { NextResponse } from 'next/server';
import { JemaatRepository } from '@/server/repositories/jemaat.repository';

const jemaatRepository = new JemaatRepository();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const body = await request.json();
    
    if (!body.nama_lengkap) {
      return NextResponse.json({ success: false, message: 'Nama lengkap wajib diisi' }, { status: 400 });
    }

    const updated = await jemaatRepository.updateJemaat(id, body);
    
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Jemaat tidak ditemukan atau gagal diupdate' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' }, { status: 200 });
  } catch (error) {
    console.error('Error in PUT /api/members/[id]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
