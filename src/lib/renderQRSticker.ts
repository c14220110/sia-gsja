/**
 * renderQRSticker — shared, DOM-independent sticker canvas renderer.
 *
 * Generates a 600×750 px PNG (matches 5cm×6.25cm at 300 DPI) using the
 * `qrcode` npm library for programmatic QR generation — no React/DOM needed.
 * This makes it usable for both single-sticker (QRCodeModal) and bulk
 * multi-item PDF printing (BulkQRPrintModal).
 */

export interface StickerParams {
  title: string;
  subtitle?: string;
  qrValue: string;
}

export type StickerPrintSize = 'normal' | 'small' | 'a3_small';

export interface BulkPrintItemParams extends StickerParams {
  copies: number;
  sublokasi?: string;
  satelit?: string;
  onRendered?: () => void;
}

export const STICKER_W_MM = 50;    // physical width mm (5 cm)
export const STICKER_H_MM = 62.5;  // physical height mm (6.25 cm)
export const STICKER_COLS = 3;     // columns per A4 page
export const STICKER_ROWS = 4;     // rows per A4 page
export const PER_PAGE = STICKER_COLS * STICKER_ROWS; // 12 per A4

// ── Mini sticker — dikecilkan 30% (70% dari ukuran normal) ──
export const STICKER_SM_W_MM = 35;     // 50 × 0.7 = 35mm (3.5 cm)
export const STICKER_SM_H_MM = 43.75;  // 62.5 × 0.7 = 43.75mm (4.375 cm ≈ 4.37 cm)
export const STICKER_SM_COLS = 5;      // 5 cols × A4 (totalW=187mm, marginX=11.5mm)
export const STICKER_SM_ROWS = 6;      // 6 rows × A4 (totalH=277.5mm, marginY=9.75mm)
export const PER_PAGE_SM = STICKER_SM_COLS * STICKER_SM_ROWS; // 30 per A4

// ── A3 Mini sticker — Kertas A3 (297×420 mm) & ukuran stiker 30% ──
export const STICKER_A3_SM_COLS = 7;   // 7 cols × 35mm = 245mm (+6×4mm gaps = 269mm, marginX=14mm)
export const STICKER_A3_SM_ROWS = 8;   // 8 rows × 43.75mm = 350mm (+7×4mm gaps = 378mm, marginY=21mm)
export const PER_PAGE_A3_SM = STICKER_A3_SM_COLS * STICKER_A3_SM_ROWS; // 56 per A3




/**
 * Renders one sticker to a canvas and returns its PNG data URL.
 * Canvas size: 600×750 px (aspect ratio 4:5 = 5cm:6.25cm)
 */
