'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  const [view, setView] = useState<'list' | 'form'>('list');
  const [jurnalList, setJurnalList] = useState<Jurnal[]>([]);
  const [viewDetailJurnal, setViewDetailJurnal] = useState<any>(null);
  
  // Options
  const [coaOptions, setCoaOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [deptOptions, setDeptOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  const [kegiatanOptions, setKegiatanOptions] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    id: 0,
    tanggal_transaksi: new Date().toISOString().split('T')[0],
    deskripsi: '',
    status: 'Draft',
    satelit_kode: 'PST', // Default to Pusat
  });
  
  const [details, setDetails] = useState<JurnalDetail[]>([
    { coa_id: '', satelit_id: '', departemen_id: '', komisi_id: '', kegiatan_id: '', posisi: 'Debit', nominal: '', keterangan_baris: '' },
    { coa_id: '', satelit_id: '', departemen_id: '', komisi_id: '', kegiatan_id: '', posisi: 'Kredit', nominal: '', keterangan_baris: '' }
  ]);
  
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
    setFormData({
      id: 0,
      tanggal_transaksi: new Date().toISOString().split('T')[0],
      deskripsi: '',
      status: 'Draft',
      satelit_kode: 'PST'
    });
    setDetails([
      { coa_id: '', satelit_id: '', departemen_id: '', komisi_id: '', kegiatan_id: '', posisi: 'Debit', nominal: '', keterangan_baris: '' },
      { coa_id: '', satelit_id: '', departemen_id: '', komisi_id: '', kegiatan_id: '', posisi: 'Kredit', nominal: '', keterangan_baris: '' }
    ]);
    setView('form');
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

  const handleEdit = async (id: number) => {
    const data = await loadJurnalDetail(id);
    if (data) {
      if (data.status === 'Posted') {
         setAlertModal({
           isOpen: true,
           title: 'Tidak Bisa Diedit',
           message: 'Jurnal yang sudah Posted tidak bisa diubah!',
           isAlertOnly: true,
           onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false }))
         });
         return;
      }
      setFormData({
        id: data.id,
        tanggal_transaksi: data.tanggal_transaksi.split('T')[0],
        deskripsi: data.deskripsi,
        status: data.status,
        satelit_kode: data.nomor_referensi.split('-')[1] || 'PST'
      });
      
      const mappedDetails = data.details.map((d: any) => ({
        id: d.id,
        coa_id: d.coa_id,
        satelit_id: d.satelit_id || '',
        departemen_id: d.departemen_id || '',
        komisi_id: d.komisi_id || '',
        kegiatan_id: d.kegiatan_id || '',
        posisi: d.posisi,
        nominal: parseFloat(d.nominal),
        keterangan_baris: d.keterangan_baris || ''
      }));
      setDetails(mappedDetails);
      setView('form');
    }
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
        const data = await loadJurnalDetail(id);
        if (data) {
          setFormData({
            id: 0,
            tanggal_transaksi: new Date().toISOString().split('T')[0],
            deskripsi: `[REVERSAL] Membalik jurnal ${data.nomor_referensi}: ${data.deskripsi}`,
            status: 'Draft',
            satelit_kode: data.nomor_referensi.split('-')[1] || 'PST'
          });
          
          const mappedDetails = data.details.map((d: any) => ({
            coa_id: d.coa_id,
            satelit_id: d.satelit_id || '',
            departemen_id: d.departemen_id || '',
            komisi_id: d.komisi_id || '',
            kegiatan_id: d.kegiatan_id || '',
            posisi: d.posisi === 'Debit' ? 'Kredit' : 'Debit', // SWAP POSITION
            nominal: parseFloat(d.nominal),
            keterangan_baris: d.keterangan_baris || ''
          }));
          setDetails(mappedDetails);
          setView('form');
        }
      }
    });
  };

  const addRow = () => {
    setDetails([...details, { coa_id: '', satelit_id: '', departemen_id: '', komisi_id: '', kegiatan_id: '', posisi: 'Debit', nominal: '', keterangan_baris: '' }]);
  };

  const duplicateRow = (index: number) => {
    const rowToDuplicate = details[index];
    const newDetails = [...details];
    newDetails.splice(index + 1, 0, { ...rowToDuplicate, id: undefined });
    setDetails(newDetails);
  };

  const removeRow = (index: number) => {
    if (details.length <= 2) {
      setAlertModal({
        isOpen: true,
        title: 'Tidak Bisa Dihapus',
        message: 'Minimal harus ada 2 baris transaksi (Debit dan Kredit).',
        isAlertOnly: true,
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    const newDetails = [...details];
    newDetails.splice(index, 1);
    setDetails(newDetails);
  };

  const updateRow = (index: number, field: keyof JurnalDetail, value: any) => {
    const newDetails = [...details];
    newDetails[index] = { ...newDetails[index], [field]: value };
    
    // Cascading resets
    if (field === 'satelit_id') {
      newDetails[index].komisi_id = '';
      newDetails[index].kegiatan_id = '';
    } else if (field === 'komisi_id') {
      newDetails[index].kegiatan_id = '';
    }
    
    setDetails(newDetails);
  };

  const totalDebit = details.reduce((sum, row) => row.posisi === 'Debit' ? sum + (Number(row.nominal) || 0) : sum, 0);
  const totalKredit = details.reduce((sum, row) => row.posisi === 'Kredit' ? sum + (Number(row.nominal) || 0) : sum, 0);
  const balanceDiff = Math.abs(totalDebit - totalKredit);
  const isBalanced = balanceDiff < 0.01 && totalDebit > 0;

  const handleSubmit = async (saveAsPosted = false) => {
    if (saveAsPosted && !isBalanced) {
      setSubmitState({ status: 'error', message: 'Jurnal yang diposting harus seimbang (Balance)!' });
      return;
    }
    
    // Validate rows
    for (let i = 0; i < details.length; i++) {
      if (!details[i].coa_id) {
        setSubmitState({ status: 'error', message: `Baris ${i + 1}: Akun COA belum dipilih` });
        return;
      }
      if (!details[i].nominal || Number(details[i].nominal) <= 0) {
        setSubmitState({ status: 'error', message: `Baris ${i + 1}: Nominal tidak valid` });
        return;
      }
    }

    setSubmitState({ status: 'loading', message: 'Menyimpan transaksi jurnal...' });
    try {
      const payload = {
        ...formData,
        status: saveAsPosted ? 'Posted' : 'Draft',
        details: details.map(d => ({
          ...d,
          coa_id: parseInt(d.coa_id.toString()),
          satelit_id: d.satelit_id ? parseInt(d.satelit_id.toString()) : null,
          departemen_id: d.departemen_id ? parseInt(d.departemen_id.toString()) : null,
          komisi_id: d.komisi_id ? parseInt(d.komisi_id.toString()) : null,
          kegiatan_id: d.kegiatan_id ? parseInt(d.kegiatan_id.toString()) : null,
          nominal: Number(d.nominal)
        }))
      };

      const res = await fetch('/api/buku-besar/jurnal', {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      
      if (json.success) {
        setSubmitState({ status: 'success', message: 'Transaksi jurnal berhasil disimpan!' });
        setTimeout(() => {
          setSubmitState({ status: 'idle', message: '' });
          setView('list');
          fetchJurnalList();
        }, 1500);
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Terjadi kesalahan saat menyimpan' });
      }
    } catch (e) {
      setSubmitState({ status: 'error', message: 'Kesalahan jaringan' });
    }
  };

  const formatRupiah = (angka: string | number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(angka));
  };

  if (view === 'form') {
    return (
      <div className="w-full flex flex-col gap-6">
        <SubmitOverlay 
          status={submitState.status} 
          message={submitState.message} 
          onClose={() => setSubmitState({ status: 'idle', message: '' })} 
        />
        <AlertModal 
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          confirmText={alertModal.isAlertOnly ? 'Tutup' : 'Ya, Lanjutkan'}
          cancelText={alertModal.isAlertOnly ? '' : 'Batal'}
          onConfirm={alertModal.onConfirm}
          onCancel={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        />
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors">
            <span className="material-icons-round">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{formData.id ? 'Edit Jurnal' : 'Jurnal Umum Baru'}</h1>
            <p className="text-slate-500 text-sm mt-1">Status Draft (WIP) dapat disimpan tanpa balance. Status Posted wajib Balance.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="flex flex-col gap-2">
               <label className="text-sm font-semibold text-slate-700">Tanggal Transaksi <span className="text-red-500">*</span></label>
               <input 
                 type="date" 
                 value={formData.tanggal_transaksi}
                 onChange={(e) => setFormData({...formData, tanggal_transaksi: e.target.value})}
                 className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
               />
             </div>
             <div className="flex flex-col gap-2 md:col-span-2">
               <label className="text-sm font-semibold text-slate-700">Deskripsi Umum <span className="text-red-500">*</span></label>
               <input 
                 type="text" 
                 value={formData.deskripsi}
                 onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                 placeholder="Misal: Penerimaan Persembahan Ibadah Raya 1 Pusat"
                 className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
               />
             </div>
          </div>

          <div className="p-6 flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="p-3 font-semibold text-slate-700 text-sm w-12 text-center">#</th>
                  <th className="p-3 font-semibold text-slate-700 text-sm w-64">Akun (COA) <span className="text-red-500">*</span></th>
                  <th className="p-3 font-semibold text-slate-700 text-sm w-36">Satelit</th>
                  <th className="p-3 font-semibold text-slate-700 text-sm w-48">Komisi & Kegiatan</th>
                  <th className="p-3 font-semibold text-slate-700 text-sm w-48">Keterangan Baris</th>
                  <th className="p-3 font-semibold text-slate-700 text-sm w-32">Posisi</th>
                  <th className="p-3 font-semibold text-slate-700 text-sm w-48 text-right">Nominal (Rp) <span className="text-red-500">*</span></th>
                  <th className="p-3 font-semibold text-slate-700 text-sm w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {details.map((row, index) => {
                  const filteredKomisi = row.satelit_id 
                    ? komisiOptions.filter(k => k.satelit_id === Number(row.satelit_id))
                    : komisiOptions;
                    
                  const filteredKegiatan = row.komisi_id
                    ? kegiatanOptions.filter(k => k.komisi_id === Number(row.komisi_id))
                    : (row.satelit_id 
                        ? kegiatanOptions.filter(k => k.satelit_id === Number(row.satelit_id) || k.satelit_id === 1 || !k.satelit_id)
                        : kegiatanOptions);

                  return (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 group">
                      <td className="p-3 text-center text-slate-400 text-sm font-medium">{index + 1}</td>
                      <td className="p-3">
                        <select 
                          value={row.coa_id} 
                          onChange={(e) => updateRow(index, 'coa_id', e.target.value)}
                          className="w-full h-10 px-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm bg-white"
                        >
                          <option value="">-- Pilih Akun --</option>
                          {coaOptions.map(c => <option key={c.id} value={c.id}>{c.kode_akun} - {c.nama_akun}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <select 
                          value={row.satelit_id} 
                          onChange={(e) => updateRow(index, 'satelit_id', e.target.value)}
                          className="w-full h-10 px-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-xs bg-white"
                        >
                          <option value="">-- Pilih Satelit --</option>
                          {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                        </select>
                      </td>
                      <td className="p-3 flex flex-col gap-1">
                        <select 
                          value={row.komisi_id} 
                          onChange={(e) => updateRow(index, 'komisi_id', e.target.value)} 
                          className="w-full h-7 px-1 rounded border border-slate-200 outline-none text-[10px] bg-slate-50 disabled:opacity-50"
                          disabled={!row.satelit_id && filteredKomisi.length > 0} 
                        >
                          <option value="">Semua Komisi</option>
                          {filteredKomisi.map(k => <option key={k.id} value={k.id}>{k.nama_komisi}</option>)}
                        </select>
                        <select 
                          value={row.kegiatan_id} 
                          onChange={(e) => updateRow(index, 'kegiatan_id', e.target.value)} 
                          className="w-full h-7 px-1 rounded border border-slate-200 outline-none text-[10px] bg-indigo-50 text-indigo-700 font-medium"
                        >
                          <option value="">-- Pilih Kegiatan (Opsional) --</option>
                          {filteredKegiatan.map(kg => <option key={kg.id} value={kg.id}>{kg.nama_kegiatan || kg.judul}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <input 
                          type="text" 
                          value={row.keterangan_baris} 
                          onChange={(e) => updateRow(index, 'keterangan_baris', e.target.value)}
                          className="w-full h-10 px-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                          placeholder="Catatan spesifik..."
                        />
                      </td>
                      <td className="p-3">
                        <select 
                          value={row.posisi} 
                          onChange={(e) => updateRow(index, 'posisi', e.target.value as 'Debit' | 'Kredit')}
                          className={`w-full h-10 px-2 rounded-lg border font-semibold outline-none text-sm ${row.posisi === 'Debit' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}
                        >
                          <option value="Debit">Debit</option>
                          <option value="Kredit">Kredit</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input 
                          type="number" 
                          value={row.nominal} 
                          onChange={(e) => updateRow(index, 'nominal', e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm text-right font-mono font-medium"
                          placeholder="0"
                          min="0"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => duplicateRow(index)} title="Duplikat Baris" className="w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center">
                            <span className="material-icons-round text-[18px]">content_copy</span>
                          </button>
                          <button type="button" onClick={() => removeRow(index)} title="Hapus Baris" className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center">
                            <span className="material-icons-round text-[18px]">delete_outline</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            <button 
              type="button" 
              onClick={addRow}
              className="mt-4 px-4 py-2 border border-dashed border-indigo-300 text-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2"
            >
              <span className="material-icons-round text-[18px]">add</span> Tambah Baris Kosong
            </button>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex gap-8 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
               <div className="flex flex-col">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Debit</span>
                 <span className="text-xl font-bold font-mono text-blue-700">{formatRupiah(totalDebit)}</span>
               </div>
               <div className="w-px bg-slate-200"></div>
               <div className="flex flex-col">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Kredit</span>
                 <span className="text-xl font-bold font-mono text-orange-700">{formatRupiah(totalKredit)}</span>
               </div>
               <div className="w-px bg-slate-200"></div>
               <div className="flex flex-col">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selisih (Balance)</span>
                 <span className={`text-xl font-bold font-mono ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                   {formatRupiah(balanceDiff)}
                   {isBalanced && balanceDiff === 0 && totalDebit > 0 && <span className="material-icons-round text-sm ml-2 align-middle">check_circle</span>}
                 </span>
               </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => handleSubmit(false)} 
                disabled={submitState.status === 'loading'}
                className="px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-colors disabled:opacity-50 text-sm"
              >
                Simpan Draft
              </button>
              <button 
                onClick={() => handleSubmit(true)} 
                disabled={submitState.status === 'loading' || !isBalanced}
                className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all disabled:opacity-50 text-sm flex items-center gap-2"
              >
                <span className="material-icons-round text-[18px]">verified</span>
                POSTING JURNAL
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Jurnal Umum (General Ledger)</h1>
          <p className="text-slate-500 text-sm mt-1">Catat dan pantau transaksi keuangan lintas satelit dan kegiatan.</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-sm"
        >
          <span className="material-icons-round text-[18px]">add</span>
          Jurnal Baru
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600 text-sm">Tanggal</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">No. Referensi</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Deskripsi Transaksi</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-right">Nominal (D/K)</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-center">Status</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-center w-40">Aksi</th>
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
