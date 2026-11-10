import { NextRequest, NextResponse } from 'next/server';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { ExampleRepository } from '@/server/repositories/example.repository';

const exampleRepository = new ExampleRepository();

export async function GET(request: NextRequest) {
  // Auth & permission check — selalu di luar try/catch
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    // Baca query params
    const search   = searchParams.get('search')   || undefined;
    const kategori = searchParams.get('kategori') || undefined;
    const status   = searchParams.get('status')   || undefined;
    const limit    = Math.min(parseInt(searchParams.get('limit')  ?? '10'), 100);
    const offset   = parseInt(searchParams.get('offset') ?? '0');

    const { data, total } = await exampleRepository.getExamplePagination({
      search,
      kategori,
      status,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error('[ExampleListRoute] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
