'use client';
import Link from 'next/link';

export default function MasterDataInventarisComingSoon() {
  return (
    <div className="p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
        <span className="material-icons-round text-emerald-500 text-[40px]">category</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Master Data Inventaris</h1>
      <p className="text-slate-500 mb-2">Pengelolaan kategori barang dan sub-lokasi per satelit</p>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full mb-8">
        <span className="material-icons-round text-[14px]">schedule</span>
        Segera Hadir
      </span>
      <div className="text-sm text-slate-400 mb-6 text-left space-y-2">
        <p>Halaman ini akan memungkinkan pengelolaan data master:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong>Kategori Barang</strong> — 12 kategori aset sesuai standar akuntansi gereja (Tanah, Gedung, Kendaraan, dsb)</li>
          <li><strong>Sub-Lokasi</strong> — ruangan/area per satelit (Ruang Ibadah, Ruang Konseling, dsb)</li>
        </ul>
      </div>
      <Link href="/inventaris" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-slate-300 transition-colors">
        <span className="material-icons-round text-[16px]">arrow_back</span>
        Kembali ke Daftar Barang
      </Link>
    </div>
  );
}
