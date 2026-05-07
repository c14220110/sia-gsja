import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET: Fetch all COA as a flat list
export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await pool.query(`
      SELECT 
        id, kode_akun, nama_akun, induk_akun_id, 
        grup_laporan, tipe_akun, saldo_normal, is_active
      FROM public.buku_besar_coa
      ORDER BY kode_akun ASC
    `);
    
    return NextResponse.json({
      success: true,
      data: res.rows
    });
  } catch (error: any) {
    console.error('Error fetching COA:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data COA', error: error.message }, { status: 500 });
  }
}

// POST: Add a new Account
export async function POST(req: Request) {
  const caller = getCallerFromRequest(req);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    let { kode_akun, nama_akun, induk_akun_id, grup_laporan, tipe_akun, saldo_normal, is_active } = body;

    // 1. Payload Check
    if (!kode_akun || !nama_akun || !tipe_akun) {
      return NextResponse.json({ success: false, message: 'Data wajib (Kode, Nama, Tipe) tidak lengkap' }, { status: 400 });
    }

    // 2 & 3. Hierarchy Check and Security Override
    if (induk_akun_id) {
      const parentRes = await pool.query(`SELECT tipe_akun, grup_laporan, saldo_normal FROM public.buku_besar_coa WHERE id = $1`, [induk_akun_id]);
      if (parentRes.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Induk Akun tidak ditemukan' }, { status: 400 });
      }
      
      const parent = parentRes.rows[0];
      if (parent.tipe_akun !== 'Header') {
        return NextResponse.json({ success: false, message: 'Akun Detail tidak bisa menjadi Induk!' }, { status: 400 });
      }

      // Security Override: Force values to match parent
      grup_laporan = parent.grup_laporan;
      saldo_normal = parent.saldo_normal;
    } else {
      if (!grup_laporan || !saldo_normal) {
        return NextResponse.json({ success: false, message: 'Grup Laporan dan Saldo Normal wajib untuk Akun Root (Tanpa Induk)' }, { status: 400 });
      }
    }

    const res = await pool.query(
      `INSERT INTO public.buku_besar_coa (kode_akun, nama_akun, induk_akun_id, grup_laporan, tipe_akun, saldo_normal, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [kode_akun, nama_akun, induk_akun_id || null, grup_laporan, tipe_akun, saldo_normal, is_active ?? true]
    );

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil ditambahkan',
      data: res.rows[0]
    });
  } catch (error: any) {
    console.error('Error creating COA:', error);
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Kode Akun sudah digunakan. Silakan gunakan kode lain.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: 'Gagal menambah akun', error: error.message }, { status: 500 });
  }
}

// PUT: Edit an existing Account
export async function PUT(req: Request) {
  const caller = getCallerFromRequest(req);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    let { id, kode_akun, nama_akun, induk_akun_id, grup_laporan, tipe_akun, saldo_normal, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID Akun tidak valid' }, { status: 400 });
    }

    // Validation: Infinite Loop Check
    if (induk_akun_id === id) {
      return NextResponse.json({ success: false, message: 'Akun tidak bisa menjadi induk bagi dirinya sendiri!' }, { status: 400 });
    }

    // Note: A full infinite loop check would require recursive CTE to check if induk_akun_id is a child of id. 
    // For now, we prevent self-referencing.

    // Validation: Cannot change to 'Detail' if it has children
    if (tipe_akun === 'Detail') {
      const childrenCheck = await pool.query(`SELECT id FROM public.buku_besar_coa WHERE induk_akun_id = $1 LIMIT 1`, [id]);
      if (childrenCheck.rows.length > 0) {
        return NextResponse.json({ success: false, message: 'Akun ini memiliki sub-akun (anak), sehingga tidak boleh diubah menjadi tipe Detail!' }, { status: 400 });
      }
    }

    if (induk_akun_id) {
      const parentRes = await pool.query(`SELECT tipe_akun, grup_laporan, saldo_normal FROM public.buku_besar_coa WHERE id = $1`, [induk_akun_id]);
      if (parentRes.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Induk Akun tidak ditemukan' }, { status: 400 });
      }
      
      const parent = parentRes.rows[0];
      if (parent.tipe_akun !== 'Header') {
        return NextResponse.json({ success: false, message: 'Akun Detail tidak bisa menjadi Induk!' }, { status: 400 });
      }

      // Security Override
      grup_laporan = parent.grup_laporan;
      saldo_normal = parent.saldo_normal;
    }

    const res = await pool.query(
      `UPDATE public.buku_besar_coa 
       SET kode_akun = $1, nama_akun = $2, induk_akun_id = $3, grup_laporan = $4, tipe_akun = $5, saldo_normal = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [kode_akun, nama_akun, induk_akun_id || null, grup_laporan, tipe_akun, saldo_normal, is_active, id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Akun tidak ditemukan' }, { status: 404 });
    }

    // Cascade Deactivation: Jika Header dinonaktifkan, matikan juga semua anaknya
    if (tipe_akun === 'Header' && is_active === false) {
      await pool.query(
        `UPDATE public.buku_besar_coa SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE induk_akun_id = $1`,
        [id]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil diperbarui',
      data: res.rows[0]
    });
  } catch (error: any) {
    console.error('Error updating COA:', error);
    if (error.code === '23505') {
      return NextResponse.json({ success: false, message: 'Kode Akun sudah digunakan. Silakan gunakan kode lain.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: 'Gagal memperbarui akun', error: error.message }, { status: 500 });
  }
}

