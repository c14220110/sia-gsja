import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function GET(request: Request) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const satelit_id = searchParams.get('satelit_id');
    const komisi_id = searchParams.get('komisi_id');

    if (!tahun) {
      return NextResponse.json({ success: false, message: 'Tahun wajib diisi' }, { status: 400 });
    }

    let queryParams: any[] = [tahun];
    let whereClause = `WHERE a.tahun = $1 AND a.status IN ('Disetujui Penuh', 'Disetujui Sebagian', 'Selesai')`;
    let paramIdx = 2;
    
    if (satelit_id) {
      queryParams.push(satelit_id);
      whereClause += ` AND a.satelit_id = $${paramIdx++}`;
    }
    if (komisi_id === 'null') {
      whereClause += ` AND a.komisi_id IS NULL`;
    } else if (komisi_id) {
      queryParams.push(komisi_id);
      whereClause += ` AND a.komisi_id = $${paramIdx++}`;
    }

    const client = await pool.connect();
    try {
      // === QUERY 1: Fetch all approved RA headers ===
      const q = `
        SELECT 
          a.id,
          a.kode_dokumen,
          a.nama_rancangan,
          a.kategori_ra,
          a.pola_penggunaan,
          a.total_anggaran,
          a.total_disetujui,
          a.status,
          a.estimasi_waktu,
          s.nama_satelit,
          k.nama_komisi,
          d.nama_departemen,
          jk.nama_jenis_kegiatan
        FROM public.anggaran_tahunan a
        JOIN public.satelit s ON a.satelit_id = s.id
        LEFT JOIN public.komisi k ON a.komisi_id = k.id
        LEFT JOIN public.departemen d ON a.departemen_id = d.id
        LEFT JOIN public.jenis_kegiatan jk ON a.jenis_kegiatan_id = jk.id
        ${whereClause}
        ORDER BY a.kategori_ra, a.pola_penggunaan, a.nama_rancangan
      `;
      const result = await client.query(q, queryParams);

      // === QUERY 2: Fetch ALL detail items for these RA docs ===
      // This powers the slide-in panel drill-down
      const raIds = result.rows.map(r => r.id);
      let detailMap: Record<string, any[]> = {};

      if (raIds.length > 0) {
        const detailQ = `
          SELECT 
            ad.id,
            ad.anggaran_tahunan_id,
            ad.jenis_anggaran,
            ad.sumber_dana,
            ad.uraian,
            ad.deskripsi,
            ad.jumlah,
            ad.satuan,
            ad.harga_satuan,
            ad.total,
            ad.nominal_disetujui,
            ad.status_item
          FROM public.anggaran_tahunan_detail ad
          WHERE ad.anggaran_tahunan_id = ANY($1)
          ORDER BY ad.jenis_anggaran ASC, ad.created_at ASC
        `;
        const detailResult = await client.query(detailQ, [raIds]);

        // Group details by anggaran_tahunan_id
        detailResult.rows.forEach(row => {
          const parentId = row.anggaran_tahunan_id;
          if (!detailMap[parentId]) detailMap[parentId] = [];
          detailMap[parentId].push(row);
        });
      }

      // === Calculate Summaries ===
      // IMPORTANT: All financial aggregation is done at ITEM level, not header level.
      // This ensures Penerimaan items don't inflate Pengeluaran breakdown numbers.
      const summary = {
        total_pengajuan: 0,
        total_disetujui: 0,
        total_penerimaan: 0,
        total_pengeluaran: 0,
        saldo_proyeksi: 0,
        sumber_dana: {
          plafon_pusat: 0,
          kas_mandiri: 0,
        },
        kategori: {} as Record<string, { total_ra: number, total_pengeluaran: number, total_penerimaan: number }>,
        komisi: {} as Record<string, { total_ra: number, total_pengeluaran: number, total_penerimaan: number, satelit_names: string[] }>,
        pola_kegiatan: {
          single: { total_ra: 0, total_pengeluaran: 0 },
          multi: { total_ra: 0, total_pengeluaran: 0 }
        }
      };

      // Build a lookup: RA id → header row (for kategori/pola info)
      const headerMap = new Map(result.rows.map(r => [r.id, r]));

      // Header-level totals (only for display: pengajuan awal)
      result.rows.forEach(row => {
        summary.total_pengajuan += parseFloat(row.total_anggaran) || 0;
        summary.total_disetujui += parseFloat(row.total_disetujui) || 0;
      });

      // === Aggregate everything from ITEM level ===
      // This is the single source of truth for all financial numbers.
      // Track which RA IDs contribute to each kategori (for counting "X RA")
      const kategoriRaTracker: Record<string, Set<string>> = {};
      const komisiRaTracker: Record<string, Set<string>> = {};
      const polaRaTracker = { single: new Set<string>(), multi: new Set<string>() };

      Object.entries(detailMap).forEach(([raId, items]) => {
        const header = headerMap.get(raId);
        const kat = header?.kategori_ra || 'Lainnya';
        const pola = header?.pola_penggunaan;

        if (!summary.kategori[kat]) summary.kategori[kat] = { total_ra: 0, total_pengeluaran: 0, total_penerimaan: 0 };
        if (!kategoriRaTracker[kat]) kategoriRaTracker[kat] = new Set();

        // Komisi breakdown key
        const komisiKey = header?.nama_komisi || 'Anggaran Umum Satelit';
        if (!summary.komisi[komisiKey]) summary.komisi[komisiKey] = { total_ra: 0, total_pengeluaran: 0, total_penerimaan: 0, satelit_names: [] };
        if (!komisiRaTracker[komisiKey]) komisiRaTracker[komisiKey] = new Set();
        // Track which satellites contribute to this komisi key
        const satName = header?.nama_satelit || '';
        if (satName && !summary.komisi[komisiKey].satelit_names.includes(satName)) {
          summary.komisi[komisiKey].satelit_names.push(satName);
        }

        items.forEach((item: any) => {
          const nominalDisetujui = parseFloat(item.nominal_disetujui) || 0;

          if (item.jenis_anggaran === 'Penerimaan') {
            summary.total_penerimaan += nominalDisetujui;
            summary.kategori[kat].total_penerimaan += nominalDisetujui;
            summary.komisi[komisiKey].total_penerimaan += nominalDisetujui;
          } else if (item.jenis_anggaran === 'Pengeluaran') {
            summary.total_pengeluaran += nominalDisetujui;
            summary.kategori[kat].total_pengeluaran += nominalDisetujui;
            summary.komisi[komisiKey].total_pengeluaran += nominalDisetujui;

            // Track sumber dana (only for pengeluaran)
            // Maps to form options: 'Kas Mandiri' and 'Plafon Pusat'
            const sumber = (item.sumber_dana || '').toLowerCase();
            if (sumber.includes('mandiri') || sumber.includes('swadaya')) {
              summary.sumber_dana.kas_mandiri += nominalDisetujui;
            } else {
              summary.sumber_dana.plafon_pusat += nominalDisetujui;
            }

            // Track pola kegiatan (only for Kegiatan category pengeluaran)
            if (kat === 'Kegiatan') {
              if (pola === 'Sekali Pakai') {
                summary.pola_kegiatan.single.total_pengeluaran += nominalDisetujui;
                polaRaTracker.single.add(raId);
              } else {
                summary.pola_kegiatan.multi.total_pengeluaran += nominalDisetujui;
                polaRaTracker.multi.add(raId);
              }
            }
          }

          // Track unique RA per kategori & komisi
          kategoriRaTracker[kat].add(raId);
          komisiRaTracker[komisiKey].add(raId);
        });
      });

      // Fill in RA counts from tracked sets
      Object.keys(summary.kategori).forEach(kat => {
        summary.kategori[kat].total_ra = kategoriRaTracker[kat]?.size || 0;
      });
      Object.keys(summary.komisi).forEach(k => {
        summary.komisi[k].total_ra = komisiRaTracker[k]?.size || 0;
      });
      summary.pola_kegiatan.single.total_ra = polaRaTracker.single.size;
      summary.pola_kegiatan.multi.total_ra = polaRaTracker.multi.size;

      summary.saldo_proyeksi = summary.total_penerimaan - summary.total_pengeluaran;

      // === Attach detail items + per-RA penerimaan/pengeluaran split ===
      const listWithDetails = result.rows.map(row => {
        const items = detailMap[row.id] || [];
        let ra_penerimaan = 0;
        let ra_pengeluaran = 0;
        items.forEach((item: any) => {
          const val = parseFloat(item.nominal_disetujui) || 0;
          if (item.jenis_anggaran === 'Penerimaan') ra_penerimaan += val;
          else if (item.jenis_anggaran === 'Pengeluaran') ra_pengeluaran += val;
        });
        return { ...row, items, ra_penerimaan, ra_pengeluaran };
      });

      return NextResponse.json({
        success: true,
        data: {
          list: listWithDetails,
          summary
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('API Error [GET /anggaran/konsolidasi]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
