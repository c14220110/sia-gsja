'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  qrValue: string;
  subtitle?: string;
}

const QR_CONTAINER_ID = 'qr-code-download-target';

export default function QRCodeModal({ isOpen, onClose, title, qrValue, subtitle }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadSticker = async () => {
    setDownloading(true);
    try {
      // ── Canvas 800×800 ──────────────────────────────────────────────────────
      const S = 800;
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext('2d')!;

      // Background abu-abu lembut — beri "napas" visual
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, S, S);

      // Header strip atas (branding) — rounded top
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(0, 0, S, 80, [16, 16, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SIM GSJA', S / 2, 46);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText('LABEL ASET', S / 2, 67);

      // White card — QR + teks di atasnya
      const cardMargin = 28;
      const cardX = cardMargin;
      const cardY = 96;
      const cardW = S - cardMargin * 2;
      const cardH = S - cardY - cardMargin;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 16);
      ctx.fill();

      // QR Code — 420px, beri margin dari card edges
      const qrSize = 420;
      const qrX = (S - qrSize) / 2;
      const qrY = cardY + 24;

      const container = document.getElementById(QR_CONTAINER_ID);
      const svgEl = container?.querySelector('svg');
      if (svgEl) {
        const svgStr = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
            URL.revokeObjectURL(svgUrl);
            resolve();
          };
          img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(); };
          img.src = svgUrl;
        });
      }

      // Logo GSJA di tengah QR — 28% dari qrSize, aman untuk level H (max 30%)
      try {
        const logoSize = qrSize * 0.28;
        const logoX = qrX + (qrSize - logoSize) / 2;
        const logoY = qrY + (qrSize - logoSize) / 2;
        await new Promise<void>((resolve) => {
          const logoImg = new Image();
          logoImg.onload = () => {
            ctx.fillStyle = '#ffffff';
            const pad = 12;
            ctx.beginPath();
            ctx.roundRect(logoX - pad, logoY - pad, logoSize + pad * 2, logoSize + pad * 2, 12);
            ctx.fill();
            ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
            resolve();
          };
          logoImg.onerror = () => resolve();
          logoImg.src = '/assets/logo_gsja.png';
        });
      } catch (_) { /* logo opsional */ }

      // Divider antara QR dan teks
      const divY = qrY + qrSize + 20;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + 40, divY);
      ctx.lineTo(cardX + cardW - 40, divY);
      ctx.stroke();

      // Teks info aset
      let curY = divY + 32;

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title.length > 28 ? title.slice(0, 26) + '\u2026' : title, S / 2, curY);
      curY += 30;

      if (subtitle) {
        ctx.fillStyle = '#64748b';
        ctx.font = '20px sans-serif';
        ctx.fillText(subtitle, S / 2, curY);
        curY += 28;
      }

      // Kode — beri latar biru samar agar kelihatan seperti badge
      ctx.fillStyle = '#1e40af';
      ctx.font = 'bold 22px monospace';
      curY += 10;
      ctx.fillText(qrValue, S / 2, curY);

      // Footer di bawah canvas (di luar card)
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Properti Resmi GSJA \u2014 Jangan dipindahkan tanpa izin pengurus', S / 2, S - 14);

      const link = document.createElement('a');
      link.download = `STIKER_QR_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${qrValue}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error('Download error:', e); }
    finally { setDownloading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrValue).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden text-center" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-slate-600 text-[20px]">qr_code_2</span>
            <h3 className="font-bold text-slate-900 text-base">QR Code Label Aset</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col items-center space-y-4 shadow-inner">
            {/* QR Code persegi dengan logo di modal preview */}
            <div id={QR_CONTAINER_ID} className="relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm inline-flex items-center justify-center">
              <QRCode
                value={qrValue || ' '}
                size={180}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H"
              />
              {/* Logo GSJA overlay di tengah QR */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/logo_gsja.png"
                alt="GSJA"
                className="absolute w-14 h-14 bg-white rounded-lg p-1.5 shadow-sm"
                style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              />
            </div>
            <div className="w-full text-center">
              <h4 className="font-bold text-slate-900 text-base leading-tight">{title}</h4>
              {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}
              <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl inline-flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-700">{qrValue}</span>
                <button onClick={handleCopy} className="p-0.5 text-blue-500 hover:text-blue-700 transition-colors">
                  <span className="material-icons-round text-[15px]">{copied ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <button onClick={handleDownloadSticker} disabled={downloading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-colors">
              <span className="material-icons-round text-[18px]">{downloading ? 'hourglass_empty' : 'download'}</span>
              <span>{downloading ? 'Menyiapkan\u2026' : 'Unduh Stiker QR Code (PNG Square)'}</span>
            </button>
            <button onClick={onClose} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}
