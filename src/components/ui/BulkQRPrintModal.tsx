'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  generateBulkPDF,
  estimateTotalPages,
  PER_PAGE, STICKER_COLS, STICKER_ROWS,
  PER_PAGE_SM, STICKER_SM_COLS, STICKER_SM_ROWS,
  PER_PAGE_A3_SM, STICKER_A3_SM_COLS, STICKER_A3_SM_ROWS,
  STICKER_W_MM, STICKER_H_MM,
  STICKER_SM_W_MM, STICKER_SM_H_MM,
  type StickerPrintSize,
} from '@/lib/renderQRSticker';

export interface BulkQRItem {
  id: number;
  nama: string;
  kode_barang: string;
  nama_kategori?: string;
  sublokasi?: string;
  satelit?: string;
  copies: number;
}

interface BulkQRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BulkQRItem[];
  /** 'satuan_unik' = setiap item QR unik, copies locked 1, tidak bisa diubah */
  mode?: 'massal' | 'satuan_unik';
}

export default function BulkQRPrintModal({ isOpen, onClose, items: initialItems, mode = 'massal' }: BulkQRPrintModalProps) {
  const isSatuanUnik = mode === 'satuan_unik';
  const [items, setItems] = useState<BulkQRItem[]>(() =>
    initialItems.map(it => ({ ...it, copies: 1 }))
  );
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100

  // Size toggle — Normal (A4, 3×4=12/hal), Kecilkan 30% (A4, 5×6=30/hal), or A3 & 30% (A3, 7×8=56/hal)
  const [stickerSize, setStickerSize] = useState<StickerPrintSize>('normal');

  const isA3        = stickerSize === 'a3_small';
  const paperFormat = isA3 ? 'A3' : 'A4';
  const perPage     = isA3 ? PER_PAGE_A3_SM : (stickerSize === 'small' ? PER_PAGE_SM : PER_PAGE);
  const cols        = isA3 ? STICKER_A3_SM_COLS : (stickerSize === 'small' ? STICKER_SM_COLS : STICKER_COLS);
  const rows        = isA3 ? STICKER_A3_SM_ROWS : (stickerSize === 'small' ? STICKER_SM_ROWS : STICKER_ROWS);
  const wMm         = stickerSize === 'normal' ? STICKER_W_MM : STICKER_SM_W_MM;
  const hMm         = stickerSize === 'normal' ? STICKER_H_MM : STICKER_SM_H_MM;

  const totalStickers = items.reduce((s, it) => s + it.copies, 0);
  const totalPages    = estimateTotalPages(items, stickerSize);

  // Group summary by room/sublokasi
  const roomSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const room = it.sublokasi?.trim() || 'Tanpa Ruangan';
      map.set(room, (map.get(room) || 0) + it.copies);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [items]);

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
      const total = items.reduce((s, it) => s + it.copies, 0);
      let done = 0;

      const itemsWithProgress = items.map(it => ({
        title: it.nama,
        subtitle: it.nama_kategori,
        qrValue: it.kode_barang,
        sublokasi: it.sublokasi,
        satelit: it.satelit,
        copies: it.copies,
        onRendered: () => {
          done += it.copies;
          setProgress(Math.round((done / total) * 90));
        },
      }));

      const blob = await generateBulkPDF(itemsWithProgress, stickerSize);
      setProgress(100);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const names = items.length === 1 ? items[0].kode_barang : `${items.length}item`;
      const sizeTag = isA3 ? '_A3_MINI' : (stickerSize === 'small' ? '_MINI' : '');
      link.download = `STIKER_QR_BULK${sizeTag}_${names}_${totalStickers}stiker_${totalPages}hal_${paperFormat}.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      onClose();
    } catch (e: any) {
      console.error('Bulk PDF error:', e);
      alert(`Gagal membuat PDF: ${e?.message || 'Error tidak diketahui'}. Coba kurangi jumlah stiker atau gunakan ukuran "Kecilkan 30%".`);
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
              <span className="material-icons-round text-indigo-600 text-[20px]">
                {isSatuanUnik ? 'qr_code_2' : 'print'}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isSatuanUnik ? 'Cetak Semua QR Unik' : 'Cetak QR Massal'}
              </h3>
              <p className="text-xs text-slate-400">
                {isSatuanUnik
                  ? `${items.length} unit — masing-masing QR berbeda`
                  : `${items.length} barang dipilih`
                }
              </p>
            </div>
          </div>
          {!generating && (
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
              <span className="material-icons-round text-[20px]">close</span>
            </button>
          )}
        </div>

        {/* ── Ukuran Stiker & Kertas Toggle ── */}
        <div className="px-6 pt-4 pb-0 flex-shrink-0">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Ukuran Stiker & Kertas</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Normal A4 */}
            <button
              type="button"
              onClick={() => setStickerSize('normal')}
              className={`rounded-xl border-2 px-3.5 py-3 text-left transition-all ${
                stickerSize === 'normal'
                  ? 'border-indigo-500 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-bold text-sm ${stickerSize === 'normal' ? 'text-indigo-700' : 'text-slate-700'}`}>
                  Normal
                </p>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 leading-none">A4</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {STICKER_W_MM} × {STICKER_H_MM} mm
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                3×4 / hal (12 stiker)
              </p>
            </button>

            {/* Kecilkan 30% A4 */}
            <button
              type="button"
              onClick={() => setStickerSize('small')}
              className={`rounded-xl border-2 px-3.5 py-3 text-left transition-all relative ${
                stickerSize === 'small'
                  ? 'border-indigo-500 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-bold text-sm ${stickerSize === 'small' ? 'text-indigo-700' : 'text-slate-700'}`}>
                  Kecilkan 30%
                </p>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 leading-none">A4 MINI</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {STICKER_SM_W_MM} × {STICKER_SM_H_MM} mm
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                5×6 / hal (30 stiker)
              </p>
            </button>

            {/* A3 & Ukuran 30% (NEW!) */}
            <button
              type="button"
              onClick={() => setStickerSize('a3_small')}
              className={`rounded-xl border-2 px-3.5 py-3 text-left transition-all relative ${
                stickerSize === 'a3_small'
                  ? 'border-indigo-500 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-bold text-sm ${stickerSize === 'a3_small' ? 'text-indigo-700' : 'text-slate-700'}`}>
                  A3 & 30%
                </p>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 leading-none">A3 JUMBO</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {STICKER_SM_W_MM} × {STICKER_SM_H_MM} mm
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                7×8 / hal (56 stiker A3)
              </p>
            </button>
          </div>
        </div>

        {/* ── Top summary strip ── */}
        <div className="px-6 py-3 mx-0 mt-3 bg-indigo-50/80 border-y border-indigo-100 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="text-indigo-700 font-semibold">
              Total: <strong className="text-indigo-900 text-sm">{totalStickers}</strong> stiker
            </span>
            <span className="text-indigo-400">·</span>
            <span className="text-indigo-700 font-semibold">
              <strong className="text-indigo-900 text-sm">{totalPages}</strong> halaman PDF {paperFormat}
            </span>
            <span className="text-indigo-400">·</span>
            <span className="text-indigo-600 font-medium">layout {cols}×{rows}</span>
            {isSatuanUnik && (
              <>
                <span className="text-indigo-400">·</span>
                <span className="text-indigo-600 font-bold flex items-center gap-1">
                  <span className="material-icons-round text-[12px]">verified</span>
                  QR Unik per Unit
                </span>
              </>
            )}
          </div>
          {/* Set all copies shortcuts — hanya untuk mode massal */}
          {!isSatuanUnik && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
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
          )}
        </div>

        {/* ── Room filter summary strip (jika ada ruangan terdeteksi) ── */}
        {roomSummary.length > 0 && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 flex-wrap text-[11px] text-slate-500 flex-shrink-0">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <span className="material-icons-round text-[14px] text-indigo-500">meeting_room</span>
              Ruangan:
            </span>
            {roomSummary.map((r, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                {r.name} <span className="text-indigo-600 font-bold">({r.count})</span>
              </span>
            ))}
          </div>
        )}

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
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm truncate">{item.nama}</p>
                    {item.sublokasi && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium flex-shrink-0">
                        📍 {item.sublokasi}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-slate-400">{item.kode_barang}</span>
                    {item.nama_kategori && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{item.nama_kategori}</span>
                    )}
                  </div>
                </div>

                {/* Per-item copy count — editable for massal, locked for satuan_unik */}
                {isSatuanUnik ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                      1 stiker unik
                    </span>
                  </div>
                ) : (
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
                )}

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
                ? 'Menyiapkan PDF…'
                : `Unduh PDF — ${totalStickers} Stiker (${totalPages} Hal. ${paperFormat})`
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
