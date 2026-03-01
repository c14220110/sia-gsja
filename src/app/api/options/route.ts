import { getOptionsController } from '@/server/controllers/master.controller';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return await getOptionsController(request);
}
