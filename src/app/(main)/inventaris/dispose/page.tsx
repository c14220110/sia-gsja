'use client';
import Link from 'next/link';

export default function DisposeComingSoon() {
  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
        <span className="material-icons-round text-red-500 text-[40px]">delete_sweep</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Dispose Barang</h1>
      <p className="text-slate-500 mb-2">Fitur pencatatan penghapusan / penghapusbukuan aset inventaris</p>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full mb-8">
        <span className="material-icons-round text-[14px]">schedule</span>
        Segera Hadir — Milestone 5
      </span>
      <p className="text-sm text-slate-400 mb-6">
        Fitur ini memungkinkan pencatatan dispose barang (rusak berat, hilang, atau dijual) 
        beserta alasan, bukti foto, dan persetujuan yang diperlukan sesuai tata kelola gereja.
      </p>
      <Link href="/inventaris" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-slate-300 transition-colors">
        <span className="material-icons-round text-[16px]">arrow_back</span>
        Kembali ke Daftar Barang
      </Link>
    </div>
  );
}
