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

function readCellNumber(cell: ExcelJS.Cell): number {
  const master = cell.master || cell;
  const v = master.value;
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0;
  if (typeof v === 'object' && 'result' in v) {
    const res = v.result;
    if (typeof res === 'number' && Number.isFinite(res)) return Math.round(res);
    if (typeof res === 'string') return parseNumericString(res);
    return 0;
  }
  if (typeof v === 'string') return parseNumericString(v);
  return 0;
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

function detectColumns(ws: ExcelJS.Worksheet) {
  let headerRow = -1;
  let colUraianStart = 1;
  let colPenerimaan = 0;
  let colKasGereja = 0;
  let colSwadaya = 0;
  let colTotal = 0;

  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const row = ws.getRow(r);
    let foundUraian = false;
    for (let c = 1; c <= Math.min(30, ws.columnCount || 24); c++) {
      const cell = row.getCell(c);
      const masterCol = Number((cell.master || cell).col) || c;
      const txt = readCellText(cell).toUpperCase();
      if (txt === 'URAIAN' && !foundUraian) {
        foundUraian = true;
        colUraianStart = masterCol;
      }
      if (txt === 'PENERIMAAN' && masterCol > colUraianStart && !colPenerimaan) {
        colPenerimaan = masterCol;
      }
      if ((txt.includes('KAS GEREJA') || txt === 'KAS PUSAT' || txt === 'PUSAT') && !colKasGereja) {
        colKasGereja = masterCol;
      }
      if (txt === 'SWADAYA' && !colSwadaya) {
        colSwadaya = masterCol;
      }
      if (txt === 'TOTAL' && masterCol > (colPenerimaan || colUraianStart) && !colTotal) {
        colTotal = masterCol;
      }
    }
    if (foundUraian) {
      headerRow = r;
    }
  }

  return {
    startRow: headerRow > 0 ? headerRow + 1 : 4,
    colUraianStart,
    colPenerimaan: colPenerimaan || 10,
    colKasGereja: colKasGereja || 14,
    colSwadaya: colSwadaya || 18,
    colTotal: colTotal || 22,
  };
}

function parseWorksheet(ws: ExcelJS.Worksheet): { items: ParsedAnggaranItem[]; skippedRows: number } {
  const { startRow, colUraianStart, colPenerimaan, colKasGereja, colSwadaya, colTotal } = detectColumns(ws);
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

    const penerimaanAmt = readCellNumber(row.getCell(colPenerimaan));
    const kasGerejaAmt = readCellNumber(row.getCell(colKasGereja));
    const swadayaAmt = readCellNumber(row.getCell(colSwadaya));
    const totalAmt = readCellNumber(row.getCell(colTotal));
    const hasAnyAmount = penerimaanAmt > 0 || kasGerejaAmt > 0 || swadayaAmt > 0 || totalAmt > 0;

    if (!uraian && !hasAnyAmount) continue;

    const upper = uraian.toUpperCase();

    // Skip summary / total rows
    if (/^(JUMLAH|TOTAL|SUBTOTAL|SALDO|SURPLUS|DEFISIT)\b/.test(upper)) {
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

    // Prefer "Template" sheet if it has parsed items, else try all other sheets (including "Contoh" / custom sheet name)
    let chosenSheetName = '';
    let parsed: { items: ParsedAnggaranItem[]; skippedRows: number } = { items: [], skippedRows: 0 };

    const templateSheet = wb.getWorksheet('Template');
    if (templateSheet) {
      const attempt = parseWorksheet(templateSheet);
      if (attempt.items.length > 0) {
        chosenSheetName = templateSheet.name;
        parsed = attempt;
      }
    }
    if (parsed.items.length === 0) {
      for (const ws of wb.worksheets) {
        if (ws.name === 'Template') continue;
        const attempt = parseWorksheet(ws);
        if (attempt.items.length > 0) {
          chosenSheetName = ws.name;
          parsed = attempt;
          break;
        }
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
