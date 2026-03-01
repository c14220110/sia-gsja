import { getJemaatController, createJemaatController } from '@/server/controllers/jemaat.controller';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Authentication checking can be placed here via middleware or wrapper
  return await getJemaatController(request);
}

export async function POST(request: Request) {
  return await createJemaatController(request);
}
