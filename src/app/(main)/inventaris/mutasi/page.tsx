'use client';
import Link from 'next/link';

const pages = [
  { path: '/inventaris', label: 'Daftar Barang', color: 'slate' },
  { path: '/inventaris/stok-opname', label: 'Stok Opname', color: 'blue' },
];

export default function MutasiComingSoon() {
  return (
    <div className="p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mb-6">
        <span className="material-icons-round text-amber-500 text-[40px]">swap_horiz</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Mutasi Barang</h1>
      <p className="text-slate-500 mb-2">Fitur pencatatan mutasi / perpindahan barang antar satelit</p>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full mb-8">
        <span className="material-icons-round text-[14px]">schedule</span>
        Segera Hadir — Milestone 3
      </span>
      <p className="text-sm text-slate-400 mb-6">
        Fitur ini memungkinkan pencatatan perpindahan barang inventaris antar cabang / satelit GSJA, 
        termasuk approval dua pihak dan update lokasi barang otomatis.
      </p>
      <Link href="/inventaris" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-slate-300 transition-colors">
        <span className="material-icons-round text-[16px]">arrow_back</span>
        Kembali ke Daftar Barang
      </Link>
    </div>
  );
}
