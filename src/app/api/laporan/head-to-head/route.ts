// src/app/api/laporan/head-to-head/route.ts
// Head-to-Head: Anggaran (RA) vs Realisasi (LPJ)
// Logic:
//   - Untuk setiap RA yang memiliki kegiatan dengan LPJ di periode filter,
//     tampilkan: Plafon Disetujui (dari anggaran_tahunan_detail) vs Total Realisasi (dari kegiatan_lpj_detail)
//   - Multi-Event RA: akumulasi SEMUA LPJ yang terhubung ke RA tersebut
//   - Single Event RA: 1 RA = 1 LPJ = perbandingan langsung

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
  const tahun     = searchParams.get('tahun')     || new Date().getFullYear().toString();
  const bulan     = searchParams.get('bulan')     || '';
  const satelitId = searchParams.get('satelit_id') || '';
  const komisiId  = searchParams.get('komisi_id')  || '';

  try {
    // Build date filter untuk kegiatan yang ber-LPJ
    const kegConditions: string[] = [
      `EXTRACT(YEAR FROM k.tanggal_mulai) = $1`,
      `lh.status_lpj IN ('Menunggu Review', 'Disetujui')`,
    ];
    const params: any[] = [parseInt(tahun)];
    let idx = 2;

    if (bulan) {
      kegConditions.push(`EXTRACT(MONTH FROM k.tanggal_mulai) = $${idx++}`);
      params.push(parseInt(bulan));
    }
    if (satelitId) {
      kegConditions.push(`k.satelit_id = $${idx++}`);
      params.push(parseInt(satelitId));
    }
    if (komisiId) {
      kegConditions.push(`k.komisi_id = $${idx++}`);
      params.push(parseInt(komisiId));
    }

    const WHERE_KEG = kegConditions.join(' AND ');

    // ─── 1. Dapatkan daftar RA unik yang kegiatan-kegiatannya ber-LPJ di periode ini ───
    //        Beserta agregat realisasi & metadata kegiatan
    const raListRes = await pool.query(`
      SELECT
        ra.id                           AS ra_id,
        ra.kode_dokumen,
        ra.nama_rancangan,
        ra.pola_penggunaan,
        ra.kategori_ra,
        ra.status                       AS status_ra,
        s.nama_satelit,
        COALESCE(ko.nama_komisi, 'Umum / Non-Komisi') AS nama_komisi,

        -- Plafon dari RA (hanya item yang disetujui)
        COALESCE((
          SELECT SUM(d.nominal_disetujui)
          FROM public.anggaran_tahunan_detail d
          WHERE d.anggaran_tahunan_id = ra.id
            AND d.jenis_anggaran = 'Pengeluaran'
            AND d.status_item IN ('ACC', 'ACC_DIPOTONG')
        ), 0) AS plafon_pengeluaran,

        COALESCE((
          SELECT SUM(d.nominal_disetujui)
          FROM public.anggaran_tahunan_detail d
          WHERE d.anggaran_tahunan_id = ra.id
            AND d.jenis_anggaran = 'Penerimaan'
            AND d.status_item = 'ACC'
        ), 0) AS plafon_penerimaan,

        -- Realisasi total dari SEMUA LPJ yang terhubung ke RA ini (di periode filter)
        COALESCE(SUM(
          CASE WHEN ld.jenis_anggaran = 'Pengeluaran' THEN ld.jumlah * ld.harga_satuan ELSE 0 END
        ), 0) AS realisasi_pengeluaran,

        COALESCE(SUM(
          CASE WHEN ld.jenis_anggaran = 'Penerimaan' THEN ld.jumlah * ld.harga_satuan ELSE 0 END
        ), 0) AS realisasi_penerimaan,

        -- Jumlah kegiatan yang menggunakan RA ini (semua time, untuk konteks)
        (
          SELECT COUNT(DISTINCT k2.id)
          FROM public.kegiatan k2
          WHERE k2.anggaran_tahunan_id = ra.id
            AND k2.status_kegiatan NOT IN ('Draft', 'Dibatalkan')
        ) AS total_kegiatan_ra,

        -- Jumlah kegiatan yang ber-LPJ di periode ini
        COUNT(DISTINCT k.id) AS kegiatan_ber_lpj

      FROM public.kegiatan k
      JOIN public.kegiatan_lpj lh ON lh.kegiatan_id = k.id
      JOIN public.kegiatan_lpj_detail ld ON ld.kegiatan_id = k.id
      JOIN public.anggaran_tahunan ra ON ra.id = k.anggaran_tahunan_id
      JOIN public.satelit s ON s.id = k.satelit_id
      LEFT JOIN public.komisi ko ON ko.id = k.komisi_id
      WHERE ${WHERE_KEG}
        AND k.anggaran_tahunan_id IS NOT NULL
      GROUP BY ra.id, ra.kode_dokumen, ra.nama_rancangan, ra.pola_penggunaan,
               ra.kategori_ra, ra.status, s.nama_satelit, ko.nama_komisi
      ORDER BY s.nama_satelit, ra.kode_dokumen
    `, params);

    // ─── 2. Untuk setiap RA yang muncul, ambil daftar kegiatan yang ber-LPJ ───
    //        (untuk context drill-down / tooltip)
    const raIds = raListRes.rows.map((r: any) => r.ra_id);
    let kegiatanPerRa: Record<number, any[]> = {};

    if (raIds.length > 0) {
      // raIds ditambahkan ke akhir params → posisinya = params.length + 1
      const kegParams = [...params, raIds];
      const raIdxParam = kegParams.length; // index terakhir = posisi raIds

      const kegPerRaRes = await pool.query(`
        SELECT
          k.anggaran_tahunan_id AS ra_id,
          k.id                  AS kegiatan_id,
          k.kode_kegiatan,
          k.nama_kegiatan,
          k.tanggal_mulai,
          lh.status_lpj,
          COALESCE(SUM(CASE WHEN ld.jenis_anggaran = 'Pengeluaran' THEN ld.jumlah * ld.harga_satuan ELSE 0 END), 0) AS lpj_pengeluaran,
          COALESCE(SUM(CASE WHEN ld.jenis_anggaran = 'Penerimaan'  THEN ld.jumlah * ld.harga_satuan ELSE 0 END), 0) AS lpj_penerimaan
        FROM public.kegiatan k
        JOIN public.kegiatan_lpj lh ON lh.kegiatan_id = k.id
        JOIN public.kegiatan_lpj_detail ld ON ld.kegiatan_id = k.id
        WHERE ${WHERE_KEG}
          AND k.anggaran_tahunan_id = ANY($${raIdxParam})
        GROUP BY k.anggaran_tahunan_id, k.id, k.kode_kegiatan, k.nama_kegiatan, k.tanggal_mulai, lh.status_lpj
        ORDER BY k.tanggal_mulai ASC
      `, kegParams);

      kegPerRaRes.rows.forEach((r: any) => {
        const key = r.ra_id;
        if (!kegiatanPerRa[key]) kegiatanPerRa[key] = [];
        kegiatanPerRa[key].push({
          kegiatan_id:    r.kegiatan_id,
          kode_kegiatan:  r.kode_kegiatan,
          nama_kegiatan:  r.nama_kegiatan,
          tanggal_mulai:  r.tanggal_mulai,
          status_lpj:     r.status_lpj,
          lpj_pengeluaran: parseFloat(r.lpj_pengeluaran),
          lpj_penerimaan:  parseFloat(r.lpj_penerimaan),
        });
      });
    }

    // ─── 3. Grand summary ───
    let grandPlafonPen   = 0;
    let grandPlafonTer   = 0;
    let grandRealisasiPen = 0;
    let grandRealisasiTer = 0;

    const list = raListRes.rows.map((r: any) => {
      const plafonPen     = parseFloat(r.plafon_pengeluaran);
      const plafonTer     = parseFloat(r.plafon_penerimaan);
      const realisasiPen  = parseFloat(r.realisasi_pengeluaran);
      const realisasiTer  = parseFloat(r.realisasi_penerimaan);
      const serapan       = plafonPen > 0 ? Math.min(100, (realisasiPen / plafonPen) * 100) : 0;
      const selisihPen    = plafonPen - realisasiPen; // positif = sisa plafon, negatif = over budget

      grandPlafonPen    += plafonPen;
      grandPlafonTer    += plafonTer;
      grandRealisasiPen += realisasiPen;
      grandRealisasiTer += realisasiTer;

      return {
        ra_id:           r.ra_id,
        kode_dokumen:    r.kode_dokumen,
        nama_rancangan:  r.nama_rancangan,
        pola_penggunaan: r.pola_penggunaan,
        kategori_ra:     r.kategori_ra,
        status_ra:       r.status_ra,
        nama_satelit:    r.nama_satelit,
        nama_komisi:     r.nama_komisi,

        plafon_pengeluaran:   plafonPen,
        plafon_penerimaan:    plafonTer,
        realisasi_pengeluaran: realisasiPen,
        realisasi_penerimaan:  realisasiTer,

        selisih_pengeluaran: selisihPen,       // positif = efisien, negatif = over budget
        pct_serapan:         parseFloat(serapan.toFixed(1)),

        total_kegiatan_ra:   parseInt(r.total_kegiatan_ra),
        kegiatan_ber_lpj:    parseInt(r.kegiatan_ber_lpj),

        kegiatan_list: kegiatanPerRa[r.ra_id] || [],
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          grand_plafon_pengeluaran:    grandPlafonPen,
          grand_plafon_penerimaan:     grandPlafonTer,
          grand_realisasi_pengeluaran: grandRealisasiPen,
          grand_realisasi_penerimaan:  grandRealisasiTer,
          grand_selisih:               grandPlafonPen - grandRealisasiPen,
          grand_pct_serapan:           grandPlafonPen > 0
            ? parseFloat(((grandRealisasiPen / grandPlafonPen) * 100).toFixed(1))
            : 0,
          total_ra: list.length,
        },
        list,
      },
    });
  } catch (e: any) {
    console.error('[API Head-to-Head] Error:', e);
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
