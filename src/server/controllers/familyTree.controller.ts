import { NextResponse } from 'next/server';
import { familyTreeRepository } from '@/server/repositories/familyTree.repository';

export async function getFamilyTreeController(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const personId = parseInt(id, 10);

    if (isNaN(personId)) {
      return NextResponse.json(
        { success: false, message: 'ID tidak valid' },
        { status: 400 }
      );
    }

    const data = await familyTreeRepository.getFamilyTree(personId);

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Jemaat tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[FamilyTreeController] GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
