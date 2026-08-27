/**
 * Export utilities for Inventaris Barang & Stok Opname
 * Uses ExcelJS (already installed v4.4.0)
 */

const SLATE = '1e293b';
const SLATE_500 = '64748b';
const SLATE_50  = 'f8fafc';
const BLUE  = '2563eb';
const WHITE = 'ffffff';
const GREEN = '16a34a';
const RED   = 'dc2626';
const AMBER = 'd97706';
const INDIGO = '4f46e5';

const idrFmt = (n: number | null | undefined) => {
  if (n == null) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
};

const dateStr = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const fileDate = () => new Date().toISOString().split('T')[0];

// ─── Helper: trigger browser download from buffer ─────────────────────────────
function downloadBuffer(buf: ArrayBuffer, filename: string) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── EXPORT: Daftar Inventaris Barang ─────────────────────────────────────────
export async function exportInventarisToExcel(data: any[], filterLabel = 'Semua Data') {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIM GSJA';
  wb.created = new Date();

  const ws = wb.addWorksheet('Inventaris Barang', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
  });

  // Column widths: No | Kode | Nama | Kategori | Tipe | Merk | Jml | Kondisi | Status | Lokasi | Pemilik | Nilai
  [5, 22, 35, 20, 12, 18, 8, 14, 12, 22, 20, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const cell = (addr: string) => ws.getCell(addr);
  const fill = (c: any, bg: string, fc: string, bold = true, sz = 11) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    c.font  = { bold, color: { argb: fc }, size: sz, name: 'Calibri' };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = {
      top: { style: 'thin', color: { argb: 'e2e8f0' } },
      bottom: { style: 'thin', color: { argb: 'e2e8f0' } },
      left: { style: 'thin', color: { argb: 'e2e8f0' } },
      right: { style: 'thin', color: { argb: 'e2e8f0' } },
    };
  };

  // ── Title ──
  ws.mergeCells('A1:L1');
  fill(cell('A1'), SLATE, WHITE, true, 16);
  cell('A1').value = 'DAFTAR INVENTARIS BARANG — GSJA';
  ws.getRow(1).height = 36;

  ws.mergeCells('A2:L2');
  fill(cell('A2'), INDIGO, WHITE, false, 11);
  cell('A2').value = `Filter: ${filterLabel}   |   Diekspor: ${dateStr()}   |   Total: ${data.length} barang`;
  ws.getRow(2).height = 22;

  ws.addRow([]); // spacer row 3

  // ── Header row ──
  const HEADERS = ['No', 'Kode Barang', 'Nama Barang', 'Kategori', 'Tipe', 'Merk / No. Seri', 'Jml', 'Kondisi', 'Status', 'Lokasi', 'Pemilik', 'Nilai Perolehan'];
  const hRow = ws.addRow(HEADERS);
  hRow.height = 26;
  hRow.eachCell((c) => fill(c, SLATE, WHITE, true, 10));

  // ── Data rows ──
  data.forEach((item, idx) => {
    const isOdd = idx % 2 === 0;
    const rowBg = isOdd ? 'f8fafc' : 'ffffff';

    const lokasi = [item.lokasi_nama_satelit, item.lokasi_nama_sublokasi].filter(Boolean).join(' › ');
    const merk = [item.merk, item.no_seri].filter(Boolean).join(' / ') || '-';
    const tipe = item.tipe_barang === 'satuan' ? 'Aset Satuan' : 'Stok Massal';

    const row = ws.addRow([
      idx + 1,
      item.kode_barang,
      item.nama,
      item.nama_kategori || '-',
      tipe,
      merk,
      item.jumlah,
      item.kondisi,
      item.status,
      lokasi || '-',
      item.pemilik_nama || '-',
      item.nilai_perolehan || 0,
    ]);

    row.height = 20;
    row.eachCell((c, colNum) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      c.font = { name: 'Calibri', size: 10, color: { argb: SLATE } };
      c.border = {
        top: { style: 'thin', color: { argb: 'e2e8f0' } },
        bottom: { style: 'thin', color: { argb: 'e2e8f0' } },
        left: { style: 'thin', color: { argb: 'e2e8f0' } },
        right: { style: 'thin', color: { argb: 'e2e8f0' } },
      };
      c.alignment = { vertical: 'middle', wrapText: false };

      if (colNum === 1) c.alignment = { horizontal: 'center', vertical: 'middle' };
      if (colNum === 7) c.alignment = { horizontal: 'center', vertical: 'middle' };

      if (colNum === 12) {
        c.numFmt = '"Rp "#,##0';
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      }

      // Status badge color
      if (colNum === 9) {
        const color = item.status === 'Aktif' ? BLUE : item.status === 'Dipinjam' ? INDIGO : item.status === 'Disposed' ? RED : SLATE_500;
        c.font = { name: 'Calibri', size: 10, color: { argb: color }, bold: true };
      }

      // Kondisi color
      if (colNum === 8) {
        const color = item.kondisi === 'Baik' ? GREEN : item.kondisi === 'Rusak Ringan' ? AMBER : RED;
        c.font = { name: 'Calibri', size: 10, color: { argb: color }, bold: true };
      }
    });
  });

  // ── Footer ──
  ws.addRow([]);
  const footerRow = ws.addRow([`Diekspor dari SIM GSJA — ${dateStr()}`]);
  ws.mergeCells(`A${footerRow.number}:L${footerRow.number}`);
  footerRow.getCell(1).font = { name: 'Calibri', size: 9, color: { argb: SLATE_500 }, italic: true };

  const buf = await wb.xlsx.writeBuffer();
  downloadBuffer(buf, `Inventaris_GSJA_${fileDate()}.xlsx`);
}