export async function renderStickerCanvas(params: StickerParams): Promise<string> {
  const { title, subtitle, qrValue } = params;
  const W = 600;
  const H = 750;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background ──
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, W, H);

  // ── Header strip (rounded top) ──
  const headerH = 72;
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(0, 0, W, headerH, [14, 14, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#3b82f6';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SIM GSJA', W / 2, 40);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('LABEL ASET', W / 2, 58);

  // ── White card ──
  const cardM = 24;
  const cardX = cardM;
  const cardY = 88;
  const cardW = W - cardM * 2;
  const cardH = H - cardY - cardM;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 14);
  ctx.fill();

  // ── QR Code (via qrcode library — no DOM) ──
  const qrSize = 380;
  const qrX = (W - qrSize) / 2;
  const qrY = cardY + 20;

  try {
    const QRCode = (await import('qrcode')).default;
    const qrDataUrl = await QRCode.toDataURL(qrValue || ' ', {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: qrSize,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    await new Promise<void>((resolve) => {
      const qrImg = new Image();
      qrImg.onload = () => { ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize); resolve(); };
      qrImg.onerror = () => resolve();
      qrImg.src = qrDataUrl;
    });
  } catch (_) { /* QR gagal — lanjutkan tanpa QR */ }

  // ── Logo GSJA di tengah QR (28% dari qrSize — aman untuk level H) ──
  try {
    const logoSize = qrSize * 0.28;
    const logoX = qrX + (qrSize - logoSize) / 2;
    const logoY = qrY + (qrSize - logoSize) / 2;
    await new Promise<void>((resolve) => {
      const logoImg = new Image();
      logoImg.onload = () => {
        ctx.fillStyle = '#ffffff';
        const pad = 10;
        ctx.beginPath();
        ctx.roundRect(logoX - pad, logoY - pad, logoSize + pad * 2, logoSize + pad * 2, 10);
        ctx.fill();
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        resolve();
      };
      logoImg.onerror = () => resolve();
      logoImg.src = '/assets/logo_gsja.png';
    });
  } catch (_) { /* logo opsional */ }

  // ── Divider ──
  const divY = qrY + qrSize + 16;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 32, divY);
  ctx.lineTo(cardX + cardW - 32, divY);
  ctx.stroke();

  // ── Text section ──
  let curY = divY + 28;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.length > 26 ? title.slice(0, 24) + '\u2026' : title, W / 2, curY);
  curY += 26;

  if (subtitle) {
    ctx.fillStyle = '#64748b';
    ctx.font = '18px sans-serif';
    ctx.fillText(subtitle, W / 2, curY);
    curY += 24;
  }

  ctx.fillStyle = '#1e40af';
  ctx.font = 'bold 19px monospace';
  curY += 8;
  ctx.fillText(qrValue, W / 2, curY);

  // ── Footer ──
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.fillText('Properti Resmi GSJA \u2014 Jangan dipindahkan tanpa izin pengurus', W / 2, H - 12);

  return canvas.toDataURL('image/png');
}

/**
 * Calculates the exact total number of PDF pages needed, taking into account
 * page capacity and clean row breaks when the room/sublokasi changes.
 */
export function estimateTotalPages(
  items: Array<{ copies: number; sublokasi?: string }>,
  size: StickerPrintSize = 'normal'
): number {
  if (items.length === 0) return 0;
  const cols = size === 'a3_small' ? STICKER_A3_SM_COLS : (size === 'small' ? STICKER_SM_COLS : STICKER_COLS);
  const rows = size === 'a3_small' ? STICKER_A3_SM_ROWS : (size === 'small' ? STICKER_SM_ROWS : STICKER_ROWS);

  let curCol = 0;
  let curRow = 0;
  let pages = 1;
  let lastRoom = '';

  for (const it of items) {
    const room = (it.sublokasi || '').trim();
    if (room && lastRoom !== '' && room !== lastRoom) {
      if (curCol > 0) {
        curCol = 0;
        curRow++;
        if (curRow >= rows) {
          pages++;
          curRow = 0;
        }
      }
    }

    const n = Math.max(1, it.copies);
    for (let c = 0; c < n; c++) {
      if (curRow >= rows) {
        pages++;
        curRow = 0;
        curCol = 0;
      }
      curCol++;
      if (curCol >= cols) {
        curCol = 0;
        curRow++;
      }
    }
    if (room) lastRoom = room;
  }
  return pages;
}

/**
 * Generates a PDF containing stickers for multiple items.
 * Supports A4 Normal (3×4=12/hal), A4 Mini (5×6=30/hal), and A3 Mini (7×8=56/hal).
 * When items belong to different rooms (sublokasi), it separates them cleanly
 * by row and adds room headers/markers on the PDF.
 *
 * @param items   Array of sticker definitions with per-item copy count and room info
 * @param size    'normal' (A4) | 'small' (A4 30% mini) | 'a3_small' (A3 30% mini)
 * @returns       Blob of the generated PDF
 */
