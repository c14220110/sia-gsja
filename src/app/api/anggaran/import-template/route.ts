import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('anggaran_create')) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const satelitName = (searchParams.get('satelit_name') || 'Satelit').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const tahun = (searchParams.get('tahun') || String(new Date().getFullYear())).replace(/[^0-9]/g, '');

    const templatePath = path.join(process.cwd(), 'public', 'templates', 'Template_Anggaran_GSJA.xlsx');
    const buffer = await fs.readFile(templatePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Template_Anggaran_${satelitName}_${tahun}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[AnggaranImportTemplate] GET error:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengunduh template Excel anggaran.' }, { status: 500 });
  }
}
