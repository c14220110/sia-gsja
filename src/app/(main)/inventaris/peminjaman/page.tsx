'use client';
import Link from 'next/link';

export default function PeminjamanComingSoon() {
  return (
    <div className="p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center mb-6">
        <span className="material-icons-round text-purple-500 text-[40px]">assignment_return</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Peminjaman Barang</h1>
      <p className="text-slate-500 mb-2">Fitur pencatatan peminjaman dan pengembalian barang inventaris</p>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full mb-8">
        <span className="material-icons-round text-[14px]">schedule</span>
        Segera Hadir — Milestone 4
      </span>
      <p className="text-sm text-slate-400 mb-6">
        Fitur ini memungkinkan pencatatan peminjaman barang inventaris (misalnya proyektor untuk kegiatan),
        termasuk tanggal kembali, penanggung jawab, dan konfirmasi pengembalian.
      </p>
      <Link href="/inventaris" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-slate-300 transition-colors">
        <span className="material-icons-round text-[16px]">arrow_back</span>
        Kembali ke Daftar Barang
      </Link>
    </div>
  );
}
