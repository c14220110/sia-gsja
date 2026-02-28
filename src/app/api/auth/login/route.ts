import { NextRequest } from 'next/server';
import { AuthController } from '../../../../server/controllers/auth.controller';

const authController = new AuthController();

export async function POST(request: NextRequest) {
  return authController.login(request);
}
