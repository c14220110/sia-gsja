'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAlkitabDarkMode } from '../../AlkitabContext';

interface Ayat {
  nomor: number;
  teks: string;
}

interface PasalData {
  kitab: string;
  nama_kitab: string;
  singkatan: string;
  pasal: number;
  ayat: Ayat[];
}

interface KitabInfo {
  id: string;
  nama: string;
  singkatan: string;
  pasal: number;
  perjanjian: 'lama' | 'baru';
}

type FontSize = 'sm' | 'md' | 'lg' | 'xl';

const FONT_SIZES: Record<FontSize, string> = {
  sm: 'text-[13px] leading-[22px]',
  md: 'text-[15px] leading-[26px]',
  lg: 'text-[18px] leading-[30px]',
  xl: 'text-[22px] leading-[36px]',
};

const FONT_LABELS: Record<FontSize, string> = {
  sm: 'Kecil',
  md: 'Sedang',
  lg: 'Besar',
  xl: 'Sangat Besar',
};

export default function BacaPasalPage() {
  const router = useRouter();
  const params = useParams();
  const kitabId = params.kitab as string;
  const pasalNum = parseInt(params.pasal as string, 10);
  const { isDark, toggleDark } = useAlkitabDarkMode();

  const [data, setData] = useState<PasalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPasal, setTotalPasal] = useState(0);
  const [kitabList, setKitabList] = useState<KitabInfo[]>([]);
  const [fontSize, setFontSize] = useState<FontSize>('md');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAyat, setSelectedAyat] = useState<number | null>(null);
  const [flashingAyat, setFlashingAyat] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Geser layar buat pindah pasal sebelumnya/selanjutnya
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load font size preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('alkitab_font_size');
      if (saved && (saved === 'sm' || saved === 'md' || saved === 'lg')) {
        setFontSize(saved as FontSize);
      }
    } catch {}
  }, []);

  // Tarik data pasalnya
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setSelectedAyat(null);
      try {
        const [pasalRes, metaRes] = await Promise.all([
          fetch(`/alkitab/${kitabId}/${pasalNum}.json`),
          fetch('/alkitab/meta.json'),
        ]);

        if (pasalRes.ok) {
          const pasalData: PasalData = await pasalRes.json();
          setData(pasalData);
        }

        if (metaRes.ok) {
          const metaData = await metaRes.json();
          setKitabList(metaData.kitab);
          const currentKitab = metaData.kitab.find((k: KitabInfo) => k.id === kitabId);
          if (currentKitab) setTotalPasal(currentKitab.pasal);
        }

        // Save last read
        try {
          const metaData2 = await (await fetch('/alkitab/meta.json')).json();
          const currentKitab = metaData2.kitab.find((k: KitabInfo) => k.id === kitabId);
          if (currentKitab) {
            localStorage.setItem('alkitab_last_read', JSON.stringify({
              kitab: kitabId,
              pasal: pasalNum,
              nama: currentKitab.nama,
            }));
          }
        } catch {}
      } catch (err) {
        console.error('Failed to load chapter:', err);
      } finally {
        setIsLoading(false);

        // Gulung layar ke ayat tertentu kalau ada hash di URL (misal #ayat-16)
        setTimeout(() => {
          const hash = window.location.hash;
          if (hash && hash.startsWith('#ayat-')) {
            const verseNumStr = hash.replace('#ayat-', '');
            const verseNum = parseInt(verseNumStr, 10);
            const el = document.getElementById(`ayat-${verseNumStr}`);
            if (el && !isNaN(verseNum)) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setFlashingAyat(verseNum);
              setTimeout(() => setFlashingAyat(null), 2000);
            }
          } else if (contentRef.current) {
            contentRef.current.scrollTo(0, 0);
          }
        }, 100);
      }
    };
    fetchData();
  }, [kitabId, pasalNum]);

  const changeFontSize = (size: FontSize) => {
    setFontSize(size);
    try { localStorage.setItem('alkitab_font_size', size); } catch {}
  };

  // Navigation helpers
  const getNextChapter = useCallback(() => {
    if (pasalNum < totalPasal) {
      return `/alkitab/${kitabId}/${pasalNum + 1}`;
    }
    // Next book
    const currentIdx = kitabList.findIndex(k => k.id === kitabId);
    if (currentIdx < kitabList.length - 1) {
      return `/alkitab/${kitabList[currentIdx + 1].id}/1`;
    }
    return null;
  }, [pasalNum, totalPasal, kitabId, kitabList]);

  const getPrevChapter = useCallback(() => {
    if (pasalNum > 1) {
      return `/alkitab/${kitabId}/${pasalNum - 1}`;
    }
    // Prev book
    const currentIdx = kitabList.findIndex(k => k.id === kitabId);
    if (currentIdx > 0) {
      const prevBook = kitabList[currentIdx - 1];
      return `/alkitab/${prevBook.id}/${prevBook.pasal}`;
    }
    return null;
  }, [pasalNum, kitabId, kitabList]);

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > 80) {
      if (diff > 0) {
        // Swipe left → next
        const next = getNextChapter();
        if (next) router.push(next);
      } else {
        // Swipe right → prev
        const prev = getPrevChapter();
        if (prev) router.push(prev);
      }
    }
  };

  const handleAyatTap = (nomor: number) => {
    setSelectedAyat(selectedAyat === nomor ? null : nomor);
  };

  const handleCopyAyat = (ayat: Ayat) => {
    const text = `${data?.nama_kitab} ${pasalNum}:${ayat.nomor}\n"${ayat.teks}"\n— Alkitab TB`;
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const prevUrl = getPrevChapter();
  const nextUrl = getNextChapter();

  return (
    <div className={`min-h-screen flex flex-col pb-6 transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Header */}
      <div className={`w-full px-4 pt-4 pb-3 sticky top-0 z-20 border-b flex items-center gap-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <button onClick={() => router.back()} className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
          <span className="material-icons-round text-xl">arrow_back</span>
        </button>

        <div className="flex-1 min-w-0 flex flex-col items-center">
          <h1 className={`font-black text-base tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {data?.nama_kitab || '...'} {pasalNum}
          </h1>
          <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Terjemahan Baru</span>
        </div>

        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={toggleDark}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform ${isDark ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}
          >
            <span className="material-icons-round text-lg">{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <span className="material-icons-round text-lg">text_fields</span>
          </button>
        </div>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div className={`w-full px-5 py-3 border-b flex items-center gap-2 overflow-x-auto hide-scrollbar animate-in slide-in-from-top ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <span className={`text-xs font-medium mr-2 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ukuran Teks:</span>
          {(['sm', 'md', 'lg', 'xl'] as FontSize[]).map(size => (
            <button
              key={size}
              onClick={() => changeFontSize(size)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                fontSize === size
                  ? 'bg-blue-500 text-white shadow-sm'
                  : (isDark ? 'bg-slate-700 text-slate-300 active:bg-slate-600' : 'bg-slate-100 text-slate-600 active:bg-slate-200')
              }`}
            >
              {FONT_LABELS[size]}
            </button>
          ))}
        </div>
      )}

      {/* Copy feedback toast */}
      {copyFeedback && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-top">
          <span className="material-icons-round text-sm mr-1 align-middle">check</span>
          Ayat disalin!
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Loading */}
        {isLoading && (
          <div className="px-6 py-6 flex flex-col gap-3">
            {[...Array(15)].map((_, i) => (
              <div key={i} className={`h-5 rounded-lg animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        )}

        {/* Verses */}
        {!isLoading && data && (
          <div className="px-6 py-5">
            <div className="flex flex-col gap-0">
              {data.ayat.map((ayat) => (
                <div
                  key={ayat.nomor}
                  id={`ayat-${ayat.nomor}`}
                  onClick={() => handleAyatTap(ayat.nomor)}
                  className={`py-1 px-1 -mx-1 rounded-lg transition-colors cursor-pointer ${
                    selectedAyat === ayat.nomor 
                      ? (isDark ? 'bg-slate-800/80' : 'bg-amber-50') 
                      : flashingAyat === ayat.nomor
                        ? (isDark ? 'bg-slate-700' : 'bg-amber-100')
                        : ''
                  }`}
                >
                  <span className={`${FONT_SIZES[fontSize]} select-text ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <sup className={`text-[10px] font-bold mr-1 select-none ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>{ayat.nomor}</sup>
                    {ayat.teks}{' '}
                  </span>

                  {/* Action buttons when verse is selected */}
                  {selectedAyat === ayat.nomor && (
                    <div className="flex items-center gap-2 mt-1.5 mb-1 animate-in fade-in">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyAyat(ayat); }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold active:scale-95 transition-transform ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}
                      >
                        <span className="material-icons-round text-[14px]">content_copy</span>
                        Salin
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const text = `${data.nama_kitab} ${pasalNum}:${ayat.nomor}\n"${ayat.teks}"\n— Alkitab TB`;
                          if (navigator.share) {
                            navigator.share({ text });
                          } else {
                            navigator.clipboard.writeText(text);
                            setCopyFeedback(true);
                            setTimeout(() => setCopyFeedback(false), 2000);
                          }
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold active:scale-95 transition-transform ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}
                      >
                        <span className="material-icons-round text-[14px]">share</span>
                        Bagikan
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Chapter navigation */}
            <div className={`flex items-center justify-between mt-8 pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              {prevUrl ? (
                <Link
                  href={prevUrl}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl active:scale-95 transition-transform ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                >
                  <span className={`material-icons-round text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>chevron_left</span>
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Sebelumnya</span>
                </Link>
              ) : (
                <div />
              )}

              <Link
                href={`/alkitab/${kitabId}`}
                className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
              >
                <span className={`material-icons-round text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>grid_view</span>
              </Link>

              {nextUrl ? (
                <Link
                  href={nextUrl}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-500 text-white rounded-xl active:scale-95 transition-transform shadow-sm shadow-blue-500/20"
                >
                  <span className="text-xs font-bold">Selanjutnya</span>
                  <span className="material-icons-round text-lg">chevron_right</span>
                </Link>
              ) : (
                <div className={`px-4 py-2.5 rounded-xl ${isDark ? 'bg-emerald-900/30' : 'bg-emerald-50'}`}>
                  <span className={`text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>✨ Selesai</span>
                </div>
              )}
            </div>

            {/* Swipe hint */}
            <p className="text-center text-[10px] text-slate-400 mt-4 font-medium">
              <span className="material-icons-round text-[12px] align-middle">swipe</span>{' '}
              Geser kiri/kanan untuk pindah pasal
            </p>
          </div>
        )}

        {/* Error */}
        {!isLoading && !data && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <span className={`material-icons-round text-4xl mb-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>cloud_off</span>
            <span className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pasal tidak ditemukan</span>
            <span className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Data belum tersedia atau tidak ada koneksi</span>
            <Link
              href={`/alkitab/${kitabId}`}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform"
            >
              Kembali ke Daftar Pasal
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
