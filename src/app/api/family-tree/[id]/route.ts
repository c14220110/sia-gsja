import { getFamilyTreeController } from '@/server/controllers/familyTree.controller';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return getFamilyTreeController(request, context);
}
