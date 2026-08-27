'use client';

import { useState, useRef } from 'react';
import QRCode from 'react-qr-code';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  qrValue: string;   // kode_barang
  subtitle?: string; // nama_kategori
}

export default function QRCodeModal({ isOpen, onClose, title, qrValue, subtitle }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownloadSticker = () => {
    const svgElement = qrRef.current?.querySelector('svg');
    if (!svgElement) return;

    setDownloading(true);

    // Serialize SVG → Blob URL
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const W = 600;
      const H = 750;
      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext('2d')!;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // Outer border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 12;
      ctx.strokeRect(10, 10, W - 20, H - 20);

      // Header bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(20, 20, W - 40, 100);

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SIM GSJA', W / 2, 62);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('STIKER LABEL INVENTARIS & ASET', W / 2, 92);

      // QR Code image
      const qrSize = 340;
      ctx.drawImage(img, (W - qrSize) / 2, 140, qrSize, qrSize);

      // Item name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      const displayTitle = title.length > 35 ? title.slice(0, 33) + '…' : title;
      ctx.fillText(displayTitle, W / 2, 535);

      if (subtitle) {
        ctx.fillStyle = '#64748b';
        ctx.font = '15px sans-serif';
        ctx.fillText(subtitle, W / 2, 558);
      }

      // Kode barang box
      ctx.fillStyle = '#eff6ff';
      ctx.fillRect(50, 575, W - 100, 55);
      ctx.strokeStyle = '#bfdbfe';
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 575, W - 100, 55);

      ctx.fillStyle = '#1d4ed8';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(qrValue, W / 2, 610);

      // Footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText('Properti Resmi GSJA — Jangan Dipindahkan Tanpa Izin Pengurus', W / 2, 675);

      // Trigger download
      const link = document.createElement('a');
      const safe = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      link.download = `STIKER_QR_${safe}_${qrValue}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      URL.revokeObjectURL(svgUrl);
      setDownloading(false);
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      setDownloading(false);
    };

    img.src = svgUrl;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrValue).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-blue-500 text-[20px]">qr_code_2</span>
            <h3 className="font-bold text-slate-900 text-base">QR Code Stiker Aset</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* QR Card */}
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center space-y-4 shadow-inner">
            <div
              ref={qrRef}
              className="w-52 h-52 bg-white p-3 rounded-2xl border-2 border-slate-300 shadow-md flex items-center justify-center"
            >
              <QRCode
                value={qrValue}
                size={180}
                fgColor="#0f172a"
                bgColor="#ffffff"
                style={{ width: '100%', height: 'auto' }}
              />
            </div>

            <div className="w-full">
              <h4 className="font-bold text-slate-900 text-base leading-tight">{title}</h4>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
              )}
              {/* Kode Barang chip */}
              <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-700">{qrValue}</span>
                <button
                  onClick={handleCopy}
                  className="p-0.5 text-blue-500 hover:text-blue-700 transition-colors"
                  title="Salin kode"
                >
                  <span className="material-icons-round text-[15px]">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleDownloadSticker}
              disabled={downloading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <span className="material-icons-round text-[18px]">
                {downloading ? 'hourglass_empty' : 'download'}
              </span>
              <span>{downloading ? 'Menyiapkan…' : 'Unduh Stiker Label (PNG)'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
