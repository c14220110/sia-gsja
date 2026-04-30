import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Get single journal with details
      const headerRes = await pool.query(`SELECT * FROM public.buku_besar_jurnal WHERE id = $1`, [id]);
      if (headerRes.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Jurnal tidak ditemukan' }, { status: 404 });
      }

      const detailRes = await pool.query(`
        SELECT d.*, c.kode_akun, c.nama_akun
        FROM public.buku_besar_jurnal_detail d
        JOIN public.buku_besar_coa c ON d.coa_id = c.id
        WHERE d.jurnal_id = $1
        ORDER BY d.id ASC
      `, [id]);

      return NextResponse.json({
        success: true,
        data: {
          ...headerRes.rows[0],
          details: detailRes.rows
        }
      });
    }

    // Get list of journals
    const res = await pool.query(`
      SELECT * FROM public.buku_besar_jurnal 
      ORDER BY tanggal_transaksi DESC, created_at DESC 
      LIMIT 100
    `);

    return NextResponse.json({
      success: true,
      data: res.rows
    });
  } catch (error: any) {
    console.error('Error fetching Jurnal:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data jurnal', error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { tanggal_transaksi, deskripsi, status, details, satelit_kode } = body; 
    // satelit_kode is passed from frontend to generate the reference number (e.g. 'PST')

    if (!details || details.length < 2) {
      return NextResponse.json({ success: false, message: 'Jurnal minimal harus memiliki 2 baris transaksi' }, { status: 400 });
    }

    // Calculate Totals
    let totalDebit = 0;
    let totalKredit = 0;
    for (const d of details) {
      const nom = parseFloat(d.nominal);
      if (isNaN(nom) || nom <= 0) {
        return NextResponse.json({ success: false, message: 'Nominal harus lebih dari 0' }, { status: 400 });
      }
      if (d.posisi === 'Debit') totalDebit += nom;
      else if (d.posisi === 'Kredit') totalKredit += nom;
      else return NextResponse.json({ success: false, message: 'Posisi hanya boleh Debit atau Kredit' }, { status: 400 });
    }

    // Validation: Balance Check ONLY for Posted
    if (status === 'Posted' && Math.abs(totalDebit - totalKredit) > 0.01) {
      return NextResponse.json({ success: false, message: 'Transaksi tidak seimbang! Jurnal yang diposting harus memiliki total Debit dan Kredit yang sama.' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Generate Reference Number: JU-{Satelit}-{YYMM}-{0001}
    const dateObj = new Date(tanggal_transaksi);
    const yy = dateObj.getFullYear().toString().slice(-2);
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `JU-${satelit_kode || 'PST'}-${yy}${mm}-`;

    const maxRefRes = await client.query(
      `SELECT nomor_referensi FROM public.buku_besar_jurnal WHERE nomor_referensi LIKE $1 ORDER BY nomor_referensi DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNum = 1;
    if (maxRefRes.rows.length > 0) {
      const lastRef = maxRefRes.rows[0].nomor_referensi;
      const lastNumStr = lastRef.split('-').pop();
      nextNum = parseInt(lastNumStr || '0') + 1;
    }
    const nomor_referensi = `${prefix}${nextNum.toString().padStart(4, '0')}`;

    // Note: Temporary hardcode created_by = 1 since we don't have auth context here yet
    const created_by = 1; 

    // Insert Header
    const headerRes = await client.query(
      `INSERT INTO public.buku_besar_jurnal 
       (nomor_referensi, tanggal_transaksi, deskripsi, total_debit, total_kredit, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [nomor_referensi, tanggal_transaksi, deskripsi, totalDebit, totalKredit, status || 'Draft', created_by]
    );
    const jurnalId = headerRes.rows[0].id;

    // Insert Details
    for (const d of details) {
      // Basic check if COA is Detail Type
      const coaRes = await client.query(`SELECT tipe_akun FROM public.buku_besar_coa WHERE id = $1`, [d.coa_id]);
      if (coaRes.rows.length === 0 || coaRes.rows[0].tipe_akun !== 'Detail') {
        throw new Error(`Akun yang dipilih harus bertipe Detail (ID: ${d.coa_id})`);
      }

      await client.query(
        `INSERT INTO public.buku_besar_jurnal_detail 
         (jurnal_id, coa_id, satelit_id, departemen_id, komisi_id, kegiatan_id, posisi, nominal, keterangan_baris)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [jurnalId, d.coa_id, d.satelit_id || null, d.departemen_id || null, d.komisi_id || null, d.kegiatan_id || null, d.posisi, d.nominal, d.keterangan_baris || null]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Jurnal berhasil disimpan',
      data: { id: jurnalId, nomor_referensi }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating Jurnal:', error);
    return NextResponse.json({ success: false, message: error.message || 'Gagal menyimpan jurnal' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { id, tanggal_transaksi, deskripsi, status, details } = body; 

    // Check existing
    const checkRes = await client.query(`SELECT status FROM public.buku_besar_jurnal WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Jurnal tidak ditemukan' }, { status: 404 });
    }

    // Pantang Mundur (Immutable) Validation
    if (checkRes.rows[0].status === 'Posted') {
      return NextResponse.json({ success: false, message: 'Jurnal yang sudah diposting HARAM untuk diubah. Gunakan jurnal pembalik jika ada kesalahan.' }, { status: 403 });
    }

    if (!details || details.length < 2) {
      return NextResponse.json({ success: false, message: 'Jurnal minimal harus memiliki 2 baris transaksi' }, { status: 400 });
    }

    // Calculate Totals
    let totalDebit = 0;
    let totalKredit = 0;
    for (const d of details) {
      const nom = parseFloat(d.nominal);
      if (isNaN(nom) || nom <= 0) return NextResponse.json({ success: false, message: 'Nominal harus lebih dari 0' }, { status: 400 });
      if (d.posisi === 'Debit') totalDebit += nom;
      else if (d.posisi === 'Kredit') totalKredit += nom;
      else return NextResponse.json({ success: false, message: 'Posisi hanya boleh Debit atau Kredit' }, { status: 400 });
    }

    // Validation: Balance Check ONLY for Posted
    if (status === 'Posted' && Math.abs(totalDebit - totalKredit) > 0.01) {
      return NextResponse.json({ success: false, message: 'Transaksi tidak seimbang! Jurnal yang diposting harus memiliki total Debit dan Kredit yang sama.' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Update Header
    let postedByQuery = '';
    let postedParams = [tanggal_transaksi, deskripsi, totalDebit, totalKredit, status, id];
    let queryArgs = 6;
    
    if (status === 'Posted') {
       postedByQuery = `, posted_by = $${queryArgs + 1}, posted_at = CURRENT_TIMESTAMP`;
       postedParams.push(1); // hardcode user id 1
    }

    await client.query(
      `UPDATE public.buku_besar_jurnal 
       SET tanggal_transaksi = $1, deskripsi = $2, total_debit = $3, total_kredit = $4, status = $5, updated_at = CURRENT_TIMESTAMP ${postedByQuery}
       WHERE id = $6`,
      postedParams
    );

    // Delete old details
    await client.query(`DELETE FROM public.buku_besar_jurnal_detail WHERE jurnal_id = $1`, [id]);

    // Insert new details
    for (const d of details) {
      const coaRes = await client.query(`SELECT tipe_akun FROM public.buku_besar_coa WHERE id = $1`, [d.coa_id]);
      if (coaRes.rows.length === 0 || coaRes.rows[0].tipe_akun !== 'Detail') {
        throw new Error(`Akun yang dipilih harus bertipe Detail (ID: ${d.coa_id})`);
      }

      await client.query(
        `INSERT INTO public.buku_besar_jurnal_detail 
         (jurnal_id, coa_id, satelit_id, departemen_id, komisi_id, kegiatan_id, posisi, nominal, keterangan_baris)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, d.coa_id, d.satelit_id || null, d.departemen_id || null, d.komisi_id || null, d.kegiatan_id || null, d.posisi, d.nominal, d.keterangan_baris || null]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({ success: true, message: 'Jurnal berhasil diperbarui' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating Jurnal:', error);
    return NextResponse.json({ success: false, message: error.message || 'Gagal memperbarui jurnal' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, message: 'ID tidak ditemukan' }, { status: 400 });

    const checkRes = await pool.query(`SELECT status FROM public.buku_besar_jurnal WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) return NextResponse.json({ success: false, message: 'Jurnal tidak ditemukan' }, { status: 404 });

    // Pantang Mundur Validation
    if (checkRes.rows[0].status === 'Posted') {
      return NextResponse.json({ success: false, message: 'Jurnal yang sudah diposting HARAM dihapus!' }, { status: 403 });
    }

    await pool.query(`DELETE FROM public.buku_besar_jurnal WHERE id = $1`, [id]);
    return NextResponse.json({ success: true, message: 'Jurnal berhasil dihapus' });
  } catch (error: any) {
    console.error('Error deleting Jurnal:', error);
    return NextResponse.json({ success: false, message: 'Gagal menghapus jurnal', error: error.message }, { status: 500 });
  }
}
