/**
 * Export utility untuk Realisasi Kegiatan (LPJ)
 * Tab 1 — Rekapitulasi LPJ: Summary per Satelit + per COA
 * Tab 2 — Detail COA per LPJ: Setiap baris transaksi dikelompokkan per kegiatan
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const MONTHS = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export async function exportRealisasiToExcel(
  data: any,
  tahun: string,
  bulan: string,
  satelitName: string,
) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIM GSJA Eben Haezer';
  wb.created = new Date();

  // ── Palette (mirip exportAnggaran tapi pakai aksen rose/merah untuk LPJ) ──
  const ROSE       = 'e11d48';   // rose-600 — warna aksen LPJ
  const SLATE_800  = '1e293b';
  const SLATE_50   = 'f8fafc';
  const BLUE       = '2563eb';
  const WHITE      = 'ffffff';
  const EMERALD    = '059669';

  const periodLabel = bulan
    ? `${MONTHS[parseInt(bulan)] || bulan} ${tahun}`
    : `Tahun ${tahun}`;
  const filterLabel = satelitName
    ? `${periodLabel} — ${satelitName}`
    : `${periodLabel} — Konsolidasi Seluruh Satelit`;

  // helper: isi cell dengan background + font
  const fill = (cell: any, bg: string, fc: string, bold = true, sz = 11) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { bold, color: { argb: fc }, size: sz, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', wrapText: true };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1 — REKAPITULASI LPJ
  // ═══════════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('Rekapitulasi LPJ', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  // Lebar kolom: [No, Deskripsi, Komisi, Satelit, COA/Kode, Penerimaan, Pengeluaran, Kegiatan]
  [5, 40, 22, 22, 18, 22, 22, 12].forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

  // ── Judul ──
  ws1.mergeCells('A1:H1');
  const t1 = ws1.getCell('A1');
  t1.value = 'REKAPITULASI LPJ KEGIATAN';
  fill(t1, ROSE, WHITE, true, 16);
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 35;

  ws1.mergeCells('A2:H2');
  const t2 = ws1.getCell('A2');
  t2.value = filterLabel;
  fill(t2, ROSE, WHITE, false, 11);
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 22;

  ws1.addRow([]); // row 3 spacer

  // ── Summary KPI ──
  const s = data.summary;
  const addSummaryRow = (label: string, value: number | string, color?: string) => {
    const isNum = typeof value === 'number';
    const row = ws1.addRow(['', label, '', isNum ? value : '', isNum ? '' : value]);
    row.getCell(2).font = { bold: true, size: 10, name: 'Calibri', color: { argb: SLATE_800 } };
    if (isNum) {
      row.getCell(4).numFmt = '"Rp "#,##0';
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: color || SLATE_800 } };
    } else {
      row.getCell(5).font = { bold: true, size: 10, name: 'Calibri', color: { argb: color || EMERALD } };
    }
  };

  addSummaryRow('Total Penerimaan LPJ', s.total_penerimaan, BLUE);
  addSummaryRow('Total Pengeluaran LPJ', s.total_pengeluaran);
  addSummaryRow('Selisih (Saldo)', s.saldo, s.saldo >= 0 ? EMERALD : 'dc2626');
  addSummaryRow('Jumlah LPJ Diproses', s.total_lpj);
  addSummaryRow('Jumlah Kegiatan', s.total_kegiatan);

  const efisiensi = s.total_penerimaan > 0
    ? `${((s.total_pengeluaran / s.total_penerimaan) * 100).toFixed(0)}% dari Penerimaan`
    : '-';
  addSummaryRow('Rasio Pengeluaran', efisiensi, EMERALD);

  ws1.addRow([]);

  // ── Breakdown per Satelit ──
  const satHeader = ws1.addRow(['', 'BREAKDOWN PER SATELIT', '', 'Penerimaan', 'Pengeluaran', '', 'Kegiatan']);
  [2, 3, 4, 5, 6, 7].forEach(c => fill(satHeader.getCell(c), SLATE_800, WHITE, true, 10));
  satHeader.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
  satHeader.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
  satHeader.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

  (data.by_satelit as any[]).forEach((r: any) => {
    const row = ws1.addRow(['', `  ${r.nama_satelit}`, '', r.total_penerimaan, r.total_pengeluaran, '', r.jumlah_kegiatan]);
    row.getCell(4).numFmt = '"Rp "#,##0'; row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: BLUE } };
    row.getCell(5).numFmt = '"Rp "#,##0'; row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(5).font = { bold: true, size: 10, name: 'Calibri' };
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(7).font = { size: 10, name: 'Calibri' };
  });

  ws1.addRow([]);

  // ── Breakdown per Komisi ──
  const komHeader = ws1.addRow(['', 'BREAKDOWN PER KOMISI', '', 'Penerimaan', 'Pengeluaran', 'Satelit', 'Kegiatan']);
  [2, 3, 4, 5, 6, 7].forEach(c => fill(komHeader.getCell(c), SLATE_800, WHITE, true, 10));
  komHeader.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
  komHeader.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };

  (data.by_komisi as any[]).forEach((r: any) => {
    const row = ws1.addRow(['', `  ${r.nama_komisi}`, '', r.total_penerimaan || '', r.total_pengeluaran, r.nama_satelit, r.jumlah_kegiatan]);
    if (r.total_penerimaan > 0) {
      row.getCell(4).numFmt = '"Rp "#,##0'; row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: BLUE } };
    }
    row.getCell(5).numFmt = '"Rp "#,##0'; row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(5).font = { bold: true, size: 10, name: 'Calibri' };
    row.getCell(6).font = { size: 9, name: 'Calibri', color: { argb: '64748b' } };
    row.getCell(7).alignment = { horizontal: 'center' };
  });

  ws1.addRow([]);

  // ── Breakdown per COA ──
  const coaHeader = ws1.addRow(['No', 'Nama Akun COA', 'Kode Akun', 'Jenis', '', 'Total Realisasi', '', 'Kegiatan']);
  [1, 2, 3, 4, 5, 6, 7, 8].forEach(c => fill(coaHeader.getCell(c), SLATE_800, WHITE, true, 10));
  coaHeader.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

  (data.by_coa as any[]).forEach((r: any, i: number) => {
    const row = ws1.addRow([
      i + 1,
      r.nama_akun,
      r.kode_akun,
      r.jenis_anggaran,
      '',
      r.total_realisasi,
      '',
      r.jumlah_kegiatan,
    ]);
    if (i % 2 === 0) {
      [1, 2, 3, 4, 5, 6, 7, 8].forEach(c => {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
      });
    }
    row.getCell(6).numFmt = '"Rp "#,##0';
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(6).font = { bold: true, size: 10, name: 'Calibri', color: { argb: r.jenis_anggaran === 'Penerimaan' ? BLUE : SLATE_800 } };
    row.getCell(4).font = { bold: true, size: 9, name: 'Calibri', color: { argb: r.jenis_anggaran === 'Penerimaan' ? BLUE : ROSE } };
    [1, 2, 3, 4, 5, 6, 7, 8].forEach(c => {
      row.getCell(c).border = { bottom: { style: 'hair', color: { argb: 'e2e8f0' } } };
    });
  });

  ws1.addRow([]);

  // ── Grand Total ──
  const gtRow = ws1.addRow(['', '', 'GRAND TOTAL', '', '', s.total_penerimaan, s.total_pengeluaran, '']);
  [1, 2, 3, 4, 5, 6, 7, 8].forEach(c => fill(gtRow.getCell(c), SLATE_800, WHITE, true, 11));
  gtRow.getCell(6).numFmt = '"Rp "#,##0'; gtRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  gtRow.getCell(7).numFmt = '"Rp "#,##0'; gtRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
  gtRow.getCell(6).font = { bold: true, size: 11, name: 'Calibri', color: { argb: BLUE } };
  gtRow.height = 25;

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2 — DETAIL COA PER LPJ KEGIATAN
  // Mirip "Rincian Item per RA" — dikelompokkan per kegiatan, lalu baris-baris detail COA
  // ═══════════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('Detail COA per LPJ', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  // Kolom: [Tanggal, Kegiatan, Satelit/Komisi, Kode COA, Nama Akun, Jenis, Jumlah, Satuan, Harga Satuan, Total, Status LPJ]
  [12, 34, 22, 12, 28, 14, 10, 10, 18, 18, 16].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

  // Header sub-judul Sheet 2
  const s2title = ws2.addRow(['DETAIL COA PER LPJ KEGIATAN']);
  ws2.mergeCells(s2title.number, 1, s2title.number, 11);
  fill(s2title.getCell(1), ROSE, WHITE, true, 14);
  s2title.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  s2title.height = 30;

  const s2sub = ws2.addRow([filterLabel]);
  ws2.mergeCells(s2sub.number, 1, s2sub.number, 11);
  fill(s2sub.getCell(1), ROSE, WHITE, false, 10);
  s2sub.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  s2sub.height = 18;

  ws2.addRow([]);

  // ── Group detail rows by kegiatan_id ──
  const byKegiatan: Record<string, any[]> = {};
  const kegiatanMeta: Record<string, { nama: string; kode: string; satelit: string; komisi: string; tanggal: string; status_lpj: string }> = {};

  (data.detail as any[]).forEach((r: any) => {
    const key = String(r.kegiatan_id);
    if (!byKegiatan[key]) {
      byKegiatan[key] = [];
      kegiatanMeta[key] = {
        nama: r.nama_kegiatan,
        kode: r.kode_kegiatan,
        satelit: r.nama_satelit,
        komisi: r.nama_komisi,
        tanggal: r.tanggal_mulai,
        status_lpj: r.status_lpj,
      };
    }
    byKegiatan[key].push(r);
  });

  // ── Iterate per kegiatan ──
  Object.entries(byKegiatan).forEach(([kegId, rows]) => {
    const meta = kegiatanMeta[kegId];
    const tgl = new Date(meta.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

    // Row header kegiatan (mirip baris RA di sheet 2 anggaran)
    const kegRow = ws2.addRow([
      tgl,
      meta.nama,
      `${meta.satelit} / ${meta.komisi}`,
      '', '', '', '', '', '', '',
      meta.status_lpj,
    ]);
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach(c => fill(kegRow.getCell(c), SLATE_800, WHITE, true, 10));
    // Warnai status LPJ
    const statusColor = meta.status_lpj === 'Disetujui' ? EMERALD : 'f59e0b';
    kegRow.getCell(11).font = { bold: true, size: 10, name: 'Calibri', color: { argb: statusColor } };
    kegRow.height = 22;
    // Sub-info kode kegiatan
    kegRow.getCell(2).note = meta.kode;

    // Sub-header kolom detail (mirip baris "Jenis | Uraian | ..." di sheet 2 anggaran)
    const ih = ws2.addRow(['Tanggal', 'Kegiatan', 'Satelit / Komisi', 'Kode COA', 'Nama Akun', 'Jenis', 'Jumlah', 'Satuan', 'Harga Satuan', 'Total', 'Status LPJ']);
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach(c => {
      ih.getCell(c).font = { bold: true, size: 9, name: 'Calibri', color: { argb: '64748b' } };
      ih.getCell(c).border = { bottom: { style: 'thin', color: { argb: '94a3b8' } } };
    });

    let kegPen = 0; let kegKel = 0;

    rows.forEach((r: any) => {
      const total = r.total || (r.jumlah * r.harga_satuan);
      if (r.jenis_anggaran === 'Penerimaan') kegPen += total;
      else kegKel += total;

      const row = ws2.addRow([
        tgl,
        r.nama_kegiatan,
        `${r.nama_satelit} / ${r.nama_komisi}`,
        r.kode_akun,
        r.nama_akun,
        r.jenis_anggaran,
        r.jumlah,
        r.satuan || '-',
        parseFloat(r.harga_satuan) || 0,
        total,
        r.status_lpj,
      ]);

      row.getCell(9).numFmt = '"Rp "#,##0'; row.getCell(9).alignment = { horizontal: 'right' };
      row.getCell(10).numFmt = '"Rp "#,##0'; row.getCell(10).alignment = { horizontal: 'right' };
      row.getCell(10).font = { bold: true, size: 10, name: 'Calibri' };
      // Warnai Jenis
      row.getCell(6).font = {
        bold: true, size: 9, name: 'Calibri',
        color: { argb: r.jenis_anggaran === 'Penerimaan' ? BLUE : ROSE },
      };
      row.getCell(4).font = { bold: true, size: 9, name: 'Calibri', color: { argb: '6366f1' } }; // indigo untuk kode COA
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach(c => {
        row.getCell(c).border = { bottom: { style: 'hair', color: { argb: 'e2e8f0' } } };
      });
    });

    // Sub-total per kegiatan (mirip "Sub-total RA-XX-XXX" di anggaran)
    const subRow = ws2.addRow(['', `Sub-total: ${meta.nama}`, '', '', '', '', '', '', '', kegKel > 0 ? kegKel : '', '']);
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach(c => {
      subRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'e2e8f0' } };
      subRow.getCell(c).font = { bold: true, size: 9, name: 'Calibri' };
    });
    if (kegPen > 0) {
      // tampilkan penerimaan di kolom 9 (harga_satuan — karena kolom 10 = total pengeluaran)
      subRow.getCell(9).value = kegPen;
      subRow.getCell(9).numFmt = '"Rp "#,##0'; subRow.getCell(9).alignment = { horizontal: 'right' };
      subRow.getCell(9).font = { bold: true, size: 9, name: 'Calibri', color: { argb: BLUE } };
      subRow.getCell(9).note = 'Total Penerimaan';
    }
    if (kegKel > 0) {
      subRow.getCell(10).numFmt = '"Rp "#,##0'; subRow.getCell(10).alignment = { horizontal: 'right' };
      subRow.getCell(10).font = { bold: true, size: 9, name: 'Calibri', color: { argb: SLATE_800 } };
    }

    ws2.addRow([]);
  });

  // Grand Total Sheet 2
  const gt2 = ws2.addRow(['', 'GRAND TOTAL', '', '', '', '', '', '', s.total_penerimaan, s.total_pengeluaran, '']);
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach(c => fill(gt2.getCell(c), SLATE_800, WHITE, true, 11));
  gt2.getCell(9).numFmt = '"Rp "#,##0'; gt2.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
  gt2.getCell(10).numFmt = '"Rp "#,##0'; gt2.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
  gt2.getCell(9).font = { bold: true, size: 11, name: 'Calibri', color: { argb: BLUE } };
  gt2.height = 25;

  // ── Generate & Download ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `Realisasi_LPJ_${tahun}${bulan ? `_Bln${bulan}` : ''}.xlsx`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
