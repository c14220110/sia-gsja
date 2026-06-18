/**
 * Export utilities for Rekapitulasi Anggaran
 * Supports Excel (.xlsx) via ExcelJS and PDF via jsPDF
 */

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

/** Only show pola for Kegiatan; others it's implicit */
const formatKategori = (r: any) => {
  if (r.kategori_ra === 'Kegiatan') {
    const pola = r.pola_penggunaan === 'Sekali Pakai' ? 'Single Event' : 
                 r.pola_penggunaan === 'Bertahap' ? 'Multi-Event' : 
                 r.pola_penggunaan;
    return `${r.kategori_ra} / ${pola}`;
  }
  return r.kategori_ra;
};

// ─── EXCEL EXPORT ──────────────────────────────────────────────────────────────
export async function exportToExcel(data: any, tahun: string, satelitName: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIM GSJA Eben Haezer';
  wb.created = new Date();

  const ws = wb.addWorksheet('Rekapitulasi Anggaran', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
  });

  // ── Colors ──
  const EMERALD = '059669';
  const SLATE_800 = '1e293b';
  const SLATE_50 = 'f8fafc';
  const BLUE = '2563eb';
  const AMBER = 'd97706';
  const WHITE = 'ffffff';
  const RED = 'dc2626';

  const fill = (cell: any, bg: string, fc: string, bold = true, sz = 11) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { bold, color: { argb: fc }, size: sz, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', wrapText: true };
  };

  // ── Column widths ──
  [5, 20, 40, 22, 22, 22, 22, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── TITLE ──
  ws.mergeCells('A1:H1');
  const t1 = ws.getCell('A1');
  t1.value = 'REKAPITULASI ANGGARAN';
  fill(t1, EMERALD, WHITE, true, 16);
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 35;

  ws.mergeCells('A2:H2');
  const t2 = ws.getCell('A2');
  t2.value = `Tahun Anggaran ${tahun} — ${satelitName || 'Konsolidasi Seluruh Satelit'}`;
  fill(t2, EMERALD, WHITE, false, 11);
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  // ── SUMMARY (as real numbers, not strings) ──
  const s = data.summary;
  ws.addRow([]); // row 3 spacer

  const addSummaryRow = (label: string, value: number, color?: string) => {
    const row = ws.addRow(['', label, '', value]);
    row.getCell(2).font = { bold: true, size: 10, name: 'Calibri', color: { argb: SLATE_800 } };
    row.getCell(4).numFmt = '"Rp "#,##0';
    row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: color || SLATE_800 } };
  };

  addSummaryRow('Proyeksi Penerimaan', s.total_penerimaan, BLUE);
  addSummaryRow('Total Pengeluaran (Disetujui)', s.total_pengeluaran);
  addSummaryRow('Pengajuan Awal', s.total_pengajuan);
  addSummaryRow('Proyeksi Saldo', s.saldo_proyeksi, s.saldo_proyeksi >= 0 ? EMERALD : RED);

  // Efisiensi as text
  const effRow = ws.addRow(['', 'Efisiensi Anggaran', '', s.total_penerimaan > 0 ? `${((s.total_pengeluaran / s.total_penerimaan) * 100).toFixed(0)}% dari Penerimaan` : '-']);
  effRow.getCell(2).font = { bold: true, size: 10, name: 'Calibri', color: { argb: SLATE_800 } };
  effRow.getCell(4).font = { bold: true, size: 10, name: 'Calibri', color: { argb: EMERALD } };
  effRow.getCell(4).alignment = { horizontal: 'right' };

  ws.addRow([]);

  // ── SUMBER DANA ──
  const sdHeader = ws.addRow(['', 'PROPORSI SUMBER DANA (PENGELUARAN)']);
  fill(sdHeader.getCell(2), SLATE_800, WHITE, true, 10);
  ws.mergeCells(sdHeader.number, 2, sdHeader.number, 4);

  const addDanaRow = (label: string, value: number) => {
    const row = ws.addRow(['', `  ${label}`, '', value]);
    row.getCell(4).numFmt = '"Rp "#,##0';
    row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(4).font = { bold: true, size: 10, name: 'Calibri' };
  };
  addDanaRow('Plafon Pusat (Kas Gereja)', s.sumber_dana.plafon_pusat);
  addDanaRow('Kas Mandiri (Swadaya)', s.sumber_dana.kas_mandiri);

  ws.addRow([]);

  // ── BREAKDOWN KATEGORI ──
  const katHeader = ws.addRow(['', 'BREAKDOWN KATEGORI PENGELUARAN', '', 'Pengeluaran', 'Penerimaan', 'Jumlah RA']);
  [2, 3, 4, 5, 6].forEach(c => fill(katHeader.getCell(c), SLATE_800, WHITE, true, 10));
  katHeader.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
  katHeader.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
  katHeader.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

  Object.entries(s.kategori).forEach(([kat, val]: [string, any]) => {
    const row = ws.addRow(['', `  ${kat}`, '', val.total_pengeluaran, val.total_penerimaan > 0 ? val.total_penerimaan : '', `${val.total_ra} RA`]);
    row.getCell(4).numFmt = '"Rp "#,##0';
    row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(4).font = { bold: true, size: 10, name: 'Calibri' };
    if (val.total_penerimaan > 0) {
      row.getCell(5).numFmt = '"Rp "#,##0';
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(5).font = { size: 10, name: 'Calibri', color: { argb: BLUE } };
    }
    row.getCell(6).alignment = { horizontal: 'center' };
  });

  // ── DETAIL TABLE — Grouped by Satelit ──
  ws.addRow([]);
  ws.addRow([]);
  const headers = ['No', 'Kode RA', 'Nama Rancangan', 'Komisi/Unit', 'Kategori', 'Penerimaan', 'Pengeluaran', 'Status'];
  const hRow = ws.addRow(headers);
  hRow.height = 25;
  headers.forEach((_, i) => {
    const cell = hRow.getCell(i + 1);
    fill(cell, SLATE_800, WHITE, true, 10);
    cell.alignment = { horizontal: i >= 5 && i <= 6 ? 'right' : 'left', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: '94a3b8' } } };
  });

  // Group list by satelit
  const bySatelit: Record<string, any[]> = {};
  data.list.forEach((r: any) => {
    const key = r.nama_satelit || 'Lainnya';
    if (!bySatelit[key]) bySatelit[key] = [];
    bySatelit[key].push(r);
  });

  let rowNum = 0;
  Object.entries(bySatelit).forEach(([satName, rows]) => {
    // Satelit sub-header
    const satRow = ws.addRow(['', `── SATELIT ${satName.toUpperCase()} ──`]);
    ws.mergeCells(satRow.number, 2, satRow.number, 8);
    satRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'e2e8f0' } };
    satRow.getCell(2).font = { bold: true, size: 9, name: 'Calibri', color: { argb: '475569' } };

    let satPen = 0; let satKel = 0;
    rows.forEach((r: any) => {
      rowNum++;
      const pen = r.ra_penerimaan || 0;
      const kel = r.ra_pengeluaran || 0;
      satPen += pen; satKel += kel;
      const row = ws.addRow([rowNum, r.kode_dokumen, r.nama_rancangan,
        r.nama_komisi || 'Umum Satelit', formatKategori(r),
        pen > 0 ? pen : '', kel > 0 ? kel : '', r.status]);

      if (pen > 0) { row.getCell(6).numFmt = '"Rp "#,##0'; row.getCell(6).alignment = { horizontal: 'right' }; }
      if (kel > 0) { row.getCell(7).numFmt = '"Rp "#,##0'; row.getCell(7).alignment = { horizontal: 'right' }; }
      if (rowNum % 2 === 0) [1,2,3,4,5,6,7,8].forEach(c => {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_50 } };
      });
      row.getCell(8).font = { bold: true, size: 9, name: 'Calibri', color: { argb: r.status.includes('Penuh') || r.status === 'Selesai' ? EMERALD : AMBER } };
      [1,2,3,4,5,6,7,8].forEach(c => { row.getCell(c).border = { bottom: { style: 'hair', color: { argb: 'e2e8f0' } } }; });
    });

    // Sub-total per satelit
    const subRow = ws.addRow(['', '', `Sub-total ${satName}`, '', '', satPen, satKel, '']);
    [1,2,3,4,5,6,7,8].forEach(c => {
      subRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };
      subRow.getCell(c).font = { bold: true, size: 9, name: 'Calibri', color: { argb: WHITE } };
    });
    if (satPen > 0) { subRow.getCell(6).numFmt = '"Rp "#,##0'; subRow.getCell(6).alignment = { horizontal: 'right' }; subRow.getCell(6).font = { bold: true, size: 9, name: 'Calibri', color: { argb: '93c5fd' } }; }
    if (satKel > 0) { subRow.getCell(7).numFmt = '"Rp "#,##0'; subRow.getCell(7).alignment = { horizontal: 'right' }; }
    ws.addRow([]);
  });

  // Total Semuanya Kumpul
  const totalRow = ws.addRow(['', '', 'GRAND TOTAL', '', '', s.total_penerimaan, s.total_pengeluaran, '']);
  [1,2,3,4,5,6,7,8].forEach(c => fill(totalRow.getCell(c), SLATE_800, WHITE, true, 11));
  totalRow.getCell(6).numFmt = '"Rp "#,##0'; totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(7).numFmt = '"Rp "#,##0'; totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(6).font = { bold: true, size: 11, name: 'Calibri', color: { argb: BLUE } };
  totalRow.height = 25;

  // ── Sheet 2: Rincian Item per RA — grouped by satelit ──
  const ws2 = wb.addWorksheet('Rincian Item per RA');
  [18, 35, 14, 14, 10, 18, 20, 14].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

  Object.entries(bySatelit).forEach(([satName, rows]) => {
    // Satelit separator
    const satHeaderRow = ws2.addRow([`── SATELIT ${satName.toUpperCase()} ──`]);
    ws2.mergeCells(satHeaderRow.number, 1, satHeaderRow.number, 8);
    [1,2,3,4,5,6,7,8].forEach(c => fill(satHeaderRow.getCell(c), '334155', WHITE, true, 10));

    rows.forEach((r: any) => {
      if (!r.items || r.items.length === 0) return;
      const raRow = ws2.addRow([r.kode_dokumen, r.nama_rancangan, r.nama_komisi || 'Umum Satelit', '', '', '', '', r.status]);
      [1,2,3,4,5,6,7,8].forEach(c => fill(raRow.getCell(c), SLATE_800, WHITE, true, 10));

      const ih = ws2.addRow(['Jenis', 'Uraian', 'Sumber Dana', 'Jumlah', 'Satuan', 'Harga Satuan', 'Nominal Disetujui', 'Status']);
      [1,2,3,4,5,6,7,8].forEach(c => {
        ih.getCell(c).font = { bold: true, size: 9, name: 'Calibri', color: { argb: '64748b' } };
        ih.getCell(c).border = { bottom: { style: 'thin', color: { argb: '94a3b8' } } };
      });

      let raPen = 0; let raKel = 0;
      r.items.forEach((item: any) => {
        const nom = parseFloat(item.nominal_disetujui) || 0;
        if (item.jenis_anggaran === 'Penerimaan') raPen += nom;
        else raKel += nom;
        const row = ws2.addRow([
          item.jenis_anggaran, item.uraian, item.sumber_dana || '-',
          item.jumlah, item.satuan || '-',
          parseFloat(item.harga_satuan) || 0, nom,
          item.status_item === 'ACC' ? 'Disetujui' : item.status_item
        ]);
        row.getCell(6).numFmt = '"Rp "#,##0'; row.getCell(6).alignment = { horizontal: 'right' };
        row.getCell(7).numFmt = '"Rp "#,##0'; row.getCell(7).alignment = { horizontal: 'right' };
        row.getCell(1).font = { bold: true, size: 9, name: 'Calibri', color: { argb: item.jenis_anggaran === 'Penerimaan' ? BLUE : RED } };
      });

      // Sub-total per RA
      const raTotalRow = ws2.addRow(['', `Sub-total ${r.kode_dokumen}`, '', '', '', raPen > 0 ? raPen : '', raKel > 0 ? raKel : '', '']);
      [1,2,3,4,5,6,7,8].forEach(c => {
        raTotalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'e2e8f0' } };
        raTotalRow.getCell(c).font = { bold: true, size: 9, name: 'Calibri' };
      });
      if (raPen > 0) { raTotalRow.getCell(6).numFmt = '"Rp "#,##0'; raTotalRow.getCell(6).alignment = { horizontal: 'right' }; raTotalRow.getCell(6).font = { bold: true, size: 9, name: 'Calibri', color: { argb: BLUE } }; }
      if (raKel > 0) { raTotalRow.getCell(7).numFmt = '"Rp "#,##0'; raTotalRow.getCell(7).alignment = { horizontal: 'right' }; }
      ws2.addRow([]);
    });
    ws2.addRow([]);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `Rekapitulasi_Anggaran_${tahun}.xlsx`);
}

