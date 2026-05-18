import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function POST(request: Request) {
  try {
    const caller = await getCallerFromRequest(request);
    if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { rayon_id, nama_kelompok, ketua_pengurus_id, is_active } = body;

    if (!rayon_id || !nama_kelompok) {
      return NextResponse.json({ success: false, message: 'Rayon dan Nama Kelompok wajib diisi' }, { status: 400 });
    }

    const rId = parseInt(rayon_id);
    const kpId = ketua_pengurus_id ? parseInt(ketua_pengurus_id) : null;
    
    // Check rayon ownership
    const rayonRow = await pool.query('SELECT satelit_id FROM rayon WHERE id = $1', [rId]);
    if (rayonRow.rows.length === 0) return NextResponse.json({ success: false, message: 'Rayon tidak ditemukan' }, { status: 404 });

    const sId = rayonRow.rows[0].satelit_id;
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (sId !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
      }
    }

    const res = await pool.query(`
      INSERT INTO kelompok_sel (rayon_id, nama_kelompok, ketua_pengurus_id, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [rId, nama_kelompok, kpId, is_active !== undefined ? is_active : true]);

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
    const { id, nama_kelompok, ketua_pengurus_id, is_active } = body;

    if (!id || !nama_kelompok) {
      return NextResponse.json({ success: false, message: 'ID dan Nama Kelompok wajib diisi' }, { status: 400 });
    }

    // RBAC check
    const current = await pool.query(`
      SELECT r.satelit_id 
      FROM kelompok_sel k
      JOIN rayon r ON k.rayon_id = r.id
      WHERE k.id = $1
    `, [id]);

    if (current.rows.length === 0) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    const sId = current.rows[0].satelit_id;
    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (sId !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
      }
    }

    const kpId = ketua_pengurus_id ? parseInt(ketua_pengurus_id) : null;

    await pool.query(`
      UPDATE kelompok_sel
      SET nama_kelompok = $1, ketua_pengurus_id = $2, is_active = $3
      WHERE id = $4
    `, [nama_kelompok, kpId, is_active !== undefined ? is_active : true, id]);

    return NextResponse.json({ success: true, message: 'Kelompok Sel diperbarui' });
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

    const current = await pool.query(`
      SELECT r.satelit_id 
      FROM kelompok_sel k
      JOIN rayon r ON k.rayon_id = r.id
      WHERE k.id = $1
    `, [id]);

    if (current.rows.length === 0) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    if (!caller.is_super_admin && !caller.permissions.includes('multi_satelit_view')) {
      if (current.rows[0].satelit_id !== caller.satelit_id) {
        return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
      }
    }

    await pool.query('DELETE FROM kelompok_sel WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Kelompok Sel dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
