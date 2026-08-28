'use client';

import { useState, useRef, useEffect } from 'react';

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  qrValue: string;
  subtitle?: string;
}

function renderBarcode(svgEl: SVGSVGElement | null, value: string) {
  if (!svgEl || !value) return;
  import('jsbarcode').then((mod) => {
    const JsBarcode = (mod as any).default ?? mod;
    try {
      JsBarcode(svgEl, value, {
        format: 'CODE128',
        lineColor: '#0f172a',
        width: 2,
        height: 60,
        displayValue: true,
        font: 'monospace',
        fontSize: 13,
        textMargin: 4,
        margin: 8,
        background: '#ffffff',
      });
    } catch (e) { console.error('JsBarcode error:', e); }
  });
}

export default function QRCodeModal({ isOpen, onClose, title, qrValue, subtitle }: BarcodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (isOpen && svgRef.current) {
      const t = setTimeout(() => renderBarcode(svgRef.current, qrValue), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen, qrValue]);

  const handleDownloadSticker = async () => {
    setDownloading(true);
    try {
      const mod = await import('jsbarcode');
      const JsBarcode = (mod as any).default ?? mod;
      const W = 900, H = 340;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, W - 16, H - 16);

      // Left header strip
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(18, 18, 120, H - 36);
      ctx.save();
      ctx.translate(78, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SIM GSJA', 0, 0);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText('LABEL ASET', 0, 22);
      ctx.restore();

      const CX = 158;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(title.length > 50 ? title.slice(0, 48) + '…' : title, CX, 55);
      if (subtitle) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        ctx.fillText(subtitle, CX, 78);
      }

      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(tempSvg, qrValue, {
        format: 'CODE128', lineColor: '#0f172a',
        width: 2.5, height: 80, displayValue: true,
        font: 'monospace', fontSize: 14, textMargin: 4, margin: 0, background: '#ffffff',
      });
      const svgStr = new XMLSerializer().serializeToString(tempSvg);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const bW = Math.min(img.width, W - CX - 20);
          const bH = (img.height / img.width) * bW;
          ctx.drawImage(img, CX, 95, bW, bH);
          URL.revokeObjectURL(svgUrl);
          resolve();
        };
        img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(); };
        img.src = svgUrl;
      });

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Properti Resmi GSJA — Jangan dipindahkan tanpa izin pengurus', CX, H - 22);

      const link = document.createElement('a');
      link.download = `STIKER_BARCODE_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${qrValue}.png`;
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
            <span className="material-icons-round text-slate-600 text-[20px]">barcode_reader</span>
            <h3 className="font-bold text-slate-900 text-base">Barcode Label Aset</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col items-center space-y-4 shadow-inner">
            <div className="w-full bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
              <svg ref={svgRef} className="w-full max-w-sm" />
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
              <span>{downloading ? 'Menyiapkan…' : 'Unduh Stiker Barcode (PNG Landscape)'}</span>
            </button>
            <button onClick={onClose} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}