// ─── PDF EXPORT ────────────────────────────────────────────────────────────────
export async function exportToPDF(data: any, tahun: string, satelitName: string) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const s = data.summary;
  const pw = doc.internal.pageSize.getWidth();

  // ── Title Banner ──
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REKAPITULASI ANGGARAN', pw / 2, 10, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tahun ${tahun} — ${satelitName || 'Konsolidasi Seluruh Satelit'}`, pw / 2, 17, { align: 'center' });

  // ── Summary 2×2 Boxes ──
  const boxW = 65; const boxH = 16; const boxGap = 4; const boxStartX = 14; const boxStartY = 28;
  const efisiensi = s.total_penerimaan > 0 ? ((s.total_pengeluaran / s.total_penerimaan) * 100).toFixed(0) : '0';

  const boxes = [
    { label: 'Proyeksi Penerimaan', value: fmt(s.total_penerimaan), color: [37, 99, 235] as [number, number, number] },
    { label: 'Total Pengeluaran (Disetujui)', value: `${fmt(s.total_pengeluaran)}  (${efisiensi}%)`, color: [217, 119, 6] as [number, number, number] },
    { label: 'Proyeksi Saldo', value: fmt(s.saldo_proyeksi), color: s.saldo_proyeksi >= 0 ? [5, 150, 105] as [number, number, number] : [220, 38, 38] as [number, number, number] },
    { label: 'Pengajuan Awal', value: fmt(s.total_pengajuan), color: [100, 116, 139] as [number, number, number] },
  ];

  boxes.forEach((box, i) => {
    const col = i % 2; const row = Math.floor(i / 2);
    const x = boxStartX + col * (boxW + boxGap);
    const y = boxStartY + row * (boxH + boxGap);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(box.label, x + 3, y + 5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(box.color[0], box.color[1], box.color[2]);
    doc.text(box.value, x + 3, y + 12);
  });

  // ── Breakdown Kategori + Sumber Dana (right side of boxes) ──
  const infoX = boxStartX + 2 * (boxW + boxGap) + 6;
  let infoY = boxStartY;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Breakdown Kategori Pengeluaran', infoX, infoY);
  infoY += 5;

  Object.entries(s.kategori).forEach(([kat, val]: [string, any]) => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(kat, infoX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(fmt(val.total_pengeluaran), infoX + 40, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`(${val.total_ra} RA)`, infoX + 75, infoY);
    if (val.total_penerimaan > 0) {
      infoY += 3.5;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(37, 99, 235);
      doc.text(`  Penerimaan: ${fmt(val.total_penerimaan)}`, infoX, infoY);
    }
    infoY += 4;
  });

  infoY += 3;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Proporsi Sumber Dana', infoX, infoY);
  infoY += 5;

  [['Plafon Pusat (Kas Gereja)', s.sumber_dana.plafon_pusat], ['Kas Mandiri (Swadaya)', s.sumber_dana.kas_mandiri]].forEach(([label, val]) => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(label as string, infoX, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(fmt(val as number), infoX + 40, infoY);
    infoY += 4;
  });

  // ── Separator ──
  const tableStartY = boxStartY + 2 * (boxH + boxGap) + 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, tableStartY, pw - 14, tableStartY);

  // ── Table — Grouped by Satelit ──
  // Bangun bodi ama judul anakan sub-satelitnya, barisan datanya jg row totalan anakannya
  const bySatelit: Record<string, any[]> = {};
  data.list.forEach((r: any) => {
    const key = r.nama_satelit || 'Lainnya';
    if (!bySatelit[key]) bySatelit[key] = [];
    bySatelit[key].push(r);
  });

  const tableData: any[] = [];
  const subHeaderIndices: number[] = [];
  const subTotalIndices: number[] = [];
  const grandTotalIndex: number[] = [];

  Object.entries(bySatelit).forEach(([satName, rows]) => {
    subHeaderIndices.push(tableData.length);
    tableData.push([{ content: `SATELIT ${satName.toUpperCase()}`, colSpan: 8 }]);

    let satPen = 0; let satKel = 0;
    let rowIdx = tableData.length;
    rows.forEach((r: any, i: number) => {
      const pen = r.ra_penerimaan || 0;
      const kel = r.ra_pengeluaran || 0;
      satPen += pen; satKel += kel;
      tableData.push([
        rowIdx + i,
        r.kode_dokumen,
        r.nama_rancangan,
        r.nama_komisi || 'Umum',
        formatKategori(r),
        pen > 0 ? fmt(pen) : '—',
        kel > 0 ? fmt(kel) : '—',
        r.status,
      ]);
    });

    subTotalIndices.push(tableData.length);
    tableData.push(['', '', `Sub-total ${satName}`, '', '', fmt(satPen), fmt(satKel), '']);
  });

  grandTotalIndex.push(tableData.length);
  tableData.push(['', '', 'GRAND TOTAL', '', '',
    fmt(s.total_penerimaan), fmt(s.total_pengeluaran),
    `${s.total_penerimaan > 0 ? ((s.total_pengeluaran / s.total_penerimaan) * 100).toFixed(0) : 0}%`
  ]);

  autoTable(doc, {
    startY: tableStartY + 3,
    head: [['#', 'Kode RA', 'Nama Rancangan', 'Komisi/Unit', 'Kategori', 'Penerimaan', 'Pengeluaran', 'Status']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 7.5, font: 'helvetica', cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 24 },
      2: { cellWidth: 52 },
      3: { cellWidth: 24 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30, halign: 'right' },
      6: { cellWidth: 30, halign: 'right' },
      7: { cellWidth: 26 },
    },
    didParseCell: (hookData: any) => {
      const i = hookData.row.index;
      if (hookData.section !== 'body') return;

      if (subHeaderIndices.includes(i)) {
        hookData.cell.styles.fillColor = [51, 65, 85];
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fontSize = 8;
      } else if (subTotalIndices.includes(i)) {
        hookData.cell.styles.fillColor = [71, 85, 105];
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = 'bold';
        if (hookData.column.index === 5) hookData.cell.styles.textColor = [147, 197, 253];
      } else if (grandTotalIndex.includes(i)) {
        hookData.cell.styles.fillColor = [30, 41, 59];
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = 'bold';
        if (hookData.column.index === 5) hookData.cell.styles.textColor = [147, 197, 253];
      } else if (hookData.column.index === 7) {
        const val = String(hookData.cell.raw || '');
        if (val.includes('Sebagian')) {
          hookData.cell.styles.fontStyle = 'bolditalic';
          hookData.cell.styles.textColor = [217, 119, 6];
        } else if (val.includes('Penuh') || val === 'Selesai') {
          hookData.cell.styles.textColor = [5, 150, 105];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer on all pages ──
  const pc = doc.getNumberOfPages();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`SIM GSJA Eben Haezer — Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, ph - 8);
    doc.text(`Halaman ${i} dari ${pc}`, pw - 14, ph - 8, { align: 'right' });
  }

  doc.save(`Rekapitulasi_Anggaran_${tahun}.pdf`);
}

// ─── Helper ────────────────────────────────────────────────────────────────────
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
