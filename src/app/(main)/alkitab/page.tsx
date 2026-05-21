'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useAlkitabDarkMode } from './AlkitabContext';

interface KitabInfo {
  id: string;
  nama: string;
  singkatan: string;
  pasal: number;
  perjanjian: 'lama' | 'baru';
}

interface MetaData {
  terjemahan: string;
  versi: string;
  kitab: KitabInfo[];
}

export default function AlkitabPage() {
  const router = useRouter();
  const { isDark, toggleDark } = useAlkitabDarkMode();
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRead, setLastRead] = useState<{ kitab: string; pasal: number; nama: string } | null>(null);

  // Alphabet sidebar state
  const [isDragging, setIsDragging] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Numpad modal state
  const [selectedKitab, setSelectedKitab] = useState<KitabInfo | null>(null);
  const [numpadInput, setNumpadInput] = useState('');
  const [numpadError, setNumpadError] = useState('');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchMeta = async () => {
      try {
        const res = await fetch('/alkitab/meta.json');
        if (res.ok) {
          const data: MetaData = await res.json();
          setMeta(data);
        }
      } catch (err) {
        console.error('Failed to load meta:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeta();

    try {
      const saved = localStorage.getItem('alkitab_last_read');
      if (saved) setLastRead(JSON.parse(saved));
    } catch {}
  }, []);

  // Sort and filter books
  const sortedKitab = useMemo(() => {
    if (!meta) return [];
    let books = [...meta.kitab];
    books.sort((a, b) => {
      const nameA = a.nama.replace(/^\d+\s*/, '').trim();
      const nameB = b.nama.replace(/^\d+\s*/, '').trim();
      const cmp = nameA.localeCompare(nameB, 'id');
      if (cmp !== 0) return cmp;
      return a.nama.localeCompare(b.nama, 'id');
    });
    
    if (searchQuery) {
      books = books.filter(k =>
        k.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.singkatan.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return books;
  }, [meta, searchQuery]);

  // Available letters for sidebar
  const availableLetters = useMemo(() => {
    const letters = new Set(sortedKitab.map(k => {
      const sortableName = k.nama.replace(/^\d+\s*/, '').trim();
      return sortableName.charAt(0).toUpperCase();
    }));
    return Array.from(letters).sort((a, b) => a.localeCompare(b));
  }, [sortedKitab]);

  // Group books by first letter for section headers
  const groupedKitab = useMemo(() => {
    const groups: Record<string, KitabInfo[]> = {};
    sortedKitab.forEach(k => {
      const sortableName = k.nama.replace(/^\d+\s*/, '').trim();
      const key = sortableName.charAt(0).toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(k);
    });
    return groups;
  }, [sortedKitab]);

  // Alphabet sidebar touch handler
  const handleAlphabetTouch = useCallback((clientY: number) => {
    if (!sidebarRef.current) return;
    const rect = sidebarRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, y / rect.height));
    const idx = Math.floor(ratio * availableLetters.length);
    const letter = availableLetters[Math.min(idx, availableLetters.length - 1)];
    if (letter && letter !== activeLetter) {
      setActiveLetter(letter);
      // Scroll to section
      const el = letterRefs.current[letter];
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }
  }, [availableLetters, activeLetter]);

  const handleSidebarTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleAlphabetTouch(e.touches[0].clientY);
  };

  const handleSidebarTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    handleAlphabetTouch(e.touches[0].clientY);
  };

  const handleSidebarTouchEnd = () => {
    setIsDragging(false);
    setTimeout(() => setActiveLetter(null), 300);
  };



  // Numpad handlers
  const handleBookTap = (kitab: KitabInfo) => {
    setSelectedKitab(kitab);
    setNumpadInput('');
    setNumpadError('');
  };

  const handleNumpadPress = (key: string) => {
    setNumpadError('');
    if (key === 'C') {
      setNumpadInput('');
      return;
    }
    if (key === ':') {
      if (numpadInput.includes(':')) return; // already has colon
      if (numpadInput === '') return; // can't start with colon
      setNumpadInput(prev => prev + ':');
      return;
    }
    // Numbers
    if (numpadInput.length >= 7) return; // limit length
    setNumpadInput(prev => prev + key);
  };

  const handleNumpadBackspace = () => {
    setNumpadInput(prev => prev.slice(0, -1));
    setNumpadError('');
  };

  const handleNumpadDone = () => {
    if (!selectedKitab || !numpadInput) return;

    const parts = numpadInput.split(':');
    const pasal = parseInt(parts[0], 10);

    if (isNaN(pasal) || pasal < 1 || pasal > selectedKitab.pasal) {
      setNumpadError(`Pasal 1-${selectedKitab.pasal}`);
      return;
    }

    // Navigate — if has verse part, add as hash
    if (parts[1]) {
      router.push(`/alkitab/${selectedKitab.id}/${pasal}#ayat-${parts[1]}`);
    } else {
      router.push(`/alkitab/${selectedKitab.id}/${pasal}`);
    }
    setSelectedKitab(null);
  };

  const handleNumpadQuickChapter = (pasal: number) => {
    if (!selectedKitab) return;
    router.push(`/alkitab/${selectedKitab.id}/${pasal}`);
    setSelectedKitab(null);
  };

  return (
    <div className={`min-h-screen flex flex-col pb-6 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`w-full px-5 pt-5 pb-3 sticky top-0 z-20 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.push('/')} className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            <span className="material-icons-round text-xl">arrow_back</span>
          </button>
          <h1 className={`font-black text-xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Alkitab</h1>
          
          <button onClick={toggleDark} className={`ml-auto w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0 ${isDark ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}>
            <span className="material-icons-round text-xl">{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <span className="material-icons-round text-slate-400 text-xl absolute left-3 top-1/2 -translate-y-1/2">search</span>
          <input
            type="text"
            placeholder="Cari kitab..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all border border-transparent ${isDark ? 'bg-slate-800 text-slate-200 placeholder:text-slate-500 focus:bg-slate-800 focus:border-blue-500/50' : 'bg-slate-100 text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-200'}`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="material-icons-round text-slate-400 text-lg">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col">
        {/* Main scrollable list */}
        <div ref={listRef} className="flex-1 px-4 py-3 pr-10">
          {/* Last Read Card */}
          {lastRead && !searchQuery && (
            <button
              onClick={() => router.push(`/alkitab/${lastRead.kitab}/${lastRead.pasal}`)}
              className="w-full bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-3.5 flex items-center gap-3 shadow-md shadow-blue-500/20 active:scale-[0.98] transition-transform mb-3"
            >
              <div className={`w-9 h-9 backdrop-blur rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-black/20' : 'bg-white/20'}`}>
                <span className="material-icons-round text-white text-lg">history</span>
              </div>
              <div className="flex flex-col items-start">
                <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-white/60' : 'text-white/70'}`}>Terakhir Dibaca</span>
                <span className="text-white font-bold text-sm">{lastRead.nama} {lastRead.pasal}</span>
              </div>
              <span className="material-icons-round text-white/50 ml-auto text-lg">chevron_right</span>
            </button>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col gap-1">
              {[...Array(15)].map((_, i) => (
                <div key={i} className={`h-12 rounded-xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-white'}`} />
              ))}
            </div>
          )}

          {/* Book list */}
          {!isLoading && sortedKitab.length > 0 && (
            <div className="flex flex-col">
              {Object.entries(groupedKitab).map(([letter, books]) => (
                <div key={letter}>
                  {/* Section header */}
                  <div
                    ref={(el) => { letterRefs.current[letter] = el; }}
                    className={`py-2 px-1 backdrop-blur-sm ${isDark ? 'bg-slate-900/90' : 'bg-slate-50/90'}`}
                    style={{ scrollMarginTop: '130px' }}
                  >
                    <span className={`text-[11px] font-black uppercase ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>{letter}</span>
                  </div>

                  {/* Books */}
                  {books.map((kitab) => (
                    <button
                      key={kitab.id}
                      onClick={() => handleBookTap(kitab)}
                      className={`w-full flex items-center gap-3 py-3 px-2 border-b transition-colors text-left ${isDark ? 'border-slate-800 active:bg-slate-800' : 'border-slate-100 active:bg-blue-50'}`}
                    >
                      <div className="flex flex-col flex-1 min-w-0 pl-1">
                        <span className={`font-semibold text-base leading-tight truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{kitab.nama}</span>
                        <span className={`text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{kitab.pasal} pasal</span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Empty search */}
          {!isLoading && searchQuery && sortedKitab.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-icons-round text-4xl text-slate-300 mb-2">search_off</span>
              <span className="text-sm font-bold text-slate-500">Kitab tidak ditemukan</span>
            </div>
          )}
        </div>

        {/* Alphabet sidebar */}
        {mounted && !isLoading && !searchQuery && availableLetters.length > 0 && typeof document !== 'undefined' && createPortal(
          <div
            ref={sidebarRef}
            className="fixed right-0 top-[130px] bottom-[100px] w-7 flex flex-col items-center justify-center py-2 z-[150] select-none touch-none"
            onTouchStart={handleSidebarTouchStart}
            onTouchMove={handleSidebarTouchMove}
            onTouchEnd={handleSidebarTouchEnd}
          >
            {availableLetters.map(letter => (
              <div
                key={letter}
                className={`flex items-center justify-center w-full transition-all ${
                  activeLetter === letter ? 'scale-125' : ''
                }`}
                style={{ flex: 1, minHeight: 0 }}
              >
                <span className={`text-[10px] font-bold leading-none transition-colors ${
                  activeLetter === letter ? 'text-blue-600' : 'text-blue-400'
                }`}>
                  {letter}
                </span>
              </div>
            ))}
          </div>,
          document.body
        )}

        {/* Floating letter indicator */}
        {isDragging && activeLetter && mounted && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 pointer-events-none z-[200] flex items-center justify-center">
            <div className="w-20 h-20 bg-blue-600/90 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/30 animate-in zoom-in-90 duration-100">
              <span className="text-white text-4xl font-black">{activeLetter}</span>
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Numpad Modal */}
      {mounted && selectedKitab && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] animate-in fade-in duration-200"
            onClick={() => setSelectedKitab(null)}
          />

          {/* Bottom sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-[200] animate-in slide-in-from-bottom duration-300">
            <div className={`rounded-t-3xl shadow-2xl max-w-md mx-auto ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-200'}`} />
              </div>

              {/* Book name */}
              <div className="text-center px-6 pt-1 pb-3">
                <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedKitab.nama}</h2>
                <p className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{selectedKitab.pasal} pasal • Ketik pasal atau pasal:ayat</p>
              </div>

              {/* Input display */}
              <div className={`mx-6 mb-3 rounded-2xl px-4 py-3 flex items-center justify-between border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-baseline gap-1 flex-1 min-w-0">
                  <span className={`text-sm font-bold shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{selectedKitab.singkatan}</span>
                  <span className={`text-2xl font-black tracking-tight ${numpadInput ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-600' : 'text-slate-300')}`}>
                    {numpadInput || '0:00'}
                  </span>
                </div>
                {numpadInput && (
                  <button onClick={handleNumpadBackspace} className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform ml-2 shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <span className={`material-icons-round text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>backspace</span>
                  </button>
                )}
              </div>

              {/* Error message */}
              {numpadError && (
                <p className="text-center text-xs font-bold text-red-500 mb-2 animate-in fade-in">{numpadError}</p>
              )}

              {/* Numpad grid */}
              <div className="px-6 pb-2 grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ':', 'C'].map((key) => (
                  <button
                    key={key}
                    onClick={() => key === 'C' ? handleNumpadPress('C') : handleNumpadPress(key)}
                    className={`h-13 rounded-xl flex items-center justify-center text-lg font-bold active:scale-95 transition-all ${
                      key === 'C'
                        ? (isDark ? 'bg-red-900/30 text-red-400 border border-red-900/50 active:bg-red-900/50' : 'bg-red-50 text-red-500 border border-red-100 active:bg-red-100')
                        : key === ':'
                        ? (isDark ? 'bg-slate-700 text-slate-400 border border-slate-600 active:bg-slate-600' : 'bg-slate-100 text-slate-500 border border-slate-200 active:bg-slate-200')
                        : (isDark ? 'bg-slate-700 text-slate-200 border border-slate-600 active:bg-slate-600' : 'bg-slate-100 text-slate-800 border border-slate-200 active:bg-slate-200')
                    }`}
                    style={{ height: 52 }}
                  >
                    {key}
                  </button>
                ))}
              </div>

              {/* Done button */}
              <div className="px-6 pb-8 pt-1">
                <button
                  onClick={handleNumpadDone}
                  disabled={!numpadInput}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] ${
                    numpadInput
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                      : (isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed')
                  }`}
                >
                  {numpadInput ? `Buka ${selectedKitab.singkatan} ${numpadInput}` : 'Ketik pasal dahulu'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
