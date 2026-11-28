import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';

interface ParsedAnggaranItem {
  jenis_anggaran: 'Penerimaan' | 'Pengeluaran';
  sumber_dana: string;
  uraian: string;
  deskripsi: string | null;
  akun_catatan: string | null;
  jumlah: number;
  satuan: string;
  harga_satuan: number;
}

function readCellText(cell: ExcelJS.Cell): string {
  const master = cell.master || cell;
  const v = master.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (typeof v === 'object') {
    if ('richText' in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join('').trim();
    }
    if ('result' in v && v.result !== undefined && v.result !== null) {
      return String(v.result).trim();
    }
    if ('text' in v && typeof v.text === 'string') {
      return v.text.trim();
    }
  }
  return '';
}

function parseNumericString(raw: string): number {
  const cleaned = raw.replace(/rp\.?/gi, '').replace(/\s+/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  // Handle Indonesian thousand separators (e.g. 200.000.000) vs standard (200,000,000)
  const digitsOnly = cleaned.replace(/[.,]/g, '');
  if (!/^-?\d+$/.test(digitsOnly)) return 0;
  const num = Number(digitsOnly);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

function evalSimpleFormula(ws: ExcelJS.Worksheet, formula: string, visited: Set<string>): number {
  let expr = formula.trim().replace(/^=/, '');
  if (!expr) return 0;

  // Replace SUM(A1:B2) with computed totals
  expr = expr.replace(/SUM\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)/gi, (_m, startRef, endRef) => {
    try {
      const sCell = ws.getCell(startRef.toUpperCase());
      const eCell = ws.getCell(endRef.toUpperCase());
      const r1 = Math.min(Number(sCell.row), Number(eCell.row));
      const r2 = Math.max(Number(sCell.row), Number(eCell.row));
      const c1 = Math.min(Number(sCell.col), Number(eCell.col));
      const c2 = Math.max(Number(sCell.col), Number(eCell.col));
      let sum = 0;
      const seenAddr = new Set<string>();
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const cell = ws.getRow(r).getCell(c);
          const master = cell.master || cell;
          if (seenAddr.has(master.address)) continue;
          seenAddr.add(master.address);
          sum += readCellNumber(ws, master, visited);
        }
      }
      return String(sum);
    } catch {
      return '0';
    }
  });

  // Replace percentages like 10% -> (10/100)
  expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

  // Replace individual cell references like K28 or $K$28
  expr = expr.replace(/\$?([A-Z]{1,3})\$?(\d+)/gi, (_m, colStr, rowStr) => {
    const addr = `${colStr.toUpperCase()}${rowStr}`;
    try {
      return String(readCellNumber(ws, ws.getCell(addr), visited));
    } catch {
      return '0';
    }
  });

  // Safe arithmetic evaluation only if expression contains digits/operators/spaces/parens
  if (!/^[\d.+\-*/()\s]+$/.test(expr)) return 0;
  try {
    const val = Function(`"use strict"; return (${expr});`)();
    return typeof val === 'number' && Number.isFinite(val) && val > 0 ? Math.round(val) : 0;
  } catch {
    return 0;
  }
}

function readCellNumber(ws: ExcelJS.Worksheet, cell: ExcelJS.Cell, visited = new Set<string>()): number {
  const master = cell.master || cell;
  if (visited.has(master.address)) return 0;
  const v = master.value;
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
  if (typeof v === 'object') {
    if ('result' in v && v.result !== undefined && v.result !== null) {
      const res = v.result;
      if (typeof res === 'number') return Number.isFinite(res) && res > 0 ? Math.round(res) : 0;
      if (typeof res === 'string') return parseNumericString(res);
      return 0;
    }
    if ('formula' in v && typeof v.formula === 'string') {
      const nextVisited = new Set(visited);
      nextVisited.add(master.address);
      return evalSimpleFormula(ws, v.formula, nextVisited);
    }
    return 0;
  }
  if (typeof v === 'string') return parseNumericString(v);
  return 0;
}

function readSpanNumber(ws: ExcelJS.Worksheet, row: ExcelJS.Row, startCol: number, endCol: number): number {
  const from = Math.max(1, startCol);
  const to = Math.max(from, endCol);
  for (let c = from; c <= to; c++) {
    const n = readCellNumber(ws, row.getCell(c));
    if (n > 0) return n;
  }
  return 0;
}

