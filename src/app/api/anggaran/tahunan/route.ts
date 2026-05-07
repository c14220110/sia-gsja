import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET: Fetch all Anggaran Tahunan
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await pool.query(`
      SELECT 
        at.id,
        at.kode_dokumen,
        at.tahun,
        s.nama_satelit AS satelit,
        k.nama_komisi   AS komisi,
        at.total_anggaran,
        at.status,
        at.updated_at
      FROM public.anggaran_tahunan at
      LEFT JOIN public.satelit  s ON at.satelit_id::varchar = s.id::varchar
      LEFT JOIN public.komisi   k ON at.komisi_id::varchar   = k.id::varchar
      ORDER BY at.tahun DESC, at.updated_at DESC
    `);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error fetching anggaran tahunan:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data anggaran', error: error.message }, { status: 500 });
  }
}

// POST: Create new Anggaran Tahunan (header + detail items in one transaction)
export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { satelit_id, komisi_id, tahun, action, items } = body;

    // Validation
    if (!satelit_id || !tahun) {
      return NextResponse.json({ success: false, message: 'Satelit dan Tahun wajib diisi.' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Minimal harus ada 1 item rincian anggaran.' }, { status: 400 });
    }
    // Ensure every item has a coa_id (harga mati)
    const missingCoa = items.find((i: any) => !i.coa_id);
    if (missingCoa) {
      return NextResponse.json({ success: false, message: `Item "${missingCoa.uraian}" belum memiliki Akun COA. Semua item wajib ditautkan ke COA.` }, { status: 400 });
    }

    const status = action === 'ajukan' ? 'Menunggu Review' : 'Draft';

    // Generate kode_dokumen: BGT-YY-XXX
    const yearCode = String(tahun).slice(-2);
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM public.anggaran_tahunan WHERE tahun = $1`, [tahun]
    );
    const seq = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
    const kode_dokumen = `BGT-${yearCode}-${seq}`;

    // Calculate total (sum of all pengeluaran items only, as the "anggaran" amount)
    const total_anggaran = items.reduce((sum: number, i: any) => sum + (i.jumlah * i.harga_satuan), 0);

    await client.query('BEGIN');

    // Insert header
    const headerRes = await client.query(
      `INSERT INTO public.anggaran_tahunan 
         (kode_dokumen, tahun, satelit_id, komisi_id, total_anggaran, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [kode_dokumen, tahun, satelit_id, komisi_id || null, total_anggaran, status]
    );
    const anggaranId = headerRes.rows[0].id;

    // Insert detail items
    for (const item of items) {
      await client.query(
        `INSERT INTO public.anggaran_tahunan_detail
           (anggaran_tahunan_id, jenis_anggaran, kegiatan_id, coa_id, sumber_dana, uraian, deskripsi, jumlah, satuan, harga_satuan, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          anggaranId,
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
    return NextResponse.json({ success: true, message: status === 'Menunggu Review' ? 'Anggaran berhasil diajukan!' : 'Draft anggaran berhasil disimpan!', data: { id: anggaranId, kode_dokumen } });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating anggaran tahunan:', error);
    if (error.code === '23505') return NextResponse.json({ success: false, message: 'Kode dokumen sudah ada, silakan coba lagi.' }, { status: 409 });
    return NextResponse.json({ success: false, message: 'Gagal menyimpan anggaran.', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
