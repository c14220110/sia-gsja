import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function POST(request: Request) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { satelit_id, nama_rayon, ketua_pengurus_id, is_active } = body;

    if (!satelit_id || !nama_rayon) {
      return NextResponse.json({ success: false, message: 'Satelit dan Nama Rayon wajib diisi' }, { status: 400 });
    }

    const sId = parseInt(satelit_id);
    const kpId = ketua_pengurus_id ? parseInt(ketua_pengurus_id) : null;
    
    // RBAC
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (sId !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
      }
    }

    const res = await pool.query(`
      INSERT INTO rayon (satelit_id, nama_rayon, ketua_pengurus_id, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [sId, nama_rayon, kpId, is_active !== undefined ? is_active : true]);

    return NextResponse.json({ success: true, data: { id: res.rows[0].id } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, nama_rayon, ketua_pengurus_id, is_active } = body;

    if (!id || !nama_rayon) {
      return NextResponse.json({ success: false, message: 'ID dan Nama Rayon wajib diisi' }, { status: 400 });
    }

    // RBAC check satelit_id
    const current = await pool.query('SELECT satelit_id FROM rayon WHERE id = $1', [id]);
    if (current.rows.length === 0) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    const sId = current.rows[0].satelit_id;
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (sId !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
      }
    }

    const kpId = ketua_pengurus_id ? parseInt(ketua_pengurus_id) : null;

    await pool.query(`
      UPDATE rayon
      SET nama_rayon = $1, ketua_pengurus_id = $2, is_active = $3
      WHERE id = $4
    `, [nama_rayon, kpId, is_active !== undefined ? is_active : true, id]);

    return NextResponse.json({ success: true, message: 'Rayon diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, message: 'ID wajib diisi' }, { status: 400 });

    const current = await pool.query('SELECT satelit_id FROM rayon WHERE id = $1', [id]);
    if (current.rows.length === 0) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (current.rows[0].satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
      }
    }

    // Check children (kelompok sel)
    const checkKel = await pool.query('SELECT id FROM kelompok_sel WHERE rayon_id = $1 LIMIT 1', [id]);
    if (checkKel.rows.length > 0) {
      return NextResponse.json({ success: false, message: 'Tidak dapat menghapus rayon yang masih memiliki kelompok sel. Hapus kelompok sel terlebih dahulu.' }, { status: 400 });
    }

    await pool.query('DELETE FROM rayon WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Rayon dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
