import { NextResponse } from 'next/server';
import { JemaatRepository } from '@/server/repositories/jemaat.repository';
import { updateJemaatSchema } from '@/server/validations/jemaat.validation';

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

    return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' }, { status: 200 });
  } catch (error) {
    console.error('Error in PUT /api/members/[id]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/members/:id → Update status jemaat (merged from members/[id]/status)
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
    console.error('Error in PATCH /api/members/[id]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