function detectColumns(ws: ExcelJS.Worksheet) {
  let headerRow = -1;
  let colUraianStart = 1;
  let colPenerimaan = 0;
  let colKasGereja = 0;
  let colSwadaya = 0;
  let colTotal = 0;

  const maxCol = Math.min(35, ws.columnCount || 26);

  // Scan ALL rows so real Proker workbooks (where 4. ANGGARAN starts at row 25+) are detected accurately
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let foundUraian = false;
    let foundPenerimaanInRow = 0;

    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c);
      const masterCol = Number((cell.master || cell).col) || c;
      const txt = readCellText(cell).toUpperCase();
      if (txt === 'URAIAN' && !foundUraian) {
        foundUraian = true;
        colUraianStart = masterCol;
      }
      if (txt === 'PENERIMAAN' && masterCol > colUraianStart && !foundPenerimaanInRow) {
        foundPenerimaanInRow = masterCol;
      }
      if ((txt.includes('KAS GEREJA') || txt === 'KAS PUSAT' || txt === 'PUSAT') && !colKasGereja) {
        colKasGereja = masterCol;
      }
      if (txt === 'SWADAYA' && !colSwadaya) {
        colSwadaya = masterCol;
      }
      if (txt === 'TOTAL' && masterCol > (foundPenerimaanInRow || colPenerimaan || colUraianStart) && !colTotal) {
        colTotal = masterCol;
      }
    }

    if (foundUraian && foundPenerimaanInRow) {
      headerRow = r;
      colPenerimaan = foundPenerimaanInRow;
      // Reset sub-headers in case an earlier table had "TOTAL" before the Anggaran header
      if (colKasGereja < colPenerimaan) colKasGereja = 0;
      if (colSwadaya < colPenerimaan) colSwadaya = 0;
      if (colTotal < colPenerimaan) colTotal = 0;
    } else if (headerRow > 0 && r <= headerRow + 2 && (colKasGereja || colSwadaya || colTotal)) {
      headerRow = r;
    }

    if (headerRow > 0 && colPenerimaan && colKasGereja && colSwadaya && colTotal) {
      break;
    }
  }

  const pCol = colPenerimaan || 10;
  const kCol = colKasGereja || (pCol + 4);
  const sCol = colSwadaya || (kCol + 4);
  const tCol = colTotal || (sCol + 4);

  return {
    foundHeader: headerRow > 0 && colPenerimaan > 0,
    startRow: headerRow > 0 ? headerRow + 1 : 4,
    colUraianStart,
    penerimaanSpan: [pCol, Math.max(pCol, kCol - 1)] as [number, number],
    kasGerejaSpan: [kCol, Math.max(kCol, sCol - 1)] as [number, number],
    swadayaSpan: [sCol, Math.max(sCol, tCol - 1)] as [number, number],
    totalSpan: [tCol, Math.min(tCol + 4, maxCol)] as [number, number],
  };
}

