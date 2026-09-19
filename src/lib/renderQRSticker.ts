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

export const STICKER_W_MM = 50;    // physical width mm (5 cm)
export const STICKER_H_MM = 62.5;  // physical height mm (6.25 cm)
export const STICKER_COLS = 3;     // columns per A4 page
export const STICKER_ROWS = 4;     // rows per A4 page
export const PER_PAGE = STICKER_COLS * STICKER_ROWS; // 12 per A4

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
 * Generates a PDF A4 (portrait) containing stickers for multiple items.
 * Items appear in order, each with `copies` repetitions before moving to the next.
 * Layout: 3 cols × 4 rows = 12 stickers per A4 page.
 *
 * @param items   Array of sticker definitions with per-item copy count and optional progress callback
 * @returns       Blob of the generated PDF
 */
export async function generateBulkPDF(
  items: Array<StickerParams & { copies: number; onRendered?: () => void }>
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');

  const sW = STICKER_W_MM;
  const sH = STICKER_H_MM;
  const colGap = 5;
  const rowGap = 4;
  const totalW = STICKER_COLS * sW + (STICKER_COLS - 1) * colGap;
  const totalH = STICKER_ROWS * sH + (STICKER_ROWS - 1) * rowGap;
  const marginX = (210 - totalW) / 2;
  const marginY = (297 - totalH) / 2;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let stickerIndex = 0; // global position counter across all items

  for (const item of items) {
    // Pre-render sticker canvas for this item
    const dataUrl = await renderStickerCanvas(item);
    const n = Math.max(1, item.copies);

    for (let c = 0; c < n; c++) {
      if (stickerIndex > 0 && stickerIndex % PER_PAGE === 0) pdf.addPage();
      const pos = stickerIndex % PER_PAGE;
      const col = pos % STICKER_COLS;
      const row = Math.floor(pos / STICKER_COLS);
      const x = marginX + col * (sW + colGap);
      const y = marginY + row * (sH + rowGap);

      pdf.addImage(dataUrl, 'PNG', x, y, sW, sH);

      // Dashed crop marks
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.2);
      pdf.setLineDashPattern([1, 1.5], 0);
      pdf.rect(x, y, sW, sH);
      pdf.setLineDashPattern([], 0);

      stickerIndex++;
    }
    // Notify caller that this item is fully rendered
    item.onRendered?.();
  }

  return pdf.output('blob');
}
