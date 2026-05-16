import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    const numId = parseInt(id, 10);
    console.log(`[DEBUG SEED] Attempting to seed for ID: ${id} (Parsed: ${numId})`);

    // Insert Header
    await pool.query(`
      INSERT INTO public.kegiatan_lpj 
      (kegiatan_id, laporan_naratif, status_lpj, waktu_submit, total_pengeluaran, sisa_dana) 
      VALUES ($1, 'Aman si acaranya', 'Menunggu Review', NOW(), 400000, 3100000)
      ON CONFLICT (kegiatan_id) DO UPDATE SET laporan_naratif = EXCLUDED.laporan_naratif, status_lpj = EXCLUDED.status_lpj
    `, [numId]);

    // Insert Details
    await pool.query('DELETE FROM public.kegiatan_lpj_detail WHERE kegiatan_id = $1', [numId]);
    await pool.query(`
      INSERT INTO public.kegiatan_lpj_detail 
      (kegiatan_id, jenis_anggaran, coa_id, sumber_dana, uraian, deskripsi, jumlah, satuan, harga_satuan, created_at) 
      VALUES 
      ($1, 'Pengeluaran', 145, 'Kas Mandiri', 'Makan 52x', null, 1, 'Kali', 400000, NOW()), 
      ($1, 'Penerimaan', 76, 'Kas Mandiri', 'Kolekte', null, 1, 'Sesi', 3500000, NOW())
    `, [numId]);

    return NextResponse.json({ success: true, message: 'Data simulasi berhasil dimasukkan!' });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
