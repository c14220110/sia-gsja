import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller || !caller.is_super_admin) {
    return NextResponse.json({ success: false, message: 'Forbidden: Super Admin only' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Drop existing coa table if exists and recreate
    await client.query(`DROP TABLE IF EXISTS public.buku_besar_coa CASCADE;`);

    const createTableQuery = `
      CREATE TABLE public.buku_besar_coa (
        id SERIAL PRIMARY KEY,
        kode_akun VARCHAR(20) UNIQUE NOT NULL,
        nama_akun VARCHAR(255) NOT NULL,
        induk_akun_id INTEGER REFERENCES public.buku_besar_coa(id) ON DELETE RESTRICT,
        grup_laporan VARCHAR(50) NOT NULL CHECK (grup_laporan IN ('Neraca', 'Laba Rugi')),
        tipe_akun VARCHAR(20) NOT NULL CHECK (tipe_akun IN ('Header', 'Detail')),
        saldo_normal VARCHAR(10) NOT NULL CHECK (saldo_normal IN ('Debit', 'Kredit')),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(createTableQuery);

    // 2. Read and parse CSV
    const csvPath = path.join(process.cwd(), 'bagan_akun_rapi.csv');
    if (!fs.existsSync(csvPath)) {
       throw new Error('File bagan_akun_rapi.csv tidak ditemukan di root project.');
    }
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l);
    
    // Helper to insert and get ID
    const insertAkun = async (kode: string, nama: string, indukId: number | null, grup: string, tipe: string, saldoNormal: string) => {
      // Check if code already exists (to avoid duplicate header creation)
      const existing = await client.query('SELECT id FROM public.buku_besar_coa WHERE kode_akun = $1', [kode]);
      if (existing.rows.length > 0) return existing.rows[0].id;

      const res = await client.query(`
        INSERT INTO public.buku_besar_coa (kode_akun, nama_akun, induk_akun_id, grup_laporan, tipe_akun, saldo_normal)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
      `, [kode, nama, indukId, grup, tipe, saldoNormal]);
      return res.rows[0].id;
    };

    const getGrupAndSaldo = (namaAkun: string) => {
      const upper = namaAkun.toUpperCase();
      if (upper.includes('ASSET') || upper.includes('ASET') || upper.includes('PIHUTANG')) return { grup: 'Neraca', saldo: 'Debit' };
      if (upper.includes('LIABILITY') || upper.includes('HUTANG') || upper.includes('KEWAJIBAN') || upper.includes('EQUITY') || upper.includes('MODAL')) return { grup: 'Neraca', saldo: 'Kredit' };
      if (upper.includes('BEBAN') || upper.includes('BIAYA')) return { grup: 'Laba Rugi', saldo: 'Debit' };
      if (upper.includes('PENDAPATAN')) return { grup: 'Laba Rugi', saldo: 'Kredit' };
      return { grup: 'Neraca', saldo: 'Debit' }; // Fallback
    };

    let level1Map: Record<string, number> = {};
    let level2Map: Record<string, number> = {};

    // Header: Tipe Akun Utama,Kategori Akun,Nama Akun Detail,Kode Akun
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      let parts = [];
      let inQuotes = false;
      let currentPart = '';
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '"') {
          inQuotes = !inQuotes;
        } else if (line[j] === ',' && !inQuotes) {
          parts.push(currentPart);
          currentPart = '';
        } else {
          currentPart += line[j];
        }
      }
      parts.push(currentPart);
      
      if (parts.length < 4) continue;
      
      const tipeUtama = parts[0]?.trim(); // Level 1 (e.g. ASSET)
      const kategori = parts[1]?.trim();  // Level 2 (e.g. Kas dan Bank)
      const namaDetail = parts[2]?.trim(); // Level 3 (e.g. Bank BCA)
      const kodeAkun = parts[3]?.trim();   // e.g. 120101

      if (!tipeUtama || !kategori || !namaDetail || !kodeAkun) continue;

      const { grup, saldo } = getGrupAndSaldo(tipeUtama);

      // 1. Ensure Level 1 exists
      if (!level1Map[tipeUtama]) {
         const dummyKode1 = 'H1-' + tipeUtama.substring(0, 3).toUpperCase() + '-' + i;
         level1Map[tipeUtama] = await insertAkun(dummyKode1, tipeUtama, null, grup, 'Header', saldo);
      }
      const l1Id = level1Map[tipeUtama];

      // 2. Ensure Level 2 exists
      const l2Key = tipeUtama + '_' + kategori;
      if (!level2Map[l2Key]) {
         // Generate a logical header code from the first detail account
         const dummyKode2 = 'H2-' + kodeAkun.substring(0, 4); // Misal dari 120101 -> H2-1201
         level2Map[l2Key] = await insertAkun(dummyKode2, kategori, l1Id, grup, 'Header', saldo);
      }
      const l2Id = level2Map[l2Key];

      // 3. Insert Level 3 Detail
      await insertAkun(kodeAkun, namaDetail, l2Id, grup, 'Detail', saldo);
    }
    
    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Table created successfully' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message });
  } finally {
    client.release();
  }
}
