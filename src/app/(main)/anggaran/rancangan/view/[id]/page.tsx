'use client';
import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import AnggaranTimeline from '@/components/anggaran/AnggaranTimeline';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

// Status badge with appropriate colors
const getStatusBadge = (status: string) => {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    'Draft': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
    'Menunggu Review': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    'Sedang Direviu': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    'Revisi': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    'Disetujui Penuh': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'Disetujui Sebagian': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
    'Ditolak': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  };
  const s = map[status] || map['Draft'];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${s.bg} ${s.text} flex items-center gap-1.5 w-max border`}>
      <span className={`w-2 h-2 rounded-full ${s.dot} ${status === 'Menunggu Review' ? 'animate-pulse' : ''}`}></span>
      {status}
    </span>
  );
};

// Kategori RA badge
const getKategoriBadge = (kategori: string) => {
  const map: Record<string, string> = {
    'Kegiatan': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    'Operasional': 'bg-sky-50 text-sky-700 border-sky-200',
    'Proyek': 'bg-violet-50 text-violet-700 border-violet-200',
    'Penggajian': 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${map[kategori] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {kategori || '-'}
    </span>
  );
};

// Role groups
const REVIEWER_ROLES = [1, 3, 5]; // Super Admin, Gembala/Majelis, Bendahara Pusat
const PEMBUAT_ROLES = [1, 5, 6, 8, 9]; // Super Admin, Bendahara Pusat, Bendahara Satelit, Ketua Komisi, Ketua Departemen

export default function ViewAnggaranPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/anggaran/tahunan/${id}`).then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/auth/me').then(r => r.json()).catch(() => ({}))
    ]).then(([resData, resUser]) => {
      if (resData.success) setData(resData.data);
      if (resUser?.role_id) setUserData(resUser);
      setIsLoading(false);
    });
  }, [id]);

  const items = data?.items || [];
  const penItems = useMemo(() => items.filter((i: any) => i.jenis_anggaran === 'Penerimaan'), [items]);
  const kelItems = useMemo(() => items.filter((i: any) => i.jenis_anggaran === 'Pengeluaran'), [items]);
  const totalP = useMemo(() => penItems.reduce((a: number, c: any) => a + Number(c.total), 0), [penItems]);
  const totalK = useMemo(() => kelItems.reduce((a: number, c: any) => a + Number(c.total), 0), [kelItems]);
  const margin = totalP > 0 ? ((totalP - totalK) / totalP) * 100 : 0;

  // Determine user capabilities
  const isReviewer = userData ? REVIEWER_ROLES.includes(userData.role_id) : false;
  const isPembuat = userData ? PEMBUAT_ROLES.includes(userData.role_id) : false;
  const status = data?.status || '';

  // Action permissions
  const canEdit = isPembuat && ['Draft', 'Revisi'].includes(status);
  const canReview = isReviewer && status === 'Menunggu Review';
  const isFinal = ['Disetujui Penuh', 'Disetujui Sebagian', 'Ditolak'].includes(status);

  if (isLoading) {
    return <div className="p-10 text-center text-slate-500 flex flex-col items-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>Memuat Detail Rancangan Anggaran...</div>;
  }

  if (!data) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20">
        <span className="material-icons-round text-6xl text-slate-300 mb-4">search_off</span>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Dokumen Tidak Ditemukan</h1>
        <p className="text-slate-500 mb-6">Rancangan anggaran yang Anda cari tidak tersedia atau telah dihapus.</p>
        <Link href="/anggaran/rancangan" className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors">Kembali ke Daftar</Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-32">
      {/* Header Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
          <span className="text-slate-500">Anggaran & Plotting</span>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/anggaran/rancangan" className="text-slate-500 hover:text-blue-600">Rancangan Anggaran</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Detail Rancangan</span>
        </div>
        
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="flex flex-col gap-2">
            <div className="inline-flex gap-4 items-center">
              <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9">Detail Rancangan Anggaran</h1>
              {getStatusBadge(data.status)}
            </div>
            {data.nama_rancangan && <p className="text-slate-500 text-base font-medium">{data.nama_rancangan}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-slate-500 text-sm font-medium font-['Inter'] flex gap-1 items-center">
              <span className="material-icons-round text-lg text-slate-400">qr_code</span> ID: <span className="text-slate-700 font-bold">{data.kode_dokumen}</span>
            </div>
            <button
              onClick={() => setShowTimeline(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-semibold font-['Public_Sans'] hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
            >
              <span className="material-icons-round text-[18px]">history</span>
              Lihat Riwayat
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-5 border-b border-slate-100">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nama Rancangan</div>
            <div className="text-sm font-bold text-slate-800">{data.nama_rancangan || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Kategori RA</div>
            {getKategoriBadge(data.kategori_ra)}
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Pola Penggunaan</div>
            <div className="text-sm font-semibold text-slate-700">{data.pola_penggunaan || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Estimasi Pelaksanaan</div>
            <div className="text-sm font-semibold text-slate-700">{data.estimasi_waktu || '-'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-5">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Satelit</div>
            <div className="text-sm font-bold text-slate-800">{data.nama_satelit}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Komisi</div>
            <div className="text-sm font-bold text-slate-800">{data.nama_komisi || 'Umum (Non-Komisi)'}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tahun Anggaran</div>
            <div className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded w-max">{data.tahun}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Dibuat Oleh</div>
            <div className="text-sm font-bold text-slate-800">{data.pembuat || 'Sistem'}</div>
          </div>
        </div>
      </div>

      {/* Rincian Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-base font-bold text-slate-800">Rincian Anggaran</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">{items.length} item</span>
            <button className="w-8 h-8 rounded border border-slate-300 flex justify-center items-center text-slate-500 hover:bg-slate-100"><span className="material-icons-round text-[18px]">print</span></button>
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-500 tracking-wider">
                <th className="p-4 w-[30%]">URAIAN</th><th className="p-4 w-[18%]">AKUN</th><th className="p-4 w-[12%]">SUMBER DANA</th>
                <th className="p-4 w-[6%] text-center">JML</th><th className="p-4 w-[8%] text-center">SATUAN</th>
                <th className="p-4 w-[12%] text-right">HARGA</th><th className="p-4 w-[14%] text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-icons-round text-4xl text-slate-300">receipt_long</span>
                    <p>Tidak ada rincian data</p>
                  </div>
                </td></tr>
              ) : (<>
                {penItems.length > 0 && <><tr><td colSpan={7} className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100 text-[10px] font-bold text-emerald-700">↑ PENERIMAAN</td></tr>
                {penItems.map((item: any, idx: number) => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 pl-6 text-sm font-semibold text-slate-800">{idx + 1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                  <td className="p-4 text-xs font-mono text-slate-500">{item.kode_akun} — {item.nama_akun}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana === 'Plafon Pusat' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                  <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td><td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                  <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(Number(item.harga_satuan))}</td>
                  <td className="p-4 text-sm text-right font-bold font-mono text-emerald-600">{fmt(Number(item.total))}</td>
                </tr>)}</>}
                {kelItems.length > 0 && <><tr><td colSpan={7} className="px-4 py-1.5 bg-red-50 border-b border-red-100 border-t border-t-slate-200 text-[10px] font-bold text-red-700">↓ PENGELUARAN</td></tr>
                {kelItems.map((item: any, idx: number) => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 pl-6 text-sm font-semibold text-slate-800">{idx + 1}. {item.uraian}<p className="text-xs font-normal text-slate-400">{item.deskripsi}</p></td>
                  <td className="p-4 text-xs font-mono text-slate-500">{item.kode_akun} — {item.nama_akun}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${item.sumber_dana === 'Plafon Pusat' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{item.sumber_dana}</span></td>
                  <td className="p-4 text-sm text-center font-medium">{item.jumlah}</td><td className="p-4 text-sm text-center text-slate-600">{item.satuan}</td>
                  <td className="p-4 text-sm text-right font-mono text-slate-700">{fmt(Number(item.harga_satuan))}</td>
                  <td className="p-4 text-sm text-right font-bold font-mono text-slate-800">{fmt(Number(item.total))}</td>
                </tr>)}</>}
              </>)}
            </tbody>
          </table>
        </div>

        {/* Footer Bar */}
        <div className="bg-slate-900 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-3 w-full md:w-auto">
            {/* Contextual Action Buttons */}
            {canEdit && (
              <Link href={`/anggaran/rancangan/edit/${id}`} className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors text-sm flex items-center gap-2 shadow-sm">
                <span className="material-icons-round text-[18px]">edit</span> {status === 'Revisi' ? 'Edit & Perbaiki' : 'Edit Rancangan'}
              </Link>
            )}
            {canReview && (
              <Link href={`/anggaran/rancangan/review/${id}`} className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors text-sm flex items-center gap-2 shadow-sm">
                <span className="material-icons-round text-[18px]">rate_review</span> Mulai Review
              </Link>
            )}
            {isFinal && (
              <span className="px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 bg-slate-800 text-slate-400 border border-slate-700">
                <span className="material-icons-round text-[18px]">lock</span> Dokumen Final — Tidak Dapat Diubah
              </span>
            )}
            {status === 'Menunggu Review' && !canReview && (
              <span className="px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 bg-slate-800 text-amber-400 border border-slate-700">
                <span className="material-icons-round text-[18px]">hourglass_top</span> Menunggu Review dari Majelis
              </span>
            )}
          </div>
          <div className="flex gap-5 overflow-x-auto">
            {[['Total Penerimaan', fmt(totalP), 'text-emerald-400'], ['Total Pengeluaran', `(${fmt(totalK)})`, 'text-red-400'], ['Margin', `${margin.toFixed(1)}%`, 'text-white'], ['Total Estimasi', fmt(totalP - totalK), totalP - totalK >= 0 ? 'text-emerald-400' : 'text-red-400']].map(([label, value, cls], i, arr) => (
              <React.Fragment key={label}>
                <div className="flex flex-col text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                  <span className={`text-sm font-bold font-mono ${cls}`}>{value}</span>
                </div>
                {i < arr.length - 1 && <div className="w-px h-8 bg-slate-700 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Slide-in Panel */}
      <AnggaranTimeline
        anggaranId={id}
        isOpen={showTimeline}
        onClose={() => setShowTimeline(false)}
      />
    </div>
  );
}
