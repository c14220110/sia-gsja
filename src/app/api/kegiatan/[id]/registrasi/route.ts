import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET /api/kegiatan/[id]/registrasi
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const canManage = caller.is_super_admin || caller.permissions.includes('kegiatan_manage');
    let query = `
      SELECT 
        r.*,
        j.nama_lengkap as nama_peserta,
        j.no_hp,
        j.jenis_kelamin,
        s.nama_satelit as asal_satelit
      FROM public.kegiatan_registrasi r
      JOIN public.jemaat j ON r.jemaat_id = j.id
      LEFT JOIN public.satelit s ON j.satelit_id = s.id
      WHERE r.kegiatan_id = $1
    `;
    const queryParams: any[] = [id];

    if (!canManage) {
      query += ` AND r.jemaat_id = $2`;
      queryParams.push(caller.jemaat_id || -1);
    }

    query += ` ORDER BY r.tanggal_daftar DESC`;

    const result = await pool.query(query, queryParams);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/kegiatan/[id]/registrasi
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const client = await pool.connect();

  try {
    const body = await request.json();
    const { jemaat_id, catatan_khusus, total_biaya, metode_pembayaran, url_bukti_bayar } = body;

    if (!jemaat_id) {
      return NextResponse.json({ success: false, message: 'Jemaat ID wajib diisi' }, { status: 400 });
    }

    const canManage = caller.is_super_admin || caller.permissions.includes('kegiatan_manage');
    if (!canManage) {
      if (!caller.jemaat_id || Number(jemaat_id) !== Number(caller.jemaat_id)) {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Anda hanya dapat mendaftarkan diri Anda sendiri.' },
          { status: 403 }
        );
      }
    }

    await client.query('BEGIN');

    // Cek apakah sudah ada
    const checkQuery = `SELECT id FROM public.kegiatan_registrasi WHERE kegiatan_id = $1 AND jemaat_id = $2`;
    const checkRes = await client.query(checkQuery, [id, jemaat_id]);
    if (checkRes.rowCount && checkRes.rowCount > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Jemaat ini sudah terdaftar pada kegiatan' }, { status: 400 });
    }

    // Default status if unpaid vs paid immediately
    // Hanya panitia / super admin yang berwenang menandai registrasi berbayar langsung lunas (mis. Bayar Lunas Manual/OTS)
    let status_pembayaran = 'Paid';
    if (Number(total_biaya) > 0) {
      if (canManage && metode_pembayaran === 'Bayar Lunas (Manual/OTS)') {
        status_pembayaran = 'Paid';
      } else {
        status_pembayaran = 'Unpaid';
      }
    }
    const status_pendaftaran = 'Approved'; // Admin bypasses approval natively or auto approved

    const insertQuery = `
      INSERT INTO public.kegiatan_registrasi 
        (kegiatan_id, jemaat_id, catatan_khusus, status_pendaftaran, total_biaya, metode_pembayaran, status_pembayaran, url_bukti_bayar)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    await client.query(insertQuery, [
      id, jemaat_id, catatan_khusus || null, status_pendaftaran, 
      total_biaya || 0, metode_pembayaran || null, status_pembayaran, url_bukti_bayar || null
    ]);

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Peserta berhasil didaftarkan' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding registration:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  } finally {
    client.release();
  }
}

// PUT /api/kegiatan/[id]/registrasi - Untuk operasi massal atau satu-satu
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // const { id } = await params; // ID Kegiatan, dipertahankan supaya parameternya konsisten
  try {
    const body = await request.json();
    const { action, registrasi_ids } = body; // aksi: 'VERIFY_PAYMENT', 'CHECK_IN', 'CANCEL'

    if (!registrasi_ids || !Array.isArray(registrasi_ids) || registrasi_ids.length === 0) {
      return NextResponse.json({ success: false, message: 'Pilih peserta terlebih dahulu' }, { status: 400 });
    }

    const canManage = caller.is_super_admin || caller.permissions.includes('kegiatan_manage');

    // 1. Aksi VERIFY_PAYMENT dan CHECK_IN hanya untuk Superadmin / Panitia Kegiatan
    if (action === 'VERIFY_PAYMENT' || action === 'CHECK_IN') {
      if (!canManage) {
        return NextResponse.json(
          { success: false, message: 'Forbidden: Anda tidak memiliki wewenang ini.' },
          { status: 403 }
        );
      }
    } else if (action === 'CANCEL') {
      // 2. Aksi CANCEL: admin boleh batalkan siapa saja; jemaat biasa HANYA boleh batalkan miliknya sendiri
      if (!canManage) {
        if (!caller.jemaat_id) {
          return NextResponse.json(
            { success: false, message: 'Forbidden: Anda hanya dapat membatalkan pendaftaran Anda sendiri.' },
            { status: 403 }
          );
        }

        // Pastikan semua registrasi_ids yang dibatalkan memang milik caller.jemaat_id
        const checkOwnership = await pool.query(
          `SELECT id FROM public.kegiatan_registrasi WHERE id = ANY($1::int[]) AND jemaat_id != $2`,
          [registrasi_ids, caller.jemaat_id]
        );
        if (checkOwnership.rows.length > 0) {
          return NextResponse.json(
            { success: false, message: 'Forbidden: Anda hanya dapat membatalkan pendaftaran Anda sendiri.' },
            { status: 403 }
          );
        }
      }
    } else {
      return NextResponse.json({ success: false, message: 'Aksi tidak dikenali' }, { status: 400 });
    }

    let query = '';
    let values: any[] = [registrasi_ids];

    if (action === 'VERIFY_PAYMENT') {
       query = `UPDATE public.kegiatan_registrasi SET status_pembayaran = 'Paid', waktu_bayar = CURRENT_TIMESTAMP WHERE id = ANY($1::int[])`;
    } else if (action === 'CHECK_IN') {
       query = `UPDATE public.kegiatan_registrasi SET is_checked_in = true, waktu_check_in = CURRENT_TIMESTAMP WHERE id = ANY($1::int[])`;
    } else if (action === 'CANCEL') {
       if (!canManage) {
         query = `DELETE FROM public.kegiatan_registrasi WHERE id = ANY($1::int[]) AND jemaat_id = $2`;
         values.push(caller.jemaat_id);
       } else {
         query = `DELETE FROM public.kegiatan_registrasi WHERE id = ANY($1::int[])`;
       }
    }

    await pool.query(query, values);
    return NextResponse.json({ success: true, message: 'Operasi berhasil dilakukan' });
  } catch (error) {
    console.error('Error updating registrations:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
