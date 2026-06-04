import { NextRequest, NextResponse } from 'next/server';
import { pelayanRepository } from '@/server/repositories/pelayan.repository';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: NextRequest) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    
    let satelit_id = searchParams.get('satelit_id') || undefined;

    // Filter satelit untuk admin cabang
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      satelit_id = caller.satelit_id?.toString();
    }

    const data = await pelayanRepository.getRosterAdmin(month, year, satelit_id);

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[RosterRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
