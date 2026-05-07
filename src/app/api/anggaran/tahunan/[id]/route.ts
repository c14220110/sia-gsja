import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET: Fetch a single Anggaran Tahunan with its details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    // 1. Fetch Header
    const headerRes = await pool.query(
      `SELECT 
         at.*,
         s.nama_satelit,
         k.nama_komisi,
         COALESCE(j.nama_lengkap, p.email) as pembuat
       FROM public.anggaran_tahunan at
       LEFT JOIN public.satelit s ON at.satelit_id = s.id
       LEFT JOIN public.komisi k ON at.komisi_id = k.id
       LEFT JOIN public.pengguna p ON at.created_by = p.id
       LEFT JOIN public.jemaat j ON p.jemaat_id = j.id
       WHERE at.id = $1`,
      [id]
    );

    if (headerRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Anggaran tidak ditemukan' }, { status: 404 });
    }
    const header = headerRes.rows[0];

    // 2. Fetch Detail Items
    const detailRes = await pool.query(
      `SELECT 
         ad.*,
         c.kode_akun,
         c.nama_akun,
         kg.nama_kegiatan,
         kg.kode_kegiatan
       FROM public.anggaran_tahunan_detail ad
       LEFT JOIN public.buku_besar_coa c ON ad.coa_id = c.id
       LEFT JOIN public.kegiatan kg ON ad.kegiatan_id = kg.id
       WHERE ad.anggaran_tahunan_id = $1
       ORDER BY ad.jenis_anggaran ASC, ad.created_at ASC`,
      [id]
    );

    return NextResponse.json({ success: true, data: { ...header, items: detailRes.rows } });
  } catch (error: any) {
    console.error('Error fetching detail anggaran:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data', error: error.message }, { status: 500 });
  }
}

// PUT: Update Anggaran Tahunan (Header + Detail)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { satelit_id, komisi_id, tahun, action, items } = body;

    if (!satelit_id || !tahun) return NextResponse.json({ success: false, message: 'Satelit dan Tahun wajib diisi' }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ success: false, message: 'Minimal harus ada 1 item' }, { status: 400 });

    const status = action === 'ajukan' ? 'Menunggu Review' : 'Draft';
    const total_anggaran = items.reduce((sum: number, i: any) => sum + (i.jumlah * i.harga_satuan), 0);

    await client.query('BEGIN');

    // Update Header
    await client.query(
      `UPDATE public.anggaran_tahunan 
       SET tahun = $1, satelit_id = $2, komisi_id = $3, total_anggaran = $4, status = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [tahun, satelit_id, komisi_id || null, total_anggaran, status, id]
    );

    // Delete Old Details
    await client.query(`DELETE FROM public.anggaran_tahunan_detail WHERE anggaran_tahunan_id = $1`, [id]);

    // Insert New Details
    for (const item of items) {
      await client.query(
        `INSERT INTO public.anggaran_tahunan_detail
           (anggaran_tahunan_id, jenis_anggaran, kegiatan_id, coa_id, sumber_dana, uraian, deskripsi, jumlah, satuan, harga_satuan, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id,
          item.jenis_anggaran,
          item.kegiatan_id || null,
          item.coa_id,
          item.sumber_dana,
          item.uraian,
          item.deskripsi || null,
          item.jumlah,
          item.satuan || null,
          item.harga_satuan,
          item.jumlah * item.harga_satuan
        ]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: action === 'ajukan' ? 'Anggaran berhasil diajukan!' : 'Perubahan draft berhasil disimpan!' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating anggaran:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengupdate anggaran.', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
