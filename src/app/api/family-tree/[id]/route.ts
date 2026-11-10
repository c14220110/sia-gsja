import { NextResponse } from 'next/server';
import pool from '@/lib/db';
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

    const isOwner = caller.jemaat_id != null && Number(caller.jemaat_id) === personId;
    const canView = caller.is_super_admin || caller.permissions.includes('jemaat_view');

    if (!isOwner && !canView) {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Anda tidak memiliki izin melihat data jemaat ini.' },
        { status: 403 }
      );
    }

    const targetRes = await pool.query(
      'SELECT satelit_id FROM jemaat WHERE id = $1 AND is_deleted = false',
      [personId]
    );

    if (targetRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Jemaat tidak ditemukan' },
        { status: 404 }
      );
    }

    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view') && !isOwner) {
      if (Number(targetRes.rows[0].satelit_id) !== Number(caller.satelit_id)) {
        return NextResponse.json(
          { success: false, message: 'Akses Ditolak: Jemaat berbeda satelit.' },
          { status: 403 }
        );
      }
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
