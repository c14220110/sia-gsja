'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lama' | 'baru'>('lama');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRead, setLastRead] = useState<{ kitab: string; pasal: number; nama: string } | null>(null);

  useEffect(() => {
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

    // Load last read from localStorage
    try {
      const saved = localStorage.getItem('alkitab_last_read');
      if (saved) setLastRead(JSON.parse(saved));
    } catch {}
  }, []);

  const filteredKitab = meta?.kitab.filter(k => {
    const matchTab = k.perjanjian === activeTab;
    const matchSearch = searchQuery
      ? k.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.singkatan.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchTab && matchSearch;
  }) || [];

  const plCount = meta?.kitab.filter(k => k.perjanjian === 'lama').length || 0;
  const pbCount = meta?.kitab.filter(k => k.perjanjian === 'baru').length || 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      {/* Header */}
      <div className="w-full px-6 pt-5 pb-4 bg-white sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <span className="material-icons-round text-slate-600 text-xl">arrow_back</span>
          </button>
          <h1 className="font-black text-xl text-slate-900 tracking-tight">Alkitab</h1>
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-auto">TB</span>
        </div>

        {/* Search bar */}
        <div className="relative">
          <span className="material-icons-round text-slate-400 text-xl absolute left-3 top-1/2 -translate-y-1/2">search</span>
          <input
            type="text"
            placeholder="Cari kitab..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all border border-transparent focus:border-blue-200"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="material-icons-round text-slate-400 text-lg">close</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        {!searchQuery && (
          <div className="flex mt-3 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('lama')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'lama'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Perjanjian Lama ({plCount})
            </button>
            <button
              onClick={() => setActiveTab('baru')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'baru'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Perjanjian Baru ({pbCount})
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4 flex flex-col gap-3">
        {/* Last Read Card */}
        {lastRead && !searchQuery && (
          <Link
            href={`/alkitab/${lastRead.kitab}/${lastRead.pasal}`}
            className="w-full bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 flex items-center gap-3 shadow-md shadow-blue-500/20 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shrink-0">
              <span className="material-icons-round text-white text-xl">history</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white/70 text-[10px] font-medium uppercase tracking-wider">Terakhir Dibaca</span>
              <span className="text-white font-bold text-sm">{lastRead.nama} {lastRead.pasal}</span>
            </div>
            <span className="material-icons-round text-white/50 ml-auto">chevron_right</span>
          </Link>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-14 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Book List */}
        {!isLoading && filteredKitab.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {filteredKitab.map((kitab, index) => (
              <Link
                key={kitab.id}
                href={`/alkitab/${kitab.id}`}
                className="w-full bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 border border-slate-100 active:bg-slate-50 active:scale-[0.99] transition-all group"
              >
                <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-blue-500/20 shrink-0">
                  <span className="text-xs font-black">{index + 1}</span>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-slate-800 font-bold text-[14px] leading-tight truncate">{kitab.nama}</span>
                  <span className="text-slate-400 text-[11px] font-medium">{kitab.pasal} pasal</span>
                </div>
                <span className="material-icons-round text-slate-300 text-lg group-active:text-blue-400 transition-colors">chevron_right</span>
              </Link>
            ))}
          </div>
        )}

        {/* Empty search state */}
        {!isLoading && searchQuery && filteredKitab.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-icons-round text-4xl text-slate-300 mb-2">search_off</span>
            <span className="text-sm font-bold text-slate-500">Kitab tidak ditemukan</span>
            <span className="text-xs text-slate-400 mt-1">Coba cari dengan kata kunci lain</span>
          </div>
        )}

        {/* Error state */}
        {!isLoading && !meta && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-icons-round text-4xl text-slate-300 mb-2">cloud_off</span>
            <span className="text-sm font-bold text-slate-500">Gagal memuat data Alkitab</span>
            <span className="text-xs text-slate-400 mt-1">Periksa koneksi internet Anda</span>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform"
            >
              Coba Lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