// ─── EXPORT: Hasil Stok Opname ────────────────────────────────────────────────
export async function exportStokOpnameToExcel(sessionData: any) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIM GSJA';
  wb.created = new Date();

  const ws = wb.addWorksheet('Stok Opname', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
  });

  // Column widths: No | Kode | Nama | Kategori | Jml Sistem | Jml Fisik | Selisih | Kondisi Fisik | Keterangan | Dicek Oleh
  [5, 22, 35, 18, 12, 12, 10, 16, 30, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const cell = (addr: string) => ws.getCell(addr);
  const COLS = 10;

  const fill = (c: any, bg: string, fc: string, bold = true, sz = 11) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    c.font  = { bold, color: { argb: fc }, size: sz, name: 'Calibri' };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  };

  const rangeMerge = (start: string, end: string) => ws.mergeCells(`${start}:${end}`);

  // ── Title ──
  rangeMerge('A1', 'J1');
  fill(cell('A1'), SLATE, WHITE, true, 15);
  cell('A1').value = 'LAPORAN STOK OPNAME — GSJA';
  ws.getRow(1).height = 34;

  rangeMerge('A2', 'J2');
  fill(cell('A2'), BLUE, WHITE, false, 11);
  cell('A2').value = sessionData.judul;
  ws.getRow(2).height = 22;

  ws.addRow([]); // spacer

  // ── Session Info ──
  const addInfo = (label: string, value: string, row: number) => {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { bold: true, name: 'Calibri', size: 10, color: { argb: SLATE } };
    ws.getCell(`B${row}`).value = value;
    ws.getCell(`B${row}`).font = { name: 'Calibri', size: 10, color: { argb: SLATE } };
    ws.mergeCells(`B${row}:E${row}`);
  };

  const tanggalFmt = sessionData.tanggal
    ? new Date(sessionData.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';

  addInfo('Satelit', sessionData.nama_satelit || '-', 4);
  addInfo('Tanggal', tanggalFmt, 5);
  addInfo('Periode', sessionData.periode || '-', 6);
  addInfo('Status', sessionData.status || '-', 7);
  addInfo('Dibuat oleh', sessionData.created_by_name || '-', 8);
  addInfo('Diverifikasi oleh', sessionData.verified_by_name || '-', 9);
  addInfo('Diekspor', dateStr(), 10);

  ws.addRow([]); // spacer row 11

  // ── Summary row ──
  const detail: any[] = sessionData.detail || [];
  const totalItems = detail.length;
  const checked = detail.filter((d: any) => d.jumlah_fisik !== null).length;
  const minus = detail.filter((d: any) => d.selisih !== null && d.selisih < 0).length;
  const plus  = detail.filter((d: any) => d.selisih !== null && d.selisih > 0).length;
  const ok    = detail.filter((d: any) => d.selisih !== null && d.selisih === 0).length;

  const summaryRow = ws.addRow([`Total: ${totalItems}`, `Dicek: ${checked}`, `Sesuai: ${ok}`, `Surplus: ${plus}`, `Kurang: ${minus}`, '', '', '', '', '']);
  ws.mergeCells(`A${summaryRow.number}:B${summaryRow.number}`);
  summaryRow.eachCell((c, i) => {
    if (i <= 5) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'eff6ff' } };
      c.font = { bold: true, name: 'Calibri', size: 10, color: { argb: i === 4 ? GREEN : i === 5 ? RED : BLUE } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });
  summaryRow.height = 22;

  ws.addRow([]); // spacer

  // ── Data Header ──
  const HEADERS = ['No', 'Kode Barang', 'Nama Barang', 'Kategori', 'Jml Sistem', 'Jml Fisik', 'Selisih', 'Kondisi Fisik', 'Keterangan', 'Dicek Oleh'];
  const hRow = ws.addRow(HEADERS);
  hRow.height = 24;
  hRow.eachCell((c) => fill(c, SLATE, WHITE, true, 10));

  // ── Data rows ──
  detail.forEach((item: any, idx: number) => {
    const isOdd = idx % 2 === 0;
    const rowBg = isOdd ? 'f8fafc' : 'ffffff';
    const selisih = item.jumlah_fisik !== null ? (item.jumlah_fisik - item.jumlah_tercatat) : null;

    const row = ws.addRow([
      idx + 1,
      item.kode_barang,
      item.nama_barang,
      item.nama_kategori || '-',
      item.jumlah_tercatat,
      item.jumlah_fisik !== null ? item.jumlah_fisik : '(belum dicek)',
      selisih !== null ? selisih : '-',
      item.kondisi_fisik || '-',
      item.keterangan || '-',
      item.checked_by_name || '-',
    ]);

    row.height = 20;
    row.eachCell((c, colNum) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      c.font = { name: 'Calibri', size: 10, color: { argb: SLATE } };
      c.border = {
        top: { style: 'thin', color: { argb: 'e2e8f0' } },
        bottom: { style: 'thin', color: { argb: 'e2e8f0' } },
        left: { style: 'thin', color: { argb: 'e2e8f0' } },
        right: { style: 'thin', color: { argb: 'e2e8f0' } },
      };
      c.alignment = { vertical: 'middle' };

      if (colNum === 1 || colNum === 5 || colNum === 6 || colNum === 7) {
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Selisih color coding
      if (colNum === 7 && selisih !== null) {
        if (selisih < 0) {
          c.font = { name: 'Calibri', size: 10, color: { argb: RED }, bold: true };
          c.value = selisih; // pastikan number
        } else if (selisih > 0) {
          c.font = { name: 'Calibri', size: 10, color: { argb: GREEN }, bold: true };
          c.value = `+${selisih}`;
        } else {
          c.font = { name: 'Calibri', size: 10, color: { argb: SLATE_500 } };
        }
      }

      // Highlight baris belum dicek
      if (item.jumlah_fisik === null) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'fffbeb' } };
      }
    });
  });

  // ── Footer ──
  ws.addRow([]);
  const foot = ws.addRow([`Laporan dihasilkan dari SIM GSJA — ${dateStr()}`]);
  ws.mergeCells(`A${foot.number}:J${foot.number}`);
  foot.getCell(1).font = { name: 'Calibri', size: 9, color: { argb: SLATE_500 }, italic: true };

  const buf = await wb.xlsx.writeBuffer();
  const safeName = (sessionData.judul || 'StokOpname').replace(/[^a-zA-Z0-9]/g, '_');
  downloadBuffer(buf, `StokOpname_${safeName}_${fileDate()}.xlsx`);
}
