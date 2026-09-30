import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import ExcelJS from 'exceljs';

// Excel sheet names cannot contain: * ? : \ / [ ]  and must be ≤ 31 chars
function sanitizeSheetName(name: string): string {
  return name
    .replace(/[*?:\\/\[\]]/g, '-')  // replace forbidden chars with dash
    .replace(/\s*-\s*/g, ' - ')      // normalize " / " → " - " spacing
    .replace(/\s+/g, ' ')            // collapse multiple spaces
    .trim()
    .slice(0, 31);                   // max 31 characters
}

// GET /api/inventaris/import-template?satelit_id=12
// Returns an .xlsx file with one sheet per sublokasi, pre-validated dropdowns
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const satelitId = searchParams.get('satelit_id');

  if (!satelitId) {
    return NextResponse.json({ success: false, message: 'satelit_id required' }, { status: 400 });
  }

  try {
    // Fetch sublokasi for this satellite
    const sublokasiRes = await pool.query(
      `SELECT ms.id, ms.kode, ms.nama
       FROM master_sublokasi ms
       WHERE ms.satelit_id = $1 AND ms.is_active = true
       ORDER BY ms.kode`,
      [satelitId]
    );

    // Guard: satellite must have sublokasi configured
    if (sublokasiRes.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Satelit ini belum memiliki data sublokasi/ruangan. Hubungi admin untuk menambahkan master sublokasi terlebih dahulu.'
      }, { status: 400 });
    }

    // Fetch satellite name
    const satelitRes = await pool.query(
      'SELECT nama_satelit FROM satelit WHERE id = $1',
      [satelitId]
    );
    if (!satelitRes.rows[0]) {
      return NextResponse.json({ success: false, message: 'Satelit tidak ditemukan' }, { status: 404 });
    }
    const satelitNama = satelitRes.rows[0].nama_satelit;

    // Fetch categories
    const kategoriRes = await pool.query(
      'SELECT id, kode, nama FROM master_kategori_barang ORDER BY kode'
    );
    const kategoriNames = kategoriRes.rows.map((k: any) => k.nama);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIA GSJA';
    workbook.created = new Date();

    // ── SHEET 0: PETUNJUK ─────────────────────────────────────────────────
    const instrSheet = workbook.addWorksheet('PETUNJUK', {
      properties: { tabColor: { argb: 'FF4472C4' } },
    });
    instrSheet.getColumn('A').width = 80;
    instrSheet.getColumn('B').width = 40;

    const addInstrRow = (text: string, bold = false, color = '000000') => {
      const row = instrSheet.addRow([text]);
      const cell = row.getCell(1);
      cell.font = { bold, color: { argb: `FF${color}` }, size: bold ? 12 : 11 };
      if (bold) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      return row;
    };

    addInstrRow(`TEMPLATE IMPORT INVENTARIS — ${satelitNama.toUpperCase()}`, true, '17375E');
    instrSheet.addRow([]);
    addInstrRow('📋 CARA PENGISIAN:', true);
    addInstrRow('1. Setiap sheet mewakili satu RUANGAN di satelit ini. Isi barang sesuai ruangannya.');
    addInstrRow('2. Kolom KATEGORI: wajib pilih dari dropdown yang sudah tersedia.');
    addInstrRow('3. Kolom TIPE: pilih "Satuan" atau "Massal".');
    addInstrRow('   • Satuan  → barang punya kode unik sendiri, satu baris = SATU UNIT.');
    addInstrRow('   • Massal  → barang dihitung jumlah total, satu baris = SATU JENIS BARANG.');
    addInstrRow('4. Kolom JUMLAH:');
    addInstrRow('   • Untuk SATUAN  → isi berapa unit yang ingin dibuat (mis. 10 → buat 10 kode unik).');
    addInstrRow('   • Untuk MASSAL  → isi jumlah total stok barang tersebut.');
    addInstrRow('5. Kolom KONDISI: pilih "Baik", "Rusak Ringan", atau "Rusak Berat".');
    addInstrRow('6. Kolom NO. SERI: opsional, hanya relevan untuk tipe Satuan (1 unit).');
    addInstrRow('7. JANGAN ubah nama sheet atau header kolom.');
    instrSheet.addRow([]);
    addInstrRow('⚠️  PERHATIAN:', true, 'C00000');
    addInstrRow('• Baris yang kolom NAMA BARANG-nya kosong akan DIABAIKAN saat import.');
    addInstrRow('• Sheet yang tidak punya data (selain header) akan DILEWATI.');
    addInstrRow('• Kolom yang berwarna KUNING adalah wajib diisi.');
    instrSheet.addRow([]);
    addInstrRow('📌 DAFTAR KATEGORI YANG TERSEDIA:', true);
    kategoriRes.rows.forEach((k: any) => addInstrRow(`   ${k.kode}. ${k.nama}`));

    // ── HIDDEN SHEET: _META (store sublokasi mapping untuk import) ────────
    const metaSheet = workbook.addWorksheet('_META');
    metaSheet.state = 'veryHidden';
    metaSheet.addRow(['satelit_id', 'satelit_nama']);
    metaSheet.addRow([satelitId, satelitNama]);
    metaSheet.addRow([]);
    // IMPORTANT: sheet_nama here = the SANITIZED sheet name (what Excel actually uses)
    // sublokasi_nama = original DB name (for display)
    metaSheet.addRow(['sheet_nama', 'sublokasi_id', 'sublokasi_kode', 'sublokasi_nama']);
    sublokasiRes.rows.forEach((sub: any) => {
      metaSheet.addRow([sanitizeSheetName(sub.nama), sub.id, sub.kode, sub.nama]);
    });

    // ── HIDDEN SHEET: _LISTS (dropdown sources) ──────────────────────────
    const listsSheet = workbook.addWorksheet('_LISTS');
    listsSheet.state = 'veryHidden';
    // Kategori list in column A
    listsSheet.getCell('A1').value = 'KATEGORI';
    kategoriNames.forEach((name, i) => {
      listsSheet.getCell(`A${i + 2}`).value = name;
    });
    // Tipe list in column B
    listsSheet.getCell('B1').value = 'TIPE';
    listsSheet.getCell('B2').value = 'Satuan';
    listsSheet.getCell('B3').value = 'Massal';
    // Kondisi list in column C
    listsSheet.getCell('C1').value = 'KONDISI';
    listsSheet.getCell('C2').value = 'Baik';
    listsSheet.getCell('C3').value = 'Rusak Ringan';
    listsSheet.getCell('C4').value = 'Rusak Berat';

    // Column header config
    const HEADERS = [
      { key: 'A', title: 'Nama Barang *', width: 28, required: true },
      { key: 'B', title: 'Merk', width: 20, required: false },
      { key: 'C', title: 'Kategori *', width: 30, required: true },
      { key: 'D', title: 'Tipe *', width: 12, required: true },
      { key: 'E', title: 'Jumlah *', width: 10, required: true },
      { key: 'F', title: 'Kondisi *', width: 15, required: true },
      { key: 'G', title: 'No. Seri', width: 20, required: false },
      { key: 'H', title: 'Tahun Perolehan', width: 16, required: false },
      { key: 'I', title: 'Nilai Perolehan (Rp)', width: 22, required: false },
      { key: 'J', title: 'Keterangan', width: 30, required: false },
    ];

    // Create one sheet per sublokasi
    for (const sub of sublokasiRes.rows) {
      const sheetDisplayName = sub.nama; // original name for display
      const sheetSafeName = sanitizeSheetName(sub.nama); // safe for Excel sheet tab

      const ws = workbook.addWorksheet(sheetSafeName, {
        properties: { tabColor: { argb: 'FF70AD47' } },
      });

      // Sheet title row — use original name for readability
      const titleRow = ws.addRow([`INVENTARIS — ${satelitNama.toUpperCase()} · ${sheetDisplayName.toUpperCase()}`]);
      ws.mergeCells(`A1:J1`);
      const titleCell = ws.getCell('A1');
      titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4057' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 28;

      // Sublokasi meta row (hidden, used for import identification)
      const metaRow = ws.addRow([`__SUBLOKASI_ID__:${sub.id}`]);
      metaRow.hidden = true;

      // Header row (row 3)
      const headerRow = ws.addRow(HEADERS.map(h => h.title));
      headerRow.height = 20;
      HEADERS.forEach((h, i) => {
        const col = i + 1;
        ws.getColumn(col).width = h.width;
        const cell = headerRow.getCell(col);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: h.required ? 'FF2F5496' : 'FF4472C4' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
        };
      });

      // 50 data rows with validation
      const DATA_START = 4; // row 4 onwards
      const DATA_ROWS = 50;
      for (let r = DATA_START; r < DATA_START + DATA_ROWS; r++) {
        const row = ws.getRow(r);
        row.height = 18;

        // Zebra striping
        const bgColor = r % 2 === 0 ? 'FFF2F7FF' : 'FFFFFFFF';

        HEADERS.forEach((h, i) => {
          const col = i + 1;
          const cell = row.getCell(col);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.border = {
            top: { style: 'hair', color: { argb: 'FFD0D0D0' } },
            left: { style: 'hair', color: { argb: 'FFD0D0D0' } },
            bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } },
            right: { style: 'hair', color: { argb: 'FFD0D0D0' } },
          };
          // Required column highlight
          if (h.required) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? 'FFFFFAE7' : 'FFFFFFEF' } };
          }
        });

        // Dropdown for Kategori (col C = 3)
        ws.getCell(r, 3).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_LISTS!$A$2:$A$${kategoriNames.length + 1}`],
          showErrorMessage: true,
          errorTitle: 'Kategori Tidak Valid',
          error: 'Pilih kategori dari daftar yang tersedia',
        };

        // Dropdown for Tipe (col D = 4)
        ws.getCell(r, 4).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_LISTS!$B$2:$B$3`],
          showErrorMessage: true,
          errorTitle: 'Tipe Tidak Valid',
          error: 'Pilih "Satuan" atau "Massal"',
        };
        ws.getCell(r, 4).value = 'Satuan'; // default

        // Dropdown for Kondisi (col F = 6)
        ws.getCell(r, 6).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`_LISTS!$C$2:$C$4`],
          showErrorMessage: true,
          errorTitle: 'Kondisi Tidak Valid',
          error: 'Pilih "Baik", "Rusak Ringan", atau "Rusak Berat"',
        };
        ws.getCell(r, 6).value = 'Baik'; // default

        // Number validation for Jumlah (col E = 5)
        ws.getCell(r, 5).dataValidation = {
          type: 'whole',
          operator: 'greaterThan',
          formulae: ['0'],
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: 'Jumlah Tidak Valid',
          error: 'Jumlah harus berupa bilangan bulat positif (>0)',
        };
        ws.getCell(r, 5).value = 1; // default

        // Number validation for Tahun (col H = 8)
        ws.getCell(r, 8).dataValidation = {
          type: 'whole',
          operator: 'between',
          formulae: ['1900', '2100'],
          allowBlank: true,
          showErrorMessage: true,
          errorTitle: 'Tahun Tidak Valid',
          error: 'Masukkan tahun 4 digit (contoh: 2023)',
        };

        // Number format for Nilai Perolehan (col I = 9)
        ws.getCell(r, 9).numFmt = '#,##0';
      }

      // Freeze panes (keep header visible when scrolling)
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4' }];

      // Auto filter on header row
      ws.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 3, column: HEADERS.length },
      };
    }

    // Reorder: PETUNJUK first, then sublokasi sheets, _META and _LISTS at end
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Template_Inventaris_${satelitNama.replace(/\s+/g, '_')}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('[import-template]', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
