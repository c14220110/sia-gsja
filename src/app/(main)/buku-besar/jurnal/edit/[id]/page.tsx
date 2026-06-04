'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
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

export default function EditJurnalPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
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
    satelit_kode: 'PST',
  });
  
  const [details, setDetails] = useState<JurnalDetail[]>([
    { coa_id: '', satelit_id: '', departemen_id: '', komisi_id: '', kegiatan_id: '', posisi: 'Debit', nominal: '', keterangan_baris: '' },
    { coa_id: '', satelit_id: '', departemen_id: '', komisi_id: '', kegiatan_id: '', posisi: 'Kredit', nominal: '', keterangan_baris: '' }
  ]);
  
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: React.ReactNode; isAlertOnly: boolean; onConfirm: () => void }>({ isOpen: false, title: '', message: '', isAlertOnly: false, onConfirm: () => {} });

  useEffect(() => {
    fetchOptions();
    if (id) {
      loadJurnalData(Number(id));
    }
  }, [id]);

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

  const loadJurnalData = async (id: number) => {
    try {
      const res = await fetch(`/api/buku-besar/jurnal?id=${id}`);
      const json = await res.json();
      if (json.success) {
        const data = json.data;
        if (data.status === 'Posted') {
          alert('Jurnal yang sudah diposting tidak bisa diedit!');
          router.push('/buku-besar/jurnal');
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addRow = () => setDetails([...details, { coa_id: '', satelit_id: '', departemen_id: '', komisi_id: '', kegiatan_id: '', posisi: 'Debit', nominal: '', keterangan_baris: '' }]);
  const duplicateRow = (index: number) => {
    const rowToDuplicate = details[index];
    const newDetails = [...details];
    newDetails.splice(index + 1, 0, { ...rowToDuplicate, id: undefined });
    setDetails(newDetails);
  };
  const removeRow = (index: number) => {
    if (details.length <= 2) {
      setAlertModal({ isOpen: true, title: 'Tidak Bisa Dihapus', message: 'Minimal harus ada 2 baris transaksi (Debit dan Kredit).', isAlertOnly: true, onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })) });
      return;
    }
    const newDetails = [...details];
    newDetails.splice(index, 1);
    setDetails(newDetails);
  };

  const updateRow = (index: number, field: keyof JurnalDetail, value: any) => {
    const newDetails = [...details];
    newDetails[index] = { ...newDetails[index], [field]: value };
    if (field === 'satelit_id') { newDetails[index].komisi_id = ''; newDetails[index].kegiatan_id = ''; } 
    else if (field === 'komisi_id') { newDetails[index].kegiatan_id = ''; }
    setDetails(newDetails);
  };

  const totalDebit = details.reduce((sum, row) => row.posisi === 'Debit' ? sum + (Number(row.nominal) || 0) : sum, 0);
  const totalKredit = details.reduce((sum, row) => row.posisi === 'Kredit' ? sum + (Number(row.nominal) || 0) : sum, 0);
  const balanceDiff = Math.abs(totalDebit - totalKredit);
  const isBalanced = balanceDiff < 0.01 && totalDebit > 0;

  const handleSubmit = async (saveAsPosted = false) => {
    if (saveAsPosted && !isBalanced) { setSubmitState({ status: 'error', message: 'Jurnal yang diposting harus seimbang (Balance)!' }); return; }
    for (let i = 0; i < details.length; i++) {
      if (!details[i].coa_id) { setSubmitState({ status: 'error', message: `Baris ${i + 1}: Akun COA belum dipilih` }); return; }
      if (!details[i].nominal || Number(details[i].nominal) <= 0) { setSubmitState({ status: 'error', message: `Baris ${i + 1}: Nominal tidak valid` }); return; }
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

      const res = await fetch('/api/buku-besar/jurnal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: 'Transaksi jurnal berhasil diupdate!' });
        setTimeout(() => { router.push('/buku-besar/jurnal'); }, 1500);
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Terjadi kesalahan saat menyimpan' });
      }
    } catch (e) {
      setSubmitState({ status: 'error', message: 'Kesalahan jaringan' });
    }
  };

  const formatRupiah = (angka: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(angka));

  return (
    <div className="w-full flex flex-col gap-6 pb-32">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />
      <AlertModal isOpen={alertModal.isOpen} title={alertModal.title} message={alertModal.message} confirmText={alertModal.isAlertOnly ? 'Tutup' : 'Ya, Lanjutkan'} cancelText={alertModal.isAlertOnly ? '' : 'Batal'} onConfirm={alertModal.onConfirm} onCancel={() => setAlertModal(prev => ({ ...prev, isOpen: false }))} />

      {/* Header Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <span className="text-slate-500">Buku Besar & Keuangan</span>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/buku-besar/jurnal" className="text-slate-500 hover:text-blue-600">Daftar Jurnal Umum</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Edit Jurnal Umum</span>
        </div>
        
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex gap-4 items-center">
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Edit Jurnal Umum</h1>
            <div className="px-3 py-1 bg-amber-100 rounded border border-amber-300 flex items-center gap-1 mt-1">
               <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
               <span className="text-amber-800 text-xs font-bold uppercase tracking-wide">DRAFT</span>
            </div>
          </div>
          <div className="text-slate-500 text-sm font-medium font-sans flex gap-1 items-center">
            <span className="material-icons-round text-lg text-slate-400">qr_code</span> ID: <span className="text-slate-700 font-bold">{formData.id}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="flex flex-col gap-2">
             <label className="text-sm font-semibold text-slate-700">Tanggal Transaksi <span className="text-red-500">*</span></label>
             <input type="date" value={formData.tanggal_transaksi} onChange={(e) => setFormData({...formData, tanggal_transaksi: e.target.value})} className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
           </div>
           <div className="flex flex-col gap-2 md:col-span-2">
             <label className="text-sm font-semibold text-slate-700">Deskripsi Umum <span className="text-red-500">*</span></label>
             <input type="text" value={formData.deskripsi} onChange={(e) => setFormData({...formData, deskripsi: e.target.value})} placeholder="Misal: Penerimaan Persembahan Ibadah Raya 1 Pusat" className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
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
                const filteredKomisi = row.satelit_id ? komisiOptions.filter(k => k.satelit_id === Number(row.satelit_id)) : komisiOptions;
                const filteredKegiatan = row.komisi_id ? kegiatanOptions.filter(k => k.komisi_id === Number(row.komisi_id)) : (row.satelit_id ? kegiatanOptions.filter(k => k.satelit_id === Number(row.satelit_id) || k.satelit_id === 1 || !k.satelit_id) : kegiatanOptions);
                return (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 group">
                    <td className="p-3 text-center text-slate-400 text-sm font-medium">{index + 1}</td>
                    <td className="p-3">
                      <select value={row.coa_id} onChange={(e) => updateRow(index, 'coa_id', e.target.value)} className="w-full h-10 px-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm bg-white">
                        <option value="">-- Pilih Akun --</option>
                        {coaOptions.map(c => <option key={c.id} value={c.id}>{c.kode_akun} - {c.nama_akun}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <select value={row.satelit_id} onChange={(e) => updateRow(index, 'satelit_id', e.target.value)} className="w-full h-10 px-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-xs bg-white">
                        <option value="">-- Pilih Satelit --</option>
                        {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                      </select>
                    </td>
                    <td className="p-3 flex flex-col gap-1">
                      <select value={row.komisi_id} onChange={(e) => updateRow(index, 'komisi_id', e.target.value)} className="w-full h-7 px-1 rounded border border-slate-200 outline-none text-[10px] bg-slate-50 disabled:opacity-50" disabled={!row.satelit_id && filteredKomisi.length > 0}>
                        <option value="">Semua Komisi</option>
                        {filteredKomisi.map(k => <option key={k.id} value={k.id}>{k.nama_komisi}</option>)}
                      </select>
                      <select value={row.kegiatan_id} onChange={(e) => updateRow(index, 'kegiatan_id', e.target.value)} className="w-full h-7 px-1 rounded border border-slate-200 outline-none text-[10px] bg-indigo-50 text-indigo-700 font-medium">
                        <option value="">-- Pilih Kegiatan --</option>
                        {filteredKegiatan.map(kg => <option key={kg.id} value={kg.id}>{kg.nama_kegiatan || kg.judul}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <input type="text" value={row.keterangan_baris} onChange={(e) => updateRow(index, 'keterangan_baris', e.target.value)} className="w-full h-10 px-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm" placeholder="Catatan spesifik..." />
                    </td>
                    <td className="p-3">
                      <select value={row.posisi} onChange={(e) => updateRow(index, 'posisi', e.target.value as 'Debit' | 'Kredit')} className={`w-full h-10 px-2 rounded-lg border font-semibold outline-none text-sm ${row.posisi === 'Debit' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                        <option value="Debit">Debit</option>
                        <option value="Kredit">Kredit</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <input type="number" value={row.nominal} onChange={(e) => updateRow(index, 'nominal', e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm text-right font-sans font-medium" placeholder="0" min="0" />
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => duplicateRow(index)} title="Duplikat Baris" className="w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center"><span className="material-icons-round text-[18px]">content_copy</span></button>
                        <button type="button" onClick={() => removeRow(index)} title="Hapus Baris" className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"><span className="material-icons-round text-[18px]">delete_outline</span></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <button type="button" onClick={addRow} className="mt-4 px-4 py-2 border border-dashed border-indigo-300 text-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2">
            <span className="material-icons-round text-[18px]">add</span> Tambah Baris Kosong
          </button>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex gap-8 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex flex-col"><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Debit</span><span className="text-xl font-bold font-sans text-blue-700">{formatRupiah(totalDebit)}</span></div>
             <div className="w-px bg-slate-200"></div>
             <div className="flex flex-col"><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Kredit</span><span className="text-xl font-bold font-sans text-orange-700">{formatRupiah(totalKredit)}</span></div>
             <div className="w-px bg-slate-200"></div>
             <div className="flex flex-col"><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selisih (Balance)</span>
               <span className={`text-xl font-bold font-sans ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                 {formatRupiah(balanceDiff)}
                 {isBalanced && balanceDiff === 0 && totalDebit > 0 && <span className="material-icons-round text-sm ml-2 align-middle">check_circle</span>}
               </span>
             </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleSubmit(false)} disabled={submitState.status === 'loading'} className="px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-colors disabled:opacity-50 text-sm">Simpan Draft</button>
            <button onClick={() => handleSubmit(true)} disabled={submitState.status === 'loading' || !isBalanced} className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all disabled:opacity-50 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px]">verified</span>POSTING JURNAL</button>
          </div>
        </div>
      </div>
    </div>
  );
}
