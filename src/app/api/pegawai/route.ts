import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('pegawai_view')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin melihat data pegawai' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const satelit_id = searchParams.get('satelit_id') || '';
    const departemen_id = searchParams.get('departemen_id') || '';
    const status_pegawai = searchParams.get('status_pegawai') || 'Aktif';
    const tipe_pekerja = searchParams.get('tipe_pekerja') || '';
    
    // Pagination
    const limitParams = searchParams.get('limit');
    let limit = limitParams ? parseInt(limitParams) : 10;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100;
      
    const offsetParams = searchParams.get('offset');
    let offset = offsetParams ? parseInt(offsetParams) : 0;
    if (isNaN(offset) || offset < 0) offset = 0;

    let query = `
      SELECT 
        p.id, p.id_pegawai, p.nama_lengkap, p.tipe_pekerja, p.status_pegawai, p.status_approval,
        s.nama_satelit, jpm.nama_jabatan, d.nama_departemen
      FROM public.pegawai p
      LEFT JOIN public.satelit s ON p.satelit_id = s.id
      LEFT JOIN public.jabatan_pegawai_master jpm ON p.jabatan_pegawai_id = jpm.id
      LEFT JOIN public.departemen d ON p.departemen_id = d.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM public.pegawai p
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      const searchStr = `%${search}%`;
      query += ` AND (p.nama_lengkap ILIKE $${paramIndex} OR p.id_pegawai ILIKE $${paramIndex})`;
      countQuery += ` AND (p.nama_lengkap ILIKE $${paramIndex} OR p.id_pegawai ILIKE $${paramIndex})`;
      params.push(searchStr);
      paramIndex++;
    }

    if (satelit_id) {
      query += ` AND p.satelit_id = $${paramIndex}`;
      countQuery += ` AND p.satelit_id = $${paramIndex}`;
      params.push(parseInt(satelit_id));
      paramIndex++;
    }

    if (departemen_id) {
      query += ` AND p.departemen_id = $${paramIndex}`;
      countQuery += ` AND p.departemen_id = $${paramIndex}`;
      params.push(parseInt(departemen_id));
      paramIndex++;
    }

    if (status_pegawai && status_pegawai !== 'Semua') {
      query += ` AND p.status_pegawai = $${paramIndex}`;
      countQuery += ` AND p.status_pegawai = $${paramIndex}`;
      params.push(status_pegawai);
      paramIndex++;
    }

    if (tipe_pekerja) {
      query += ` AND p.tipe_pekerja = $${paramIndex}`;
      countQuery += ` AND p.tipe_pekerja = $${paramIndex}`;
      params.push(tipe_pekerja);
      paramIndex++;
    }

    query += ` ORDER BY p.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const queryParams = [...params, limit, offset];

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, params)
    ]);

    const total = parseInt(countResult.rows[0].total);

    // Get Pending approval count today for meta
    const pendingQuery = `SELECT COUNT(*) as pending_count FROM public.pegawai WHERE status_approval = 'Pending'`;
    const pendingResult = await pool.query(pendingQuery);

    return NextResponse.json({
      success: true,
      data: dataResult.rows,
      meta: {
        total,
        limit,
        offset,
        pending_approval: parseInt(pendingResult.rows[0].pending_count)
      }
    });

  } catch (error: any) {
    console.error('API /pegawai GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('pegawai_create')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin mendaftarkan pegawai baru' }, { status: 403 });
  }

  try {
    const body = await request.json();
    
    // Construct id_pegawai: PG + SatelitId (2 digits) + YY + Random(3)
    const satelitPrefix = body.satelit_id?.toString().padStart(2, '0') || '00';
    const yy = new Date().getFullYear().toString().slice(-2);
    const rnd = Math.floor(100 + Math.random() * 900).toString();
    const generatedIdPegawai = `PG${satelitPrefix}${yy}${rnd}`;

    const insertQuery = `
      INSERT INTO public.pegawai (
        id_pegawai, jemaat_id, nama_lengkap, nik, no_kk, status_pernikahan, 
        jumlah_anak, tanggal_lahir, jenis_kelamin, no_hp, email_pribadi, 
        kontak_darurat_nama, kontak_darurat_nohp, kontak_darurat_relasi, 
        jabatan_pegawai_id, departemen_id, tanggal_bergabung, 
        status_pegawai, status_approval, 
        alamat_lengkap, rt_rw, kota, kode_pos, 
        is_kena_pph21, no_npwp, tipe_pekerja, status_ptkp, 
        bank_id, no_rekening, atas_nama_rekening, satelit_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 
        $7, $8, $9, $10, $11, 
        $12, $13, $14, 
        $15, $16, $17, 
        'Aktif', 'Pending', 
        $18, $19, $20, $21, 
        $22, $23, $24, $25, 
        $26, $27, $28, $29
      ) RETURNING id
    `;

    const values = [
      generatedIdPegawai,
      body.jemaat_id || null, // Can be null if not a member yet
      body.nama_lengkap,
      body.nik,
      body.no_kk || null,
      body.status_pernikahan || null,
      body.jumlah_anak ? parseInt(body.jumlah_anak) : 0,
      body.tanggal_lahir || null,
      body.jenis_kelamin || null,
      body.no_hp || null,
      body.email_pribadi || null,
      body.kontak_darurat_nama || null,
      body.kontak_darurat_nohp || null,
      body.kontak_darurat_relasi || null,
      body.jabatan_pegawai_id ? parseInt(body.jabatan_pegawai_id) : null,
      body.departemen_id ? parseInt(body.departemen_id) : null,
      body.tanggal_bergabung || null,
      body.alamat_lengkap || null,
      body.rt_rw || null,
      body.kota || null,
      body.kode_pos || null,
      body.is_kena_pph21 === undefined ? true : body.is_kena_pph21,
      body.no_npwp || null,
      body.tipe_pekerja || null,
      body.status_ptkp || null,
      body.bank_id ? parseInt(body.bank_id) : null,
      body.no_rekening || null,
      body.atas_nama_rekening || null,
      body.satelit_id ? parseInt(body.satelit_id) : null
    ];

    const result = await pool.query(insertQuery, values);
    const newId = result.rows[0].id;

    return NextResponse.json({
      success: true,
      message: 'Pegawai baru berhasil didaftarkan dan sedang Pending Approval.',
      data: { id: newId, id_pegawai: generatedIdPegawai }
    }, { status: 201 });

  } catch (error: any) {
    console.error('API /pegawai POST error:', error);
    if (error.code === '23505') {
       return NextResponse.json({ success: false, message: 'Data yang sama (NIK/Jemaat/ID) sudah ada.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
