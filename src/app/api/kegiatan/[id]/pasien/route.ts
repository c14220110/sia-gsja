import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const query = `
      SELECT 
        kp.id,
        kp.kegiatan_id,
        kp.jemaat_id,
        kp.nama_pasien_luar,
        kp.no_hp_pasien_luar,
        kp.pelayan_medis_id,
        kp.nama_pelayan_luar,
        kp.keluhan_simptom,
        kp.diagnosa,
        kp.tindakan_obat,
        kp.tensi_darah,
        kp.gula_darah,
        kp.asam_urat,
        kp.kolesterol,
        COALESCE(j.nama_lengkap, kp.nama_pasien_luar) AS nama_pasien,
        j.foto_url AS foto_pasien,
        COALESCE(m.nama_lengkap, kp.nama_pelayan_luar) AS nama_dokter
      FROM public.kegiatan_detail_kesehatan_pasien kp
      LEFT JOIN public.jemaat j ON kp.jemaat_id = j.id
      LEFT JOIN public.jemaat m ON kp.pelayan_medis_id = m.id
      WHERE kp.kegiatan_id = $1
      ORDER BY kp.id DESC
    `;

    const result = await pool.query(query, [id]);

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching pasien kesehatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { 
      is_pasien_luar,
      jemaat_id, 
      nama_pasien_luar,
      no_hp_pasien_luar,
      is_pelayan_luar,
      pelayan_medis_id,
      nama_pelayan_luar,
      keluhan_simptom,
      diagnosa,
      tindakan_obat,
      tensi_darah,
      gula_darah,
      asam_urat,
      kolesterol
    } = body;

    if (!is_pasien_luar && !jemaat_id) {
      return NextResponse.json({ success: false, message: 'ID Pasien (Jemaat) wajib diisi' }, { status: 400 });
    }
    if (is_pasien_luar && !nama_pasien_luar) {
      return NextResponse.json({ success: false, message: 'Nama Pasien Luar wajib diisi' }, { status: 400 });
    }

    // Check if already checked-in as patient for this specific activity
    if (!is_pasien_luar && jemaat_id) {
      const checkQuery = `SELECT id FROM public.kegiatan_detail_kesehatan_pasien WHERE kegiatan_id = $1 AND jemaat_id = $2`;
      const checkResult = await pool.query(checkQuery, [id, jemaat_id]);
      if (checkResult.rows.length > 0) {
        return NextResponse.json({ success: false, message: 'Pasien ini sudah terdaftar di kegiatan pemeriksaan ini' }, { status: 400 });
      }
    }

    const insertQuery = `
      INSERT INTO public.kegiatan_detail_kesehatan_pasien (
        kegiatan_id, 
        jemaat_id, 
        nama_pasien_luar,
        no_hp_pasien_luar,
        pelayan_medis_id, 
        nama_pelayan_luar,
        keluhan_simptom, 
        diagnosa, 
        tindakan_obat, 
        tensi_darah,
        gula_darah,
        asam_urat,
        kolesterol
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;
    const result = await pool.query(insertQuery, [
      id, 
      is_pasien_luar ? null : jemaat_id, 
      is_pasien_luar ? nama_pasien_luar : null,
      is_pasien_luar ? (no_hp_pasien_luar || null) : null,
      is_pelayan_luar ? null : pelayan_medis_id,
      is_pelayan_luar ? nama_pelayan_luar : null,
      keluhan_simptom || null, 
      diagnosa || null, 
      tindakan_obat || null, 
      tensi_darah || null,
      gula_darah || null,
      asam_urat || null,
      kolesterol || null
    ]);

    return NextResponse.json({ success: true, message: 'Data medis pasien berhasil ditambahkan', data: { id: result.rows[0].id } });
  } catch (error) {
    console.error('Error adding pasien kesehatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
