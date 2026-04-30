'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

type AnggaranItem = {
  id: string;
  kode_dokumen: string;
  tahun: number;
  satelit: string;
  komisi: string | null;
  total_anggaran: number;
  updated_at: string;
  status: string;
};

export default function AnggaranTahunanPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [data, setData] = useState<AnggaranItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/anggaran/tahunan');
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error('Gagal memuat data anggaran', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter data based on search
  const filteredData = data.filter(item =>
    item.kode_dokumen.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.komisi || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.satelit.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Draft':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 flex items-center gap-1.5 w-max"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>DRAFT</span>;
      case 'Menunggu Review':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 flex items-center gap-1.5 w-max"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>MENUNGGU REVIEW</span>;
      case 'Sedang Direviu':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 flex items-center gap-1.5 w-max"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>SEDANG DIREVIU</span>;
      case 'Disetujui Sebagian':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 flex items-center gap-1.5 w-max"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>DISETUJUI SEBAGIAN</span>;
      case 'Disetujui Penuh':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600 flex items-center gap-1.5 w-max"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>DISETUJUI PENUH</span>;
      case 'Ditolak':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 flex items-center gap-1.5 w-max"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>DITOLAK</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 flex items-center gap-1.5 w-max"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>{status.toUpperCase()}</span>;
    }
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(angka);
  };

  return (
    <div className="w-full flex flex-col gap-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <span className="material-icons-round text-[16px]">request_quote</span>
            <span>Anggaran & Proposal</span>
            <span className="material-icons-round text-[16px]">chevron_right</span>
            <span className="font-semibold text-slate-700">Anggaran Tahunan</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Daftar Anggaran Tahunan</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola pengajuan anggaran tahunan tiap komisi dan satelit.</p>
        </div>
        <Link 
          href="/anggaran/tahunan/new"
          className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shrink-0"
        >
          <span className="material-icons-round text-[18px]">add</span>
          Buat Anggaran Baru
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <span className="material-icons-round absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
          <input 
            type="text" 
            placeholder="Cari ID Dokumen atau Komisi..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>
        <div className="flex gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <select className="h-10 px-3 pr-8 rounded-lg border border-slate-300 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat">
            <option value="">Semua Tahun</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
          <select className="h-10 px-3 pr-8 rounded-lg border border-slate-300 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat">
            <option value="">Semua Satelit</option>
            <option value="pusat">Pusat</option>
            <option value="air-hidup">Satelit Air Hidup</option>
            <option value="kasih-karunia">Satelit Kasih Karunia</option>
          </select>
          <select className="h-10 px-3 pr-8 rounded-lg border border-slate-300 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat">
            <option value="">Semua Komisi</option>
            <option value="sm">Sekolah Minggu</option>
            <option value="wanita">Wanita</option>
            <option value="pria">Pria</option>
            <option value="umum">- Umum (Satelit) -</option>
          </select>
          <select className="h-10 px-3 pr-8 rounded-lg border border-slate-300 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat">
            <option value="">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Menunggu Review">Menunggu Review</option>
            <option value="Sedang Direviu">Sedang Direviu</option>
            <option value="Disetujui Penuh">Disetujui Penuh</option>
          </select>
        </div>
        <div className="ml-auto text-xs font-medium text-slate-400">
          {filteredData.length} dokumen
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm relative z-0 flex flex-col min-h-[400px]">
        <div className="w-full overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px] relative">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-sm">
              <tr>
                <th className="p-4 font-semibold text-slate-500 text-xs tracking-wider whitespace-nowrap">ID DOKUMEN</th>
                <th className="p-4 font-semibold text-slate-500 text-xs tracking-wider whitespace-nowrap">TAHUN</th>
                <th className="p-4 font-semibold text-slate-500 text-xs tracking-wider whitespace-nowrap">SATELIT</th>
                <th className="p-4 font-semibold text-slate-500 text-xs tracking-wider whitespace-nowrap">KOMISI</th>
                <th className="p-4 font-semibold text-slate-500 text-xs tracking-wider whitespace-nowrap text-right">TOTAL ANGGARAN</th>
                <th className="p-4 font-semibold text-slate-500 text-xs tracking-wider whitespace-nowrap">TANGGAL UPDATE</th>
                <th className="p-4 font-semibold text-slate-500 text-xs tracking-wider whitespace-nowrap">STATUS</th>
                <th className="p-4 font-semibold text-slate-500 text-xs tracking-wider text-center w-24 whitespace-nowrap">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-400 text-sm">Memuat data anggaran...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-icons-round text-5xl text-slate-200">request_quote</span>
                      <p className="text-slate-500 font-semibold">Belum ada data anggaran tahunan</p>
                      <p className="text-slate-400 text-sm">Klik tombol "+ Buat Anggaran Baru" untuk membuat anggaran pertama Anda.</p>
                      <Link href="/anggaran/tahunan/new" className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                        <span className="material-icons-round text-[16px]">add</span> Buat Anggaran Baru
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-800">
                      <span className="px-2 py-1 bg-slate-100 rounded font-mono text-xs">{item.kode_dokumen}</span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-semibold text-xs">{item.tahun}</span>
                    </td>
                    <td className="p-4 text-sm text-slate-700 font-medium">{item.satelit}</td>
                    <td className="p-4 text-sm text-slate-600">{item.komisi || <span className="text-slate-400 italic">Anggaran Umum Satelit</span>}</td>
                    <td className="p-4 text-sm text-slate-800 font-bold text-right">{formatRupiah(item.total_anggaran)}</td>
                    <td className="p-4 text-sm text-slate-500">{new Date(item.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="p-4 text-sm">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center items-center">
                        <div className="relative">
                          <button 
                            onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                            className="w-8 h-8 rounded-full flex justify-center items-center hover:bg-slate-200 text-slate-500 transition-colors"
                          >
                            <span className="material-icons-round text-[20px]">more_vert</span>
                          </button>

                          {openMenuId === item.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50">
                              <Link href={`/anggaran/tahunan/view/${item.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                                <span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Detail
                              </Link>
                              <Link href={`/anggaran/tahunan/edit/${item.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                                <span className="material-icons-round text-[18px] text-slate-400">edit</span>Edit Anggaran
                              </Link>
                              <div className="w-full h-px bg-slate-100 my-1"></div>
                              <button className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2">
                                <span className="material-icons-round text-[18px] text-red-400">delete</span>Hapus
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
