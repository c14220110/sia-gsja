import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Drop existing if we are resetting (optional, but let's just create if not exists or let it throw if exists)
    // Wait, the user script doesn't have IF NOT EXISTS. So we just execute the raw SQL they gave.
    
    // TABEL HEADER: JURNAL UMUM
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.buku_besar_jurnal (
        id SERIAL NOT NULL,
        nomor_referensi VARCHAR(50) NOT NULL UNIQUE,
        tanggal_transaksi DATE NOT NULL,
        deskripsi TEXT NOT NULL,
        total_debit NUMERIC(15,2) NOT NULL DEFAULT 0,
        total_kredit NUMERIC(15,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'Draft',
        created_by INTEGER NULL, -- Made null temporarily just in case user table is empty/not linked properly
        posted_by INTEGER NULL,
        posted_at TIMESTAMP WITHOUT TIME ZONE NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT buku_besar_jurnal_pkey PRIMARY KEY (id),
        CONSTRAINT buku_besar_jurnal_status_check CHECK (status IN ('Draft', 'Posted'))
      );
    `);

    // TABEL DETAIL: BARIS TRANSAKSI
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.buku_besar_jurnal_detail (
        id SERIAL NOT NULL,
        jurnal_id INTEGER NOT NULL,
        coa_id INTEGER NOT NULL,
        satelit_id INTEGER NULL,
        departemen_id INTEGER NULL,
        komisi_id INTEGER NULL,
        kegiatan_id INTEGER NULL,
        posisi VARCHAR(10) NOT NULL,
        nominal NUMERIC(15,2) NOT NULL CHECK (nominal > 0),
        keterangan_baris VARCHAR(255) NULL,
        CONSTRAINT buku_besar_jurnal_detail_pkey PRIMARY KEY (id),
        CONSTRAINT fk_jurnal_detail_header FOREIGN KEY (jurnal_id) REFERENCES public.buku_besar_jurnal(id) ON DELETE CASCADE,
        CONSTRAINT fk_jurnal_detail_coa FOREIGN KEY (coa_id) REFERENCES public.buku_besar_coa(id) ON DELETE RESTRICT,
        CONSTRAINT buku_besar_jurnal_detail_posisi_check CHECK (posisi IN ('Debit', 'Kredit'))
      );
    `);

    return NextResponse.json({ success: true, message: 'Tabel Jurnal Umum berhasil dibuat!' });
  } catch (error: any) {
    console.error('Error creating Jurnal tables:', error);
    return NextResponse.json({ success: false, message: 'Gagal membuat tabel', error: error.message }, { status: 500 });
  }
}
