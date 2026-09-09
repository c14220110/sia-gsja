import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

/**
 * GET /api/members/[id]/username
 *
 * Tanpa query param:  kembalikan username jemaat ini dari tabel pengguna
 * Dengan ?check=xxx : cek apakah username xxx tersedia (belum dipakai orang lain)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID required' }, { status: 400 });

    const checkValue = request.nextUrl.searchParams.get('check');

    // Mode: cek ketersediaan username
    if (checkValue !== null) {
      const val = checkValue.trim();
      if (!val) {
        return NextResponse.json({ success: true, available: true });
      }

      // Cari pengguna_id milik jemaat ini (agar bisa exclude dari pengecekan)
      const selfRes = await pool.query(
        'SELECT id FROM pengguna WHERE jemaat_id = $1 LIMIT 1',
        [parseInt(id)]
      );
      const selfPenggunaId = selfRes.rows[0]?.id ?? -1;

      const dupRes = await pool.query(
        'SELECT id FROM pengguna WHERE username = $1 AND id != $2 LIMIT 1',
        [val, selfPenggunaId]
      );

      return NextResponse.json({
        success: true,
        available: dupRes.rowCount === 0,
      });
    }

    // Mode: ambil username jemaat ini
    const result = await pool.query(
      'SELECT username FROM pengguna WHERE jemaat_id = $1 AND username IS NOT NULL LIMIT 1',
      [parseInt(id)]
    );

    return NextResponse.json({
      success: true,
      username: result.rows[0]?.username ?? null,
    });
  } catch (error) {
    console.error('Error in GET /api/members/[id]/username', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
