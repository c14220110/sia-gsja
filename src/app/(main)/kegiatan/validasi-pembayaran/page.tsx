'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ValidasiPembayaranPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kegiatan/validasi-pembayaran');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Error fetching validasi pembayaran:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVerify = async (kegiatanId: string, registrasiId: number) => {
    if (!confirm('Apakah Anda yakin pembayaran untuk jemaat ini sudah valid (lunas)?')) return;
    
    setVerifyingId(registrasiId);
    try {
      const res = await fetch(`/api/kegiatan/${kegiatanId}/registrasi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'VERIFY_PAYMENT', registrasi_ids: [registrasiId] })
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => prev.filter(r => r.id !== registrasiId));
      } else {
        alert(json.message || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menghubungi server.');
    } finally {
      setVerifyingId(null);
    }
  };

  const filteredData = data.filter(reg => {
    if (!searchQuery) return true;
    const lowerQ = searchQuery.toLowerCase();
    return (
      (reg.nama_peserta && reg.nama_peserta.toLowerCase().includes(lowerQ)) ||
      (reg.nama_kegiatan && reg.nama_kegiatan.toLowerCase().includes(lowerQ))
    );
  });

  const formatRp = (angka: number) => {
    if (!angka) return '0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  const formatDateLabel = (isoDate: string) => {
    if (!isoDate) return '-';
    // Format: 10 Apr 2026, 01.56
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d).replace(':', '.');
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-10 relative">
      
      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Validasi Pembayaran</h1>
          <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6">Verifikasi antrean bukti transfer pendaftaran acara</div>
        </div>
      </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-50 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-amber-600 text-3xl">hourglass_empty</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-['Public_Sans'] uppercase tracking-wide">MENUNGGU VALIDASI</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-amber-600 text-3xl font-bold font-['Public_Sans'] leading-9">
                {loading ? '...' : filteredData.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Options */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
        <div className="flex-1 min-w-[250px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari berdasarkan nama peserta atau nama acara..."
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[1050px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-[160px] shrink-0 text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">TANGGAL DAFTAR</div>
              <div className="flex-1 min-w-[180px] text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider pr-4">NAMA PESERTA</div>
              <div className="flex-1 min-w-[180px] text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider pr-4">NAMA ACARA</div>
              <div className="w-40 shrink-0 text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">TOTAL TAGIHAN</div>
              <div className="w-40 shrink-0 text-center text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">STATUS BUKTI</div>
              <div className="w-32 shrink-0 text-center text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">AKSI</div>
            </div>

            {/* Table Body */}
            <div>
              {loading ? (
                <div className="w-full py-16 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-4xl mb-3 text-slate-300 animate-spin">refresh</span>
                  <span className="text-sm font-['Public_Sans'] font-medium">Memuat antrean...</span>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="w-full py-16 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-3 text-slate-300">verified</span>
                  <span className="text-sm font-['Public_Sans'] font-medium">Belum ada antrean pembayaran yang perlu divalidasi.</span>
                  <span className="text-xs text-slate-400 mt-1">Sistem akan menampilkan data di sini saat ada bukti bayar masuk.</span>
                </div>
              ) : (
                filteredData.map((reg) => (
                  <div key={reg.id} className="w-full bg-white border-b border-slate-100 px-6 py-4 flex items-center hover:bg-slate-50 transition-colors">
                    <div className="w-[160px] shrink-0 text-slate-500 text-sm font-['Public_Sans']">
                      {formatDateLabel(reg.tanggal_daftar)}
                    </div>
                    <div className="flex-1 min-w-[180px] pr-4 flex flex-col">
                      <span className="text-slate-900 font-bold text-sm truncate">{reg.nama_peserta}</span>
                      <span className="text-slate-500 text-xs truncate mt-0.5">{reg.no_hp || '-'}</span>
                    </div>
                    <div className="flex-1 min-w-[180px] pr-4 flex flex-col">
                      <span className="text-slate-700 font-medium text-sm line-clamp-2">{reg.nama_kegiatan}</span>
                    </div>
                    <div className="w-40 shrink-0 text-slate-900 font-bold text-sm tracking-tight font-['Liberation_Mono']">
                      {formatRp(reg.total_biaya || 0)}
                    </div>
                    <div className="w-40 shrink-0 flex flex-col items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 rounded text-[10px] font-bold uppercase tracking-wider">
                        Belum Diperiksa
                      </span>
                      <a 
                        href={reg.url_bukti_bayar} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700 transition-colors rounded text-xs font-bold"
                      >
                        <span className="material-icons-round text-[16px]">receipt_long</span> 
                        Buka Bukti
                      </a>
                    </div>
                    <div className="w-32 shrink-0 flex justify-center items-center">
                      <button
                        onClick={() => handleVerify(reg.kegiatan_id, reg.id)}
                        disabled={verifyingId === reg.id}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 font-bold text-sm"
                      >
                        {verifyingId === reg.id ? (
                          <span className="material-icons-round text-[18px] animate-spin">refresh</span>
                        ) : (
                          <>
                            <span className="material-icons-round text-[18px]">price_check</span>
                            Valid
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
