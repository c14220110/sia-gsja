import { NextResponse } from 'next/server';
import { getFamilyTreeController } from '@/server/controllers/familyTree.controller';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  return getFamilyTreeController(request, context);
}