function parseWorksheet(ws: ExcelJS.Worksheet): { items: ParsedAnggaranItem[]; skippedRows: number } {
  const {
    foundHeader,
    startRow,
    colUraianStart,
    penerimaanSpan,
    kasGerejaSpan,
    swadayaSpan,
    totalSpan,
  } = detectColumns(ws);
  if (!foundHeader) return { items: [], skippedRows: 0 };

  const items: ParsedAnggaranItem[] = [];
  let skippedRows = 0;

  let currentMajor: 'Penerimaan' | 'Pengeluaran' = 'Penerimaan';
  let currentGroup = '';
  let currentSubGroup = '';

  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const c1 = readCellText(row.getCell(colUraianStart));
    const c2 = readCellText(row.getCell(colUraianStart + 1));

    // Determine label: if C1 is a number/bullet (1, "2", "1.", "a."), item label is in C2; otherwise C1
    const isNumberOrBullet = /^(\d+\.?|[a-z]\.)$/i.test(c1);
    let uraian = '';
    if (isNumberOrBullet && c2 && c2 !== c1) {
      uraian = c2;
    } else if (c1 && c2 && c1 !== c2 && !/^\d/.test(c1)) {
      uraian = `${c1} ${c2}`.trim();
    } else {
      uraian = c1 || c2;
    }
    uraian = uraian.replace(/\s+/g, ' ').trim();

    const penerimaanAmt = readSpanNumber(ws, row, penerimaanSpan[0], penerimaanSpan[1]);
    const kasGerejaAmt = readSpanNumber(ws, row, kasGerejaSpan[0], kasGerejaSpan[1]);
    const swadayaAmt = readSpanNumber(ws, row, swadayaSpan[0], swadayaSpan[1]);
    const totalAmt = readSpanNumber(ws, row, totalSpan[0], totalSpan[1]);
    const hasAnyAmount = penerimaanAmt > 0 || kasGerejaAmt > 0 || swadayaAmt > 0 || totalAmt > 0;

    if (!uraian && !hasAnyAmount) continue;

    const upper = uraian.toUpperCase();

    // Stop at JUMLAH TOTAL so signatures/other tables below Anggaran are never imported
    if (/^JUMLAH\s+TOTAL\b/.test(upper)) {
      skippedRows++;
      break;
    }

    // Skip other summary / subtotal rows
    if (/^(JUMLAH|TOTAL|SUB\s*TOTAL|SALDO|SURPLUS|DEFISIT)\b/.test(upper)) {
      skippedRows++;
      continue;
    }

    // Track major section headers
    if (upper === 'PENERIMAAN' && !hasAnyAmount) {
      currentMajor = 'Penerimaan';
      currentGroup = '';
      currentSubGroup = '';
      continue;
    }
    if (upper === 'PENGELUARAN' && !hasAnyAmount) {
      currentMajor = 'Pengeluaran';
      currentGroup = '';
      currentSubGroup = '';
      continue;
    }

    // Track section / sub-section headers when row has no amount
    if (!hasAnyAmount) {
      const cleanSection = uraian.replace(/:\s*$/, '').trim();
      if (/^[a-z]\.\s*/i.test(c1) || /^[a-z]\.\s+/i.test(uraian)) {
        currentSubGroup = cleanSection.replace(/^[a-z]\.\s*/i, '').trim();
      } else if (uraian.endsWith(':') || /^(KEBAKTIAN|SEKRETARIAT|KOMISI|KEGIATAN KHUSUS|KEGIATAN LAIN)/i.test(upper)) {
        currentGroup = cleanSection;
        currentSubGroup = '';
      } else if (currentGroup.toLowerCase().includes('komisi') && !isNumberOrBullet) {
        // e.g. "Acara Spesial SM"
        currentSubGroup = currentSubGroup
          ? `${currentSubGroup.split(' - ')[0]} - ${cleanSection}`
          : cleanSection;
      }
      continue;
    }

    // Row has amount(s) — build deskripsi from section hierarchy
    const sectionLabel = [currentGroup, currentSubGroup].filter(Boolean).join(' › ') || null;
    const finalUraian = uraian || sectionLabel || `Item Baris ${r}`;

    if (penerimaanAmt > 0) {
      items.push({
        jenis_anggaran: 'Penerimaan',
        sumber_dana: 'Swadaya',
        uraian: finalUraian,
        deskripsi: sectionLabel,
        akun_catatan: sectionLabel,
        jumlah: 1,
        satuan: 'Tahun',
        harga_satuan: penerimaanAmt,
      });
    }

    if (kasGerejaAmt > 0) {
      items.push({
        jenis_anggaran: 'Pengeluaran',
        sumber_dana: 'Pusat',
        uraian: finalUraian,
        deskripsi: sectionLabel ? `${sectionLabel} (Kas Gereja)` : 'Kas Gereja',
        akun_catatan: sectionLabel,
        jumlah: 1,
        satuan: 'Paket',
        harga_satuan: kasGerejaAmt,
      });
    }

    if (swadayaAmt > 0) {
      items.push({
        jenis_anggaran: 'Pengeluaran',
        sumber_dana: 'Swadaya',
        uraian: finalUraian,
        deskripsi: sectionLabel ? `${sectionLabel} (Swadaya)` : 'Swadaya',
        akun_catatan: sectionLabel,
        jumlah: 1,
        satuan: 'Paket',
        harga_satuan: swadayaAmt,
      });
    }

    // Fallback: user only filled TOTAL column without splitting Kas Gereja / Swadaya
    if (penerimaanAmt === 0 && kasGerejaAmt === 0 && swadayaAmt === 0 && totalAmt > 0) {
      items.push({
        jenis_anggaran: currentMajor,
        sumber_dana: currentMajor === 'Penerimaan' ? 'Swadaya' : 'Pusat',
        uraian: finalUraian,
        deskripsi: sectionLabel,
        akun_catatan: sectionLabel,
        jumlah: 1,
        satuan: 'Paket',
        harga_satuan: totalAmt,
      });
    }
  }

  return { items, skippedRows };
}

