'use client';

import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { renderStickerCanvas, generateBulkPDF, PER_PAGE, STICKER_COLS, STICKER_ROWS } from '@/lib/renderQRSticker';

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
  const [activeTab, setActiveTab] = useState<'png' | 'pdf'>('png');
  const [copyCount, setCopyCount] = useState(1);

  const handleDownloadPNG = async () => {
    setDownloading(true);
    try {
      const dataUrl = await renderStickerCanvas({ title, subtitle, qrValue });
      const link = document.createElement('a');
      link.download = `STIKER_QR_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${qrValue}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) { console.error('PNG download error:', e); }
    finally { setDownloading(false); }
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const blob = await generateBulkPDF([{ title, subtitle, qrValue, copies: copyCount }]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const pages = Math.ceil(copyCount / PER_PAGE);
      link.download = `STIKER_QR_${qrValue}_${copyCount}stiker_${pages}hal.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('PDF download error:', e); }
    finally { setDownloading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrValue).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pages = Math.ceil(copyCount / PER_PAGE);

  // ── Body scroll lock — prevent page scroll when modal is open ──
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header — pinned ── */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-slate-600 text-[20px]">qr_code_2</span>
            <h3 className="font-bold text-slate-900 text-base">QR Code Label Aset</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* ── QR Preview ── */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col items-center space-y-4 shadow-inner">
            <div id={QR_CONTAINER_ID} className="relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm inline-flex items-center justify-center">
              <QRCode value={qrValue || ' '} size={180} bgColor="#ffffff" fgColor="#0f172a" level="H" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo_gsja.png" alt="GSJA" className="absolute w-14 h-14 bg-white rounded-lg p-1.5 shadow-sm" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
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

          {/* ── Format Selector ── */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide text-left">Format Unduhan</p>
            <div className="grid grid-cols-2 gap-2">
              {/* PNG */}
              <button onClick={() => setActiveTab('png')} className={`p-4 rounded-xl border-2 text-left transition-all duration-150 ${activeTab === 'png' ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeTab === 'png' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    <span className={`material-icons-round text-[16px] ${activeTab === 'png' ? 'text-blue-600' : 'text-slate-400'}`}>image</span>
                  </div>
                  <span className={`font-bold text-sm ${activeTab === 'png' ? 'text-blue-800' : 'text-slate-700'}`}>PNG Digital</span>
                  {activeTab === 'png' && <span className="ml-auto w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0"><span className="material-icons-round text-white text-[12px]">check</span></span>}
                </div>
                <p className={`text-[11px] leading-relaxed ${activeTab === 'png' ? 'text-blue-600' : 'text-slate-400'}`}>Untuk digital, WhatsApp, arsip. 1 file.</p>
              </button>

              {/* PDF */}
              <button onClick={() => setActiveTab('pdf')} className={`p-4 rounded-xl border-2 text-left transition-all duration-150 ${activeTab === 'pdf' ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${activeTab === 'pdf' ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                    <span className={`material-icons-round text-[16px] ${activeTab === 'pdf' ? 'text-indigo-600' : 'text-slate-400'}`}>print</span>
                  </div>
                  <span className={`font-bold text-sm ${activeTab === 'pdf' ? 'text-indigo-800' : 'text-slate-700'}`}>PDF Cetak</span>
                  {activeTab === 'pdf' && <span className="ml-auto w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0"><span className="material-icons-round text-white text-[12px]">check</span></span>}
                </div>
                <p className={`text-[11px] leading-relaxed ${activeTab === 'pdf' ? 'text-indigo-600' : 'text-slate-400'}`}>Fisik 5×6.25 cm, layout A4. Cetak banyak sekaligus.</p>
              </button>
            </div>

            {/* PDF Options Panel */}
            {activeTab === 'pdf' && (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-indigo-800">Jumlah Stiker</p>
                    <p className="text-[11px] text-indigo-400 mt-0.5">Maks 500 · {PER_PAGE} stiker/halaman A4</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setCopyCount(c => Math.max(1, c - 1))} className="w-8 h-8 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center">
                      <span className="material-icons-round text-[16px]">remove</span>
                    </button>
                    <input type="number" min={1} max={500} value={copyCount} onChange={(e) => setCopyCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))} className="w-16 h-8 text-center text-sm font-bold text-indigo-800 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    <button onClick={() => setCopyCount(c => Math.min(500, c + 1))} className="w-8 h-8 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center">
                      <span className="material-icons-round text-[16px]">add</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-indigo-500 font-semibold">Cepat:</span>
                  {[1, 12, 24, 50, 100].map(n => (
                    <button key={n} onClick={() => setCopyCount(n)} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${copyCount === n ? 'bg-indigo-600 text-white shadow-sm scale-105' : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}>{n}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 bg-white/80 px-3 py-2 rounded-lg border border-indigo-100">
                  <span className="material-icons-round text-[14px] text-indigo-400">info</span>
                  <span className="text-xs text-indigo-700">
                    <strong className="text-indigo-900">{copyCount}</strong> stiker · <strong className="text-indigo-900">{pages}</strong> halaman PDF A4 · <span className="text-indigo-400">layout {STICKER_COLS}×{STICKER_ROWS}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Action Buttons ── */}
          <div className="space-y-2">
            <button
              onClick={activeTab === 'png' ? handleDownloadPNG : handleDownloadPDF}
              disabled={downloading}
              className={`w-full py-3 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] ${activeTab === 'pdf' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'}`}
            >
              <span className="material-icons-round text-[18px]">{downloading ? 'hourglass_empty' : activeTab === 'pdf' ? 'print' : 'download'}</span>
              <span>{downloading ? 'Menyiapkan\u2026' : activeTab === 'pdf' ? `Unduh PDF \u2014 ${copyCount} Stiker (${pages} Hal.)` : 'Unduh PNG Digital'}</span>
            </button>
            <button onClick={onClose} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}
