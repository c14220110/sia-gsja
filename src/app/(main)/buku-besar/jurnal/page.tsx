'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

type JurnalDetail = {
  id?: number;
  coa_id: number | '';
  satelit_id: number | '';
  departemen_id: number | '';
  komisi_id: number | '';
  kegiatan_id: number | '';
  posisi: 'Debit' | 'Kredit';
  nominal: number | '';
  keterangan_baris: string;
};

type Jurnal = {
  id: number;
  nomor_referensi: string;
  tanggal_transaksi: string;
  deskripsi: string;
  total_debit: string;
  total_kredit: string;
  status: 'Draft' | 'Posted';
  created_at: string;
};

export default function JurnalUmumPage() {
  const router = useRouter();
  const [jurnalList, setJurnalList] = useState<Jurnal[]>([]);
  const [viewDetailJurnal, setViewDetailJurnal] = useState<any>(null);
  
  // Options for detail view
  const [coaOptions, setCoaOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [deptOptions, setDeptOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  const [kegiatanOptions, setKegiatanOptions] = useState<any[]>([]);

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });
  
  // Custom Modals
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: React.ReactNode; isAlertOnly: boolean; onConfirm: () => void }>({ isOpen: false, title: '', message: '', isAlertOnly: false, onConfirm: () => {} });

  useEffect(() => {
    fetchJurnalList();
    fetchOptions();
  }, []);

  const fetchJurnalList = async () => {
    try {
      const res = await fetch('/api/buku-besar/jurnal');
      const json = await res.json();
      if (json.success) setJurnalList(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOptions = async () => {
    try {
      const resCoa = await fetch('/api/buku-besar/coa');
      const jsonCoa = await resCoa.json();
      if (jsonCoa.success) {
        setCoaOptions(jsonCoa.data.filter((c: any) => c.tipe_akun === 'Detail' && c.is_active));
      }

      Promise.all([
        fetch('/api/options?type=satelit').then(r => r.json()).catch(() => ({})),
        fetch('/api/options?type=departemen').then(r => r.json()).catch(() => ({})),
        fetch('/api/options?type=komisi').then(r => r.json()).catch(() => ({})),
        fetch('/api/kegiatan?tanggal=All&limit=1000').then(r => r.json()).catch(() => ({})) 
      ]).then(([sat, dep, kom, keg]) => {
        if (sat.success) setSatelitOptions(sat.data || []);
        if (dep.success) setDeptOptions(dep.data || []);
        if (kom.success) setKomisiOptions(kom.data || []);
        if (keg.success) {
          const allowedStatuses = ['Akan Datang', 'Ongoing', 'Menunggu LPJ', 'Draft']; 
          const filteredKegiatan = (keg.data || []).filter((k: any) => 
            !['Selesai', 'Dibatalkan'].includes(k.status_kegiatan) && 
            allowedStatuses.some(s => k.status_kegiatan?.includes(s) || s.includes(k.status_kegiatan))
          );
          setKegiatanOptions(filteredKegiatan);
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateNew = () => {
    router.push('/buku-besar/jurnal/new');
  };

  const loadJurnalDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/buku-besar/jurnal?id=${id}`);
      const json = await res.json();
      if (json.success) return json.data;
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleView = async (id: number) => {
    const data = await loadJurnalDetail(id);
    if (data) setViewDetailJurnal(data);
  };

  const handleEdit = (id: number) => {
    router.push(`/buku-besar/jurnal/edit/${id}`);
  };

  const handleDelete = (id: number) => {
    setAlertModal({
      isOpen: true,
      title: 'Hapus Jurnal Draft',
      message: 'Apakah Anda yakin ingin menghapus jurnal DRAFT ini? Tindakan ini tidak bisa dibatalkan.',
      isAlertOnly: false,
      onConfirm: async () => {
        setAlertModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/buku-besar/jurnal?id=${id}`, { method: 'DELETE' });
          const json = await res.json();
          if (json.success) {
            fetchJurnalList();
          } else {
            setSubmitState({ status: 'error', message: json.message });
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
  };

  const handleReverse = (id: number) => {
    setAlertModal({
      isOpen: true,
      title: 'Buat Jurnal Pembalik',
      message: 'Jurnal Pembalik (Reversal) akan dibuat. Anda akan diarahkan ke form jurnal baru dengan posisi Debit/Kredit ditukar. Lanjutkan?',
      isAlertOnly: false,
      onConfirm: async () => {
        setAlertModal(prev => ({ ...prev, isOpen: false }));
        router.push(`/buku-besar/jurnal/new?reverse=${id}`);
      }
    });
  };

  const formatRupiah = (angka: string | number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(angka));
  };

  return (
    <div className="w-full flex flex-col gap-6 relative">
      <AlertModal 
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        confirmText={alertModal.isAlertOnly ? 'Tutup' : 'Ya, Lanjutkan'}
        cancelText={alertModal.isAlertOnly ? '' : 'Batal'}
        onConfirm={alertModal.onConfirm}
        onCancel={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
      />
      
      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Jurnal Umum (General Ledger)</h1>
          <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6">Catat dan pantau transaksi keuangan lintas satelit dan kegiatan</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCreateNew} className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
            <span className="material-icons-round text-white text-[20px]">add</span>
            <span className="text-white text-sm font-bold font-['Inter'] leading-5">Jurnal Baru</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-bold text-slate-500 text-xs font-['Public_Sans'] uppercase tracking-wider">Tanggal</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-['Public_Sans'] uppercase tracking-wider">No. Referensi</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-['Public_Sans'] uppercase tracking-wider">Deskripsi Transaksi</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-['Public_Sans'] uppercase tracking-wider text-right">Nominal (D/K)</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-['Public_Sans'] uppercase tracking-wider text-center">Status</th>
                <th className="p-4 font-bold text-slate-500 text-xs font-['Public_Sans'] uppercase tracking-wider text-center w-40">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {jurnalList.length > 0 ? (
                jurnalList.map(j => (
                  <tr key={j.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-700">{new Date(j.tanggal_transaksi).toLocaleDateString('id-ID')}</td>
                    <td className="p-4 text-sm font-mono text-indigo-600 font-semibold">{j.nomor_referensi}</td>
                    <td className="p-4 text-sm text-slate-600 max-w-md truncate" title={j.deskripsi}>{j.deskripsi}</td>
                    <td className="p-4 text-sm font-mono font-medium text-slate-800 text-right">{formatRupiah(j.total_debit)}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${j.status === 'Posted' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleView(j.id)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Lihat Detail Jurnal">
                          <span className="material-icons-round text-[20px]">visibility</span>
                        </button>
                        
                        {j.status === 'Draft' ? (
                          <>
                            <button onClick={() => handleEdit(j.id)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Jurnal (Draft)">
                              <span className="material-icons-round text-[20px]">edit</span>
                            </button>
                            <button onClick={() => handleDelete(j.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Jurnal (Draft)">
                              <span className="material-icons-round text-[20px]">delete_outline</span>
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleReverse(j.id)} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Jurnal Pembalik (Reverse Posted)">
                            <span className="material-icons-round text-[20px]">sync_alt</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">Belum ada transaksi jurnal</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Jurnal */}
      {viewDetailJurnal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  Detail Jurnal {viewDetailJurnal.nomor_referensi}
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${viewDetailJurnal.status === 'Posted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {viewDetailJurnal.status}
                  </span>
                </h2>
                <p className="text-slate-500 text-sm mt-1">{new Date(viewDetailJurnal.tanggal_transaksi).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <button onClick={() => setViewDetailJurnal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
                <span className="material-icons-round text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Deskripsi Umum</h3>
                <div className="p-4 bg-white border border-slate-200 rounded-xl text-slate-800">
                  {viewDetailJurnal.deskripsi}
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Rincian Transaksi ({viewDetailJurnal.details?.length || 0} baris)</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="p-3 font-semibold text-slate-700 text-xs w-8 text-center">#</th>
                        <th className="p-3 font-semibold text-slate-700 text-xs">Akun (COA)</th>
                        <th className="p-3 font-semibold text-slate-700 text-xs">Satelit/Dimensi</th>
                        <th className="p-3 font-semibold text-slate-700 text-xs">Keterangan</th>
                        <th className="p-3 font-semibold text-blue-700 text-xs text-right">Debit (Rp)</th>
                        <th className="p-3 font-semibold text-orange-700 text-xs text-right">Kredit (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDetailJurnal.details?.map((d: any, idx: number) => {
                        const satelit = satelitOptions.find(s => s.id === d.satelit_id)?.nama_satelit;
                        const komisi = komisiOptions.find(k => k.id === d.komisi_id)?.nama_komisi;
                        const kegiatan = kegiatanOptions.find(kg => kg.id === d.kegiatan_id)?.nama_kegiatan;
                        const tags = [satelit, komisi, kegiatan].filter(Boolean);

                        return (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3 text-center text-slate-400 text-xs font-medium">{idx + 1}</td>
                            <td className="p-3">
                              <p className="text-sm font-medium text-slate-800">{d.nama_akun}</p>
                              <p className="text-xs font-mono text-slate-500">{d.kode_akun}</p>
                            </td>
                            <td className="p-3">
                              {tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {tags.map((t, i) => <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] border border-slate-200">{t}</span>)}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>
                            <td className="p-3 text-sm text-slate-600">{d.keterangan_baris || '-'}</td>
                            <td className="p-3 text-sm font-mono text-right text-blue-700">{d.posisi === 'Debit' ? formatRupiah(d.nominal) : '-'}</td>
                            <td className="p-3 text-sm font-mono text-right text-orange-700">{d.posisi === 'Kredit' ? formatRupiah(d.nominal) : '-'}</td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td colSpan={4} className="p-4 text-right font-bold text-slate-700 text-sm uppercase">Total Balance</td>
                        <td className="p-4 text-sm font-bold font-mono text-right text-blue-800">{formatRupiah(viewDetailJurnal.total_debit)}</td>
                        <td className="p-4 text-sm font-bold font-mono text-right text-orange-800">{formatRupiah(viewDetailJurnal.total_kredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