export async function generateBulkPDF(
  items: BulkPrintItemParams[],
  size: StickerPrintSize = 'normal',
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const isA3 = size === 'a3_small';
  const paperFormat = isA3 ? 'a3' : 'a4';

  let sW: number;
  let sH: number;
  let cols: number;
  let rows: number;
  let colGap: number;
  let rowGap: number;

  if (size === 'a3_small') {
    sW     = STICKER_SM_W_MM;  // 35mm
    sH     = STICKER_SM_H_MM;  // 43.75mm
    cols   = STICKER_A3_SM_COLS; // 7 cols
    rows   = STICKER_A3_SM_ROWS; // 8 rows
    colGap = 4;
    rowGap = 4;
  } else if (size === 'small') {
    sW     = STICKER_SM_W_MM;  // 35mm
    sH     = STICKER_SM_H_MM;  // 43.75mm
    cols   = STICKER_SM_COLS;  // 5 cols
    rows   = STICKER_SM_ROWS;  // 6 rows
    colGap = 3;
    rowGap = 3;
  } else {
    sW     = STICKER_W_MM;     // 50mm
    sH     = STICKER_H_MM;     // 62.5mm
    cols   = STICKER_COLS;     // 3 cols
    rows   = STICKER_ROWS;     // 4 rows
    colGap = 5;
    rowGap = 4;
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: paperFormat });
  const paperW = pdf.internal.pageSize.getWidth();
  const paperH = pdf.internal.pageSize.getHeight();

  const totalW = cols * sW + (cols - 1) * colGap;
  const totalH = rows * sH + (rows - 1) * rowGap;
  const marginX = (paperW - totalW) / 2;
  const marginY = (paperH - totalH) / 2;

  let curPage = 1;
  let curCol = 0;
  let curRow = 0;
  let lastRoom = '';

  // Track which rooms appear on each page for page headers
  const pageRooms: Record<number, Set<string>> = { 1: new Set() };

  // Yield to event loop every N items to avoid UI freeze
  const YIELD_EVERY = 20;
  let sinceYield = 0;

  for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
    const item = items[itemIdx];
    const room = (item.sublokasi || '').trim();

    // If room changed and not first item: start room on a clean new row
    if (room && lastRoom !== '' && room !== lastRoom) {
      if (curCol > 0) {
        curCol = 0;
        curRow++;
        if (curRow >= rows) {
          pdf.addPage();
          curPage++;
          pageRooms[curPage] = new Set();
          curRow = 0;
          curCol = 0;
        }
      }
    }

    // Render sticker to canvas, then export as JPEG (10x smaller than PNG)
    const dataUrl = await renderStickerCanvasJPEG(item);
    const alias = `sticker_${itemIdx}`;
    const n = Math.max(1, item.copies);

    for (let c = 0; c < n; c++) {
      if (curRow >= rows) {
        pdf.addPage();
        curPage++;
        pageRooms[curPage] = new Set();
        curRow = 0;
        curCol = 0;
      }

      if (room) {
        pageRooms[curPage].add(room);
      }

      const x = marginX + curCol * (sW + colGap);
      const y = marginY + curRow * (sH + rowGap);

      // If room changed and this is the start of that room row, draw section marker
      if (room && room !== lastRoom && curCol === 0) {
        if (curRow > 0) {
          // Subtle divider line in row gap
          const lineY = y - rowGap / 2;
          pdf.setDrawColor(203, 213, 225); // slate-300
          pdf.setLineWidth(0.25);
          pdf.line(marginX, lineY, paperW - marginX, lineY);
        }

        // Room label above row
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(67, 56, 202); // indigo-700
        pdf.text(`\u25B8 Ruang: ${room}`, marginX, y - 1);
      }

      // Add sticker image
      pdf.addImage(dataUrl, 'JPEG', x, y, sW, sH, alias, 'FAST');

      // Dashed crop marks
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.2);
      pdf.setLineDashPattern([1, 1.5], 0);
      pdf.rect(x, y, sW, sH);
      pdf.setLineDashPattern([], 0);

      // Advance column / row
      curCol++;
      if (curCol >= cols) {
        curCol = 0;
        curRow++;
      }
    }

    if (room) lastRoom = room;

    item.onRendered?.();
    sinceYield++;

    if (sinceYield >= YIELD_EVERY) {
      sinceYield = 0;
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // ── Second pass: Draw page header and footer across all generated pages ──
  const totalPdfPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPdfPages; p++) {
    pdf.setPage(p);
    const roomsList = Array.from(pageRooms[p] || []).filter(Boolean);
    const roomsStr = roomsList.length > 0 ? roomsList.join(', ') : '';

    // Top Header: Left = SIM GSJA, Right = Ruangan name(s) (matches Photo 4 top-right text)
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text('SIM GSJA \u2014 LABEL ASET', marginX, marginY - 3.5);

    if (roomsStr) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.text(`Ruang: ${roomsStr}`, paperW - marginX, marginY - 3.5, { align: 'right' });
    }

    // Bottom Footer
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Halaman ${p} dari ${totalPdfPages} (${paperFormat.toUpperCase()})`, paperW / 2, paperH - Math.max(4, marginY / 2), { align: 'center' });
  }

  return pdf.output('blob');
}

/**
 * Same as renderStickerCanvas but outputs JPEG (much smaller file size).
 * This prevents jsPDF from accumulating huge base64 strings for hundreds of stickers.
 */
async function renderStickerCanvasJPEG(params: StickerParams): Promise<string> {
  const { title, subtitle, qrValue } = params;
  const W = 600;
  const H = 750;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background — use white for JPEG (no transparency) ──
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // ── Content area with slight grey bg ──
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, W, H);

  // ── Header strip ──
  const headerH = 72;
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(0, 0, W, headerH, [14, 14, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#3b82f6';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SIM GSJA', W / 2, 40);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.fillText('LABEL ASET', W / 2, 58);

  // ── White card ──
  const cardM = 24;
  const cardX = cardM;
  const cardY = 88;
  const cardW = W - cardM * 2;
  const cardH = H - cardY - cardM;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 14);
  ctx.fill();

  // ── QR Code ──
  const qrSize = 380;
  const qrX = (W - qrSize) / 2;
  const qrY = cardY + 20;

  try {
    const QRCode = (await import('qrcode')).default;
    const qrDataUrl = await QRCode.toDataURL(qrValue || ' ', {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: qrSize,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    await new Promise<void>((resolve) => {
      const qrImg = new Image();
      qrImg.onload = () => { ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize); resolve(); };
      qrImg.onerror = () => resolve();
      qrImg.src = qrDataUrl;
    });
  } catch (_) { /* QR gagal */ }

  // ── Logo GSJA ──
  try {
    const logoSize = qrSize * 0.28;
    const logoX = qrX + (qrSize - logoSize) / 2;
    const logoY = qrY + (qrSize - logoSize) / 2;
    await new Promise<void>((resolve) => {
      const logoImg = new Image();
      logoImg.onload = () => {
        ctx.fillStyle = '#ffffff';
        const pad = 10;
        ctx.beginPath();
        ctx.roundRect(logoX - pad, logoY - pad, logoSize + pad * 2, logoSize + pad * 2, 10);
        ctx.fill();
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        resolve();
      };
      logoImg.onerror = () => resolve();
      logoImg.src = '/assets/logo_gsja.png';
    });
  } catch (_) { /* logo opsional */ }

  // ── Divider ──
  const divY = qrY + qrSize + 16;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 32, divY);
  ctx.lineTo(cardX + cardW - 32, divY);
  ctx.stroke();

  // ── Text section ──
  let curY = divY + 28;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.length > 26 ? title.slice(0, 24) + '\u2026' : title, W / 2, curY);
  curY += 26;

  if (subtitle) {
    ctx.fillStyle = '#64748b';
    ctx.font = '18px sans-serif';
    ctx.fillText(subtitle, W / 2, curY);
    curY += 24;
  }

  ctx.fillStyle = '#1e40af';
  ctx.font = 'bold 19px monospace';
  curY += 8;
  ctx.fillText(qrValue, W / 2, curY);

  // ── Footer ──
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.fillText('Properti Resmi GSJA \u2014 Jangan dipindahkan tanpa izin pengurus', W / 2, H - 12);

  // Export as JPEG with 85% quality — ~10x smaller than PNG
  return canvas.toDataURL('image/jpeg', 0.85);
}

