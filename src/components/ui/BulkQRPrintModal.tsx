'use client';

import { useState, useCallback, useEffect } from 'react';
import { generateBulkPDF, PER_PAGE, STICKER_COLS, STICKER_ROWS } from '@/lib/renderQRSticker';

export interface BulkQRItem {
  id: number;
  nama: string;
  kode_barang: string;
  nama_kategori?: string;
  copies: number;
}

interface BulkQRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BulkQRItem[];
}

export default function BulkQRPrintModal({ isOpen, onClose, items: initialItems }: BulkQRPrintModalProps) {
  const [items, setItems] = useState<BulkQRItem[]>(() =>
    initialItems.map(it => ({ ...it, copies: 1 }))
  );
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100

  // Sync items when prop changes (new selection)
  // (handled by parent unmount/remount via key)

  const totalStickers = items.reduce((s, it) => s + it.copies, 0);
  const totalPages = Math.ceil(totalStickers / PER_PAGE);

  const setCopies = useCallback((id: number, copies: number) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, copies: Math.max(1, Math.min(500, copies)) } : it));
  }, []);

  const removeItem = useCallback((id: number) => {
    setItems(prev => prev.filter(it => it.id !== id));
  }, []);

  const setAllCopies = (n: number) => {
    setItems(prev => prev.map(it => ({ ...it, copies: n })));
  };

  const handleGenerate = async () => {
    if (items.length === 0) return;
    setGenerating(true);
    setProgress(0);
    try {
      // Progress simulation — each item render ~equal weight
      const total = items.reduce((s, it) => s + it.copies, 0);
      let done = 0;

      // Generate PDF with progress update via wrapper
      const itemsWithProgress = items.map(it => ({
        title: it.nama,
        subtitle: it.nama_kategori,
        qrValue: it.kode_barang,
        copies: it.copies,
        onRendered: () => {
          done += it.copies;
          setProgress(Math.round((done / total) * 90));
        },
      }));

      const blob = await generateBulkPDF(itemsWithProgress);
      setProgress(100);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const names = items.length === 1 ? items[0].kode_barang : `${items.length}item`;
      link.download = `STIKER_QR_BULK_${names}_${totalStickers}stiker_${totalPages}hal.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      onClose();
    } catch (e) {
      console.error('Bulk PDF error:', e);
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  // ── Body scroll lock ──
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
      onClick={generating ? undefined : onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <span className="material-icons-round text-indigo-600 text-[20px]">print</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Cetak QR Massal</h3>
              <p className="text-xs text-slate-400">{items.length} barang dipilih</p>
            </div>
          </div>
          {!generating && (
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
              <span className="material-icons-round text-[20px]">close</span>
            </button>
          )}
        </div>

        {/* ── Top summary strip ── */}
        <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-indigo-700 font-semibold">
              Total: <strong className="text-indigo-900 text-sm">{totalStickers}</strong> stiker
            </span>
            <span className="text-indigo-400">·</span>
            <span className="text-indigo-700 font-semibold">
              <strong className="text-indigo-900 text-sm">{totalPages}</strong> halaman PDF A4
            </span>
            <span className="text-indigo-400">·</span>
            <span className="text-indigo-500">layout {STICKER_COLS}×{STICKER_ROWS}</span>
          </div>
          {/* Set all copies shortcuts */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-indigo-500 font-semibold">Semua:</span>
            {[1, 5, 10].map(n => (
              <button
                key={n}
                onClick={() => setAllCopies(n)}
                className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                ×{n}
              </button>
            ))}
          </div>
        </div>

        {/* ── Item list ── */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-icons-round text-4xl text-slate-200 mb-2">inventory_2</span>
              <p className="text-sm text-slate-400">Tidak ada barang dipilih.</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors group">
                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{item.nama}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-slate-400">{item.kode_barang}</span>
                    {item.nama_kategori && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{item.nama_kategori}</span>
                    )}
                  </div>
                </div>

                {/* Per-item copy count */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setCopies(item.id, item.copies - 1)}
                    disabled={item.copies <= 1}
                    className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors flex items-center justify-center"
                  >
                    <span className="material-icons-round text-[14px]">remove</span>
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={item.copies}
                    onChange={(e) => setCopies(item.id, parseInt(e.target.value) || 1)}
                    className="w-14 h-7 text-center text-xs font-bold text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    onClick={() => setCopies(item.id, item.copies + 1)}
                    disabled={item.copies >= 500}
                    className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors flex items-center justify-center"
                  >
                    <span className="material-icons-round text-[14px]">add</span>
                  </button>
                  <span className="text-[10px] text-slate-400 ml-1 w-12">stiker</span>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                  title="Hapus dari daftar cetak"
                >
                  <span className="material-icons-round text-[16px]">close</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── Progress bar (saat generating) ── */}
        {generating && (
          <div className="px-6 py-3 bg-indigo-50 border-t border-indigo-100 flex-shrink-0">
            <div className="flex items-center justify-between text-xs text-indigo-700 mb-1.5">
              <span className="font-semibold">Menyiapkan PDF&hellip;</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Footer actions ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={generating}
            className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || items.length === 0 || totalStickers === 0}
            className="flex-[2] py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
          >
            <span className="material-icons-round text-[18px]">{generating ? 'hourglass_empty' : 'print'}</span>
            <span>
              {generating
                ? 'Menyiapkan PDF\u2026'
                : `Unduh PDF \u2014 ${totalStickers} Stiker (${totalPages} Hal.)`
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
