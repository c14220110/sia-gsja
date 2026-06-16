import { NextResponse } from 'next/server';
import { familyTreeRepository } from '@/server/repositories/familyTree.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
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
    console.error('[FamilyTree] GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