export async function POST(request: NextRequest) {
  // Auth & permission check outside try/catch
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('anggaran_create')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin membuat rancangan anggaran' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawSatelitId = formData.get('satelit_id');
    const rawTahun = formData.get('tahun');
    const rawKomisiId = formData.get('komisi_id');
    const rawNama = String(formData.get('nama_rancangan') || '').trim();
    const rawKategori = String(formData.get('kategori_ra') || 'Operasional').trim();
    const rawSheetName = String(formData.get('sheet_name') || '').trim();

    if (!file || file.size === 0) {
      return NextResponse.json({ success: false, message: 'File Excel (.xlsx) wajib diunggah.' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ success: false, message: 'Format file harus .xlsx (Excel Workbook).' }, { status: 400 });
    }

    const canMultiSatelit = caller.is_super_admin || caller.permissions.includes('multi_satelit_view');
    const satelitId = canMultiSatelit
      ? (rawSatelitId ? parseInt(String(rawSatelitId), 10) : caller.satelit_id)
      : caller.satelit_id;
    const tahun = rawTahun ? parseInt(String(rawTahun), 10) : new Date().getFullYear();
    const komisiId = rawKomisiId ? parseInt(String(rawKomisiId), 10) : null;

    if (!satelitId || Number.isNaN(satelitId)) {
      return NextResponse.json({ success: false, message: 'Satelit wajib dipilih.' }, { status: 400 });
    }
    if (!tahun || Number.isNaN(tahun)) {
      return NextResponse.json({ success: false, message: 'Tahun anggaran wajib diisi.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    let chosenSheetName = '';
    let parsed: { items: ParsedAnggaranItem[]; skippedRows: number } = { items: [], skippedRows: 0 };

    if (rawSheetName) {
      const targetWs = wb.getWorksheet(rawSheetName);
      if (!targetWs) {
        return NextResponse.json({ success: false, message: `Sheet "${rawSheetName}" tidak ditemukan di file Excel.` }, { status: 400 });
      }
      chosenSheetName = targetWs.name;
      parsed = parseWorksheet(targetWs);
    } else {
      const candidateSheets: Array<{
        name: string;
        parsed: { items: ParsedAnggaranItem[]; skippedRows: number };
        totalPenerimaan: number;
        totalPengeluaran: number;
      }> = [];

      for (const ws of wb.worksheets) {
        const attempt = parseWorksheet(ws);
        if (attempt.items.length > 0) {
          candidateSheets.push({
            name: ws.name,
            parsed: attempt,
            totalPenerimaan: attempt.items.filter((i) => i.jenis_anggaran === 'Penerimaan').reduce((s, i) => s + i.harga_satuan, 0),
            totalPengeluaran: attempt.items.filter((i) => i.jenis_anggaran === 'Pengeluaran').reduce((s, i) => s + i.harga_satuan, 0),
          });
        }
      }

      const templateCandidate = candidateSheets.find((s) => s.name === 'Template');
      if (templateCandidate) {
        // Official GSJA template filled in the "Template" sheet -> auto-import immediately
        chosenSheetName = templateCandidate.name;
        parsed = templateCandidate.parsed;
      } else if (candidateSheets.length > 1) {
        // Multi-sheet Proker workbook (e.g. WILAYAH TENGAH 2, TIMUR 1 & SATELIT BETLEHEM) -> let user pick sheet
        return NextResponse.json({
          success: true,
          needsSheetSelection: true,
          sheets: candidateSheets.map((s) => ({
            name: s.name,
            item_count: s.parsed.items.length,
            total_penerimaan: s.totalPenerimaan,
            total_pengeluaran: s.totalPengeluaran,
          })),
        });
      } else if (candidateSheets.length === 1) {
        chosenSheetName = candidateSheets[0].name;
        parsed = candidateSheets[0].parsed;
      }
    }

    if (parsed.items.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Tidak ada item anggaran bernominal yang ditemukan di file Excel. Pastikan nominal diisi di kolom PENERIMAAN, KAS GEREJA, atau SWADAYA.',
      }, { status: 400 });
    }

    const satRes = await pool.query(`SELECT nama_satelit FROM public.satelit WHERE id = $1`, [satelitId]);
    const namaSatelit = satRes.rows[0]?.nama_satelit || `Satelit #${satelitId}`;
    const namaRancangan = rawNama || `Rancangan Anggaran ${namaSatelit} ${tahun}`;

    const yearCode = String(tahun).slice(-2);
    const countRes = await pool.query(`SELECT COUNT(*) FROM public.anggaran_tahunan WHERE tahun = $1`, [tahun]);
    const seq = String(parseInt(countRes.rows[0].count, 10) + 1).padStart(3, '0');
    const kodeDokumen = `RA-${yearCode}-${seq}`;

    const totalPenerimaan = parsed.items
      .filter((i) => i.jenis_anggaran === 'Penerimaan')
      .reduce((sum, i) => sum + i.jumlah * i.harga_satuan, 0);
    const totalPengeluaran = parsed.items
      .filter((i) => i.jenis_anggaran === 'Pengeluaran')
      .reduce((sum, i) => sum + i.jumlah * i.harga_satuan, 0);
    const totalAnggaran = totalPenerimaan + totalPengeluaran;

    await client.query('BEGIN');

    const headerRes = await client.query(
      `INSERT INTO public.anggaran_tahunan
         (kode_dokumen, tahun, satelit_id, komisi_id, total_anggaran, status, kategori_ra, pola_penggunaan, nama_rancangan, created_by)
       VALUES ($1, $2, $3, $4, $5, 'Draft', $6, '-', $7, $8)
       RETURNING id`,
      [kodeDokumen, tahun, satelitId, komisiId, totalAnggaran, rawKategori || 'Operasional', namaRancangan, caller.user_id]
    );
    const anggaranId = headerRes.rows[0].id;

    for (const item of parsed.items) {
      await client.query(
        `INSERT INTO public.anggaran_tahunan_detail
           (anggaran_tahunan_id, jenis_anggaran, coa_id, akun_catatan, sumber_dana, uraian, deskripsi, jumlah, satuan, harga_satuan, total, status_item)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, 'Draft')`,
        [
          anggaranId,
          item.jenis_anggaran,
          item.akun_catatan,
          item.sumber_dana,
          item.uraian,
          item.deskripsi,
          item.jumlah,
          item.satuan,
          item.harga_satuan,
          item.jumlah * item.harga_satuan,
        ]
      );
    }

    await client.query('COMMIT');

    try {
      const snapshot = await resolveCallerSnapshot(caller);
      await auditLogRepository.insertAnggaranAuditLog({
        anggaran_id: anggaranId,
        kode_dokumen: kodeDokumen,
        aksi: 'Dibuat',
        status_sebelum: null,
        status_sesudah: 'Draft',
        user_id: caller.user_id,
        role_id: caller.role_id,
        satelit_id: caller.satelit_id,
        ...snapshot,
        keterangan: `Diimpor dari Excel (${file.name}, sheet "${chosenSheetName}") dengan ${parsed.items.length} item rincian`,
      });
    } catch (err) {
      console.error('[AnggaranImportExcel] AuditLog error:', err);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${parsed.items.length} item ke Draft ${kodeDokumen}.`,
      data: {
        id: anggaranId,
        kode_dokumen: kodeDokumen,
        nama_rancangan: namaRancangan,
        sheet_used: chosenSheetName,
        total_items: parsed.items.length,
        penerimaan_count: parsed.items.filter((i) => i.jenis_anggaran === 'Penerimaan').length,
        pengeluaran_count: parsed.items.filter((i) => i.jenis_anggaran === 'Pengeluaran').length,
        total_penerimaan: totalPenerimaan,
        total_pengeluaran: totalPengeluaran,
        skipped_rows: parsed.skippedRows,
      },
    });
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[AnggaranImportExcel] POST error:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Gagal mengimpor file Excel anggaran.' }, { status: 500 });
  } finally {
    client.release();
  }
}
