'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAlkitabDarkMode } from '../layout';

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

export default function KitabPasalPage() {
  const router = useRouter();
  const params = useParams();
  const kitabId = params.kitab as string;
  const { isDark } = useAlkitabDarkMode();

  const [kitabInfo, setKitabInfo] = useState<KitabInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch('/alkitab/meta.json');
        if (res.ok) {
          const data: MetaData = await res.json();
          const found = data.kitab.find(k => k.id === kitabId);
          if (found) setKitabInfo(found);
        }
      } catch (err) {
        console.error('Failed to load meta:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeta();
  }, [kitabId]);

  return (
    <div className={`min-h-screen flex flex-col pb-6 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`w-full px-6 pt-5 pb-4 sticky top-0 z-20 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/alkitab')} className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            <span className="material-icons-round text-xl">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <h1 className={`font-black text-xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {kitabInfo?.nama || 'Memuat...'}
            </h1>
            {kitabInfo && (
              <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                {kitabInfo.perjanjian === 'lama' ? 'Perjanjian Lama' : 'Perjanjian Baru'} • {kitabInfo.pasal} pasal
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-5">
        {isLoading && (
          <div className="grid grid-cols-5 gap-3">
            {[...Array(20)].map((_, i) => (
              <div key={i} className={`aspect-square rounded-2xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-white'}`} />
            ))}
          </div>
        )}

        {!isLoading && kitabInfo && (
          <>
            <p className={`text-xs font-medium mb-4 px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pilih pasal untuk dibaca:</p>
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: kitabInfo.pasal }, (_, i) => i + 1).map((pasal) => (
                <Link
                  key={pasal}
                  href={`/alkitab/${kitabId}/${pasal}`}
                  className={`aspect-square rounded-2xl flex items-center justify-center border active:scale-95 transition-all group shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 active:bg-slate-700 active:border-slate-600' : 'bg-white border-slate-100 active:bg-blue-50 active:border-blue-200'}`}
                >
                  <span className={`font-bold text-[15px] transition-colors ${isDark ? 'text-slate-200 group-active:text-white' : 'text-slate-700 group-active:text-blue-600'}`}>{pasal}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {!isLoading && !kitabInfo && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className={`material-icons-round text-4xl mb-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>error_outline</span>
            <span className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Kitab tidak ditemukan</span>
            <Link href="/alkitab" className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform">
              Kembali ke Daftar Kitab
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
