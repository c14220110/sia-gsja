import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const unwrappedParams = await params;
  const id = unwrappedParams.id;
  try {
    const query = `
      SELECT 
        p.*, 
        s.nama_satelit, jpm.nama_jabatan, d.nama_departemen, b.nama_bank,
        j.jemaat_id as jemaat_kode
      FROM public.pegawai p
      LEFT JOIN public.satelit s ON p.satelit_id = s.id
      LEFT JOIN public.jabatan_pegawai_master jpm ON p.jabatan_pegawai_id = jpm.id
      LEFT JOIN public.departemen d ON p.departemen_id = d.id
      LEFT JOIN public.bank_master b ON p.bank_id = b.id
      LEFT JOIN public.jemaat j ON p.jemaat_id = j.id
      WHERE p.id = $1
    `;
    const result = await pool.query(query, [parseInt(id)]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('API /pegawai/[id] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const unwrappedParams = await params;
  const id = unwrappedParams.id;
  try {
    const body = await request.json();
    const allowedUpdates = [
      'status_approval', 'status_pegawai', 'tanggal_keluar', 'di_acc_oleh', 'tanggal_acc'
    ];
    
    // Using a dynamic UPDATE builder for minimal effort based on requested fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(body[key]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: 'Tidak ada data valid untuk diupdate' }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(parseInt(id)); // The $id is the last parameter

    const updateQuery = `
      UPDATE public.pegawai 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Data pegawai berhasil diperbarui',
      data: result.rows[0] 
    });
  } catch (error: any) {
    console.error('API /pegawai/[id] PATCH error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const unwrappedParams = await params;
  const id = unwrappedParams.id;
  try {
    const data = await request.json();
    
    // Convert necessary data fields (from null to appropriate type)
    const updateQuery = `
      UPDATE public.pegawai SET
        jemaat_id = $1,
        nama_lengkap = $2,
        nik = $3,
        no_kk = $4,
        status_pernikahan = $5,
        jumlah_anak = $6,
        tanggal_lahir = $7,
        jenis_kelamin = $8,
        no_hp = $9,
        email_pribadi = $10,
        kontak_darurat_nama = $11,
        kontak_darurat_nohp = $12,
        kontak_darurat_relasi = $13,
        jabatan_pegawai_id = $14,
        departemen_id = $15,
        tanggal_bergabung = $16,
        tipe_pekerja = $17,
        alamat_lengkap = $18,
        rt_rw = $19,
        kota = $20,
        kode_pos = $21,
        is_kena_pph21 = $22,
        no_npwp = $23,
        status_ptkp = $24,
        bank_id = $25,
        no_rekening = $26,
        atas_nama_rekening = $27,
        satelit_id = $28,
        url_ktp = $29,
        url_kartu_keluarga = $30,
        url_perjanjian_kerjasama = $31,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $32
      RETURNING id;
    `;

    const values = [
      data.jemaat_id ? parseInt(data.jemaat_id) : null,
      data.nama_lengkap, data.nik, data.no_kk, data.status_pernikahan, 
      data.jumlah_anak || 0, data.tanggal_lahir || null, data.jenis_kelamin, 
      data.no_hp, data.email_pribadi, data.kontak_darurat_nama, 
      data.kontak_darurat_nohp, data.kontak_darurat_relasi,
      parseInt(data.jabatan_pegawai_id) || null,
      parseInt(data.departemen_id) || null,
      data.tanggal_bergabung || null,
      data.tipe_pekerja, data.alamat_lengkap, data.rt_rw, data.kota, data.kode_pos,
      data.is_kena_pph21, data.no_npwp, data.status_ptkp,
      parseInt(data.bank_id) || null,
      data.no_rekening, data.atas_nama_rekening,
      parseInt(data.satelit_id) || null,
      data.url_ktp || null,
      data.url_kartu_keluarga || null,
      data.url_perjanjian_kerjasama || null,
      parseInt(id)
    ];

    const result = await pool.query(updateQuery, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, message: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Data pegawai berhasil diupdate' });
  } catch (error: any) {
    console.error('API /pegawai/[id] PUT error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
