// src/app/api/laporan/realisasi-kegiatan/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bulan  = searchParams.get('bulan')  || '';
  const tahun  = searchParams.get('tahun')  || new Date().getFullYear().toString();
  const satelitId = searchParams.get('satelit_id') || '';
  const komisiId  = searchParams.get('komisi_id')  || '';
  const jenis     = searchParams.get('jenis')      || ''; // 'Penerimaan' | 'Pengeluaran' | ''
  const coaId     = searchParams.get('coa_id')     || '';

  try {
    // ─── Build date filter ───────────────────────────────────────────────
    const conditions: string[] = [
      `lh.status_lpj IN ('Menunggu Review', 'Disetujui')`,
      `EXTRACT(YEAR FROM k.tanggal_mulai) = $1`,
    ];
    const params: any[] = [parseInt(tahun)];
    let idx = 2;

    if (bulan) {
      conditions.push(`EXTRACT(MONTH FROM k.tanggal_mulai) = $${idx++}`);
      params.push(parseInt(bulan));
    }
    if (satelitId) {
      conditions.push(`k.satelit_id = $${idx++}`);
      params.push(parseInt(satelitId));
    }
    if (komisiId) {
      conditions.push(`k.komisi_id = $${idx++}`);
      params.push(parseInt(komisiId));
    }
    if (jenis) {
      conditions.push(`d.jenis_anggaran = $${idx++}`);
      params.push(jenis);
    }
    if (coaId) {
      conditions.push(`d.coa_id = $${idx++}`);
      params.push(parseInt(coaId));
    }

    const WHERE = conditions.join(' AND ');

    // ─── 1. Grand Summary ────────────────────────────────────────────────
    const summaryRes = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN d.jenis_anggaran = 'Penerimaan' THEN d.jumlah * d.harga_satuan ELSE 0 END), 0) AS total_penerimaan,
        COALESCE(SUM(CASE WHEN d.jenis_anggaran = 'Pengeluaran' THEN d.jumlah * d.harga_satuan ELSE 0 END), 0) AS total_pengeluaran,
        COUNT(DISTINCT k.id) AS total_kegiatan,
        COUNT(DISTINCT lh.kegiatan_id) AS total_lpj
      FROM public.kegiatan_lpj_detail d
      JOIN public.kegiatan_lpj lh ON lh.kegiatan_id = d.kegiatan_id
      JOIN public.kegiatan k ON k.id = d.kegiatan_id
      WHERE ${WHERE}
    `, params);

    // ─── 2. Breakdown per COA ────────────────────────────────────────────
    const coaRes = await pool.query(`
      SELECT
        c.id AS coa_id,
        c.kode_akun,
        c.nama_akun,
        d.jenis_anggaran,
        COALESCE(SUM(d.jumlah * d.harga_satuan), 0) AS total_realisasi,
        COUNT(DISTINCT k.id) AS jumlah_kegiatan
      FROM public.kegiatan_lpj_detail d
      JOIN public.kegiatan_lpj lh ON lh.kegiatan_id = d.kegiatan_id
      JOIN public.kegiatan k ON k.id = d.kegiatan_id
      JOIN public.buku_besar_coa c ON c.id = d.coa_id
      WHERE ${WHERE}
      GROUP BY c.id, c.kode_akun, c.nama_akun, d.jenis_anggaran
      ORDER BY d.jenis_anggaran DESC, total_realisasi DESC
    `, params);

    // ─── 3. Breakdown per Satelit ────────────────────────────────────────
    const satelitRes = await pool.query(`
      SELECT
        s.id AS satelit_id,
        s.nama_satelit,
        COALESCE(SUM(CASE WHEN d.jenis_anggaran = 'Penerimaan' THEN d.jumlah * d.harga_satuan ELSE 0 END), 0) AS total_penerimaan,
        COALESCE(SUM(CASE WHEN d.jenis_anggaran = 'Pengeluaran' THEN d.jumlah * d.harga_satuan ELSE 0 END), 0) AS total_pengeluaran,
        COUNT(DISTINCT k.id) AS jumlah_kegiatan
      FROM public.kegiatan_lpj_detail d
      JOIN public.kegiatan_lpj lh ON lh.kegiatan_id = d.kegiatan_id
      JOIN public.kegiatan k ON k.id = d.kegiatan_id
      JOIN public.satelit s ON s.id = k.satelit_id
      WHERE ${WHERE}
      GROUP BY s.id, s.nama_satelit
      ORDER BY total_pengeluaran DESC
    `, params);

    // ─── 4. Breakdown per Komisi ─────────────────────────────────────────
    const komisiRes = await pool.query(`
      SELECT
        COALESCE(ko.id::text, 'umum') AS komisi_id,
        COALESCE(ko.nama_komisi, 'Umum / Non-Komisi') AS nama_komisi,
        s.nama_satelit,
        COALESCE(SUM(CASE WHEN d.jenis_anggaran = 'Penerimaan' THEN d.jumlah * d.harga_satuan ELSE 0 END), 0) AS total_penerimaan,
        COALESCE(SUM(CASE WHEN d.jenis_anggaran = 'Pengeluaran' THEN d.jumlah * d.harga_satuan ELSE 0 END), 0) AS total_pengeluaran,
        COUNT(DISTINCT k.id) AS jumlah_kegiatan
      FROM public.kegiatan_lpj_detail d
      JOIN public.kegiatan_lpj lh ON lh.kegiatan_id = d.kegiatan_id
      JOIN public.kegiatan k ON k.id = d.kegiatan_id
      JOIN public.satelit s ON s.id = k.satelit_id
      LEFT JOIN public.komisi ko ON ko.id = k.komisi_id
      WHERE ${WHERE}
      GROUP BY ko.id, ko.nama_komisi, s.nama_satelit
      ORDER BY total_pengeluaran DESC
    `, params);

    // ─── 5. Detail Rows ──────────────────────────────────────────────────
    const detailRes = await pool.query(`
      SELECT
        k.id AS kegiatan_id,
        k.kode_kegiatan,
        k.nama_kegiatan,
        k.tanggal_mulai,
        s.nama_satelit,
        COALESCE(ko.nama_komisi, 'Umum') AS nama_komisi,
        c.kode_akun,
        c.nama_akun,
        d.jenis_anggaran,
        d.uraian,
        d.jumlah,
        d.satuan,
        d.harga_satuan,
        (d.jumlah * d.harga_satuan) AS total,
        lh.status_lpj
      FROM public.kegiatan_lpj_detail d
      JOIN public.kegiatan_lpj lh ON lh.kegiatan_id = d.kegiatan_id
      JOIN public.kegiatan k ON k.id = d.kegiatan_id
      JOIN public.satelit s ON s.id = k.satelit_id
      LEFT JOIN public.komisi ko ON ko.id = k.komisi_id
      JOIN public.buku_besar_coa c ON c.id = d.coa_id
      WHERE ${WHERE}
      ORDER BY k.tanggal_mulai DESC, k.id, d.jenis_anggaran DESC, c.kode_akun
      LIMIT 200
    `, params);

    const summary = summaryRes.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_penerimaan: parseFloat(summary.total_penerimaan),
          total_pengeluaran: parseFloat(summary.total_pengeluaran),
          saldo: parseFloat(summary.total_penerimaan) - parseFloat(summary.total_pengeluaran),
          total_kegiatan: parseInt(summary.total_kegiatan),
          total_lpj: parseInt(summary.total_lpj),
        },
        by_coa: coaRes.rows.map(r => ({
          ...r,
          total_realisasi: parseFloat(r.total_realisasi),
          jumlah_kegiatan: parseInt(r.jumlah_kegiatan),
        })),
        by_satelit: satelitRes.rows.map(r => ({
          ...r,
          total_penerimaan: parseFloat(r.total_penerimaan),
          total_pengeluaran: parseFloat(r.total_pengeluaran),
          jumlah_kegiatan: parseInt(r.jumlah_kegiatan),
        })),
        by_komisi: komisiRes.rows.map(r => ({
          ...r,
          total_penerimaan: parseFloat(r.total_penerimaan),
          total_pengeluaran: parseFloat(r.total_pengeluaran),
          jumlah_kegiatan: parseInt(r.jumlah_kegiatan),
        })),
        detail: detailRes.rows.map(r => ({
          ...r,
          harga_satuan: parseFloat(r.harga_satuan),
          total: parseFloat(r.total),
        })),
      },
    });
  } catch (e: any) {
    console.error('[API Realisasi Kegiatan] Error:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
