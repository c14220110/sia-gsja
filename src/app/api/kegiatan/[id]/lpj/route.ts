import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// GET /api/kegiatan/[id]/lpj
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(_req);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    // 1. Fetch Kegiatan & RA Info
    const kegRes = await pool.query(`
      SELECT k.anggaran_tahunan_id, a.kode_dokumen, a.nama_rancangan, a.pola_penggunaan, a.total_disetujui
      FROM public.kegiatan k
      LEFT JOIN public.anggaran_tahunan a ON k.anggaran_tahunan_id = a.id
      WHERE k.id = $1
    `, [id]);
    const kegiatan = kegRes.rows[0];

    // 2. Fetch LPJ Header
    const lpjRes = await pool.query(
      `SELECT l.*, j.nama_lengkap as nama_pengaju
       FROM public.kegiatan_lpj l
       LEFT JOIN public.jemaat j ON l.diajukan_oleh_id = j.id
       WHERE l.kegiatan_id = $1`, [id]
    );

    // 3. Fetch LPJ Items
    let detailRes = await pool.query(
      `SELECT d.*, b.kode_akun, b.nama_akun, b.saldo_normal
       FROM public.kegiatan_lpj_detail d
       LEFT JOIN public.buku_besar_coa b ON d.coa_id = b.id
       WHERE d.kegiatan_id = $1
       ORDER BY d.jenis_anggaran DESC, d.id ASC`, [id]
    );

    let isPrefilled = false;
    let raItemsReference: any[] = [];
    // 4. Pre-fill from RA if LPJ is empty and RA exists
    if (detailRes.rows.length === 0 && kegiatan?.anggaran_tahunan_id) {
      const raItems = await pool.query(
        `SELECT d.jenis_anggaran, d.coa_id, d.sumber_dana, d.uraian, d.deskripsi, d.jumlah, d.satuan, d.harga_satuan, b.kode_akun, b.nama_akun, b.saldo_normal
         FROM public.anggaran_tahunan_detail d
         LEFT JOIN public.buku_besar_coa b ON d.coa_id = b.id
         WHERE d.anggaran_tahunan_id = $1
         ORDER BY d.jenis_anggaran DESC, d.id ASC`, [kegiatan.anggaran_tahunan_id]
      );
      if (kegiatan?.pola_penggunaan === 'Sekali Pakai') {
        // Sekali Pakai: pre-fill sebagai template yang bisa diedit
        detailRes = raItems;
        isPrefilled = raItems.rows.length > 0;
      } else {
        // Bertahap: tampilkan sebagai referensi view-only saja, jangan isi form
        raItemsReference = raItems.rows;
        isPrefilled = false;
      }
    }

    // 5. Calculate RA consumption if Bertahap
    let raTerpakai = 0;
    if (kegiatan?.pola_penggunaan === 'Bertahap') {
      const terpakaiRes = await pool.query(`
        SELECT COALESCE(SUM(l.total_pengeluaran), 0) as total_terpakai
        FROM public.kegiatan k
        JOIN public.kegiatan_lpj l ON k.id = l.kegiatan_id
        WHERE k.anggaran_tahunan_id = $1 AND l.status_lpj IN ('Disetujui', 'Menunggu Review') AND k.id != $2
      `, [kegiatan.anggaran_tahunan_id, id]);
      raTerpakai = parseFloat(terpakaiRes.rows[0].total_terpakai);
    }

    return NextResponse.json({
      success: true,
      data: {
        header: lpjRes.rows[0] || null,
        items: detailRes.rows,
        is_prefilled: isPrefilled,
        ra_items_reference: raItemsReference, // view-only reference for Bertahap
        ra_info: kegiatan?.anggaran_tahunan_id ? {
          id: kegiatan.anggaran_tahunan_id,
          kode: kegiatan.kode_dokumen,
          nama: kegiatan.nama_rancangan,
          pola: kegiatan.pola_penggunaan,
          total_disetujui: parseFloat(kegiatan.total_disetujui || 0),
          total_terpakai_lain: raTerpakai
        } : null
      }
    });
  } catch (err: any) {
    console.error('[LPJ GET]', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST /api/kegiatan/[id]/lpj
// body: { action: 'draft'|'ajukan', laporan_naratif?, items: [...] }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(req);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { action, laporan_naratif, items } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Minimal 1 item rincian keuangan harus diisi.' }, { status: 400 });
    }
    const missingCoa = items.find((i: any) => !i.coa_id);
    if (missingCoa) {
      return NextResponse.json({ success: false, message: `Item "${missingCoa.uraian}" belum memilih Akun COA. Wajib diisi.` }, { status: 400 });
    }

    const status_lpj = action === 'ajukan' ? 'Menunggu Review' : 'Draft';

    const totalPenerimaan = items
      .filter((i: any) => i.jenis_anggaran === 'Penerimaan')
      .reduce((s: number, i: any) => s + i.jumlah * i.harga_satuan, 0);
    const totalPengeluaran = items
      .filter((i: any) => i.jenis_anggaran === 'Pengeluaran')
      .reduce((s: number, i: any) => s + i.jumlah * i.harga_satuan, 0);
    const totalKontribusiPeserta = items
      .filter((i: any) => i.sumber_dana === 'Kontribusi Peserta')
      .reduce((s: number, i: any) => s + i.jumlah * i.harga_satuan, 0);
    const sisa_dana = totalPenerimaan - totalPengeluaran;

    await client.query('BEGIN');

    // Upsert header
    await client.query(
      `INSERT INTO public.kegiatan_lpj (kegiatan_id, laporan_naratif, status_lpj, total_kontribusi_peserta, total_pengeluaran, sisa_dana, waktu_submit)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (kegiatan_id) DO UPDATE SET
         laporan_naratif = EXCLUDED.laporan_naratif,
         status_lpj = EXCLUDED.status_lpj,
         total_kontribusi_peserta = EXCLUDED.total_kontribusi_peserta,
         total_pengeluaran = EXCLUDED.total_pengeluaran,
         sisa_dana = EXCLUDED.sisa_dana,
         waktu_submit = NOW()`,
      [id, laporan_naratif || '', status_lpj, totalKontribusiPeserta, totalPengeluaran, sisa_dana]
    );

    // Replace all detail items
    await client.query(`DELETE FROM public.kegiatan_lpj_detail WHERE kegiatan_id = $1`, [id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO public.kegiatan_lpj_detail (kegiatan_id, jenis_anggaran, coa_id, sumber_dana, uraian, deskripsi, jumlah, satuan, harga_satuan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, item.jenis_anggaran, item.coa_id, item.sumber_dana, item.uraian, item.deskripsi || null, item.jumlah, item.satuan || null, item.harga_satuan]
      );
    }

    // Jika diajukan, update status kegiatan menjadi Selesai
    if (action === 'ajukan') {
      await client.query(`UPDATE public.kegiatan SET status_kegiatan = 'Selesai' WHERE id = $1`, [id]);
    }

    await client.query('COMMIT');
    return NextResponse.json({
      success: true,
      message: action === 'ajukan' ? 'LPJ berhasil diajukan! Status kegiatan diubah menjadi Selesai.' : 'Draft LPJ berhasil disimpan.'
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[LPJ POST]', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
