'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { useLoader } from '@/components/ui/GlobalLoader';
import {
  FormDetailKepengurusan,
  JabatanEntry,
  defaultJabatanEntry,
} from '@/components/pengurus/FormDetailKepengurusan';

const JemaatAutocomplete = ({
  label, valueName, onSelect, placeholder = 'Ketik nama...'
}: {
  label: string; valueName: string;
  onSelect: (jemaat: any | null, name: string) => void;
  placeholder?: string;
}) => {
  const [query, setQuery] = useState(valueName);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(valueName); }, [valueName]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const search = async (term: string) => {
    setQuery(term);
    if (term.length < 2) { setResults([]); setIsOpen(false); onSelect(null, term); return; }
    try {
      setLoading(true);
      const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(term)}&only_active=true`);
      const data = await res.json();
      if (data.success && data.data.length > 0) { setResults(data.data); setIsOpen(true); }
      else { setResults([]); setIsOpen(false); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="w-full flex-col gap-1 flex relative" ref={wrapperRef}>
      <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">{label}</label>
      <input type="text" value={query} onChange={e => search(e.target.value)} onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        placeholder={placeholder}
        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all" />
      {isOpen && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
          {loading ? <div className="p-3 text-sm text-slate-500">Mencari...</div> : results.map(j => (
            <div key={j.id} className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3 transition-colors"
              onClick={() => { onSelect(j, j.nama_lengkap); setQuery(j.nama_lengkap); setIsOpen(false); }}>
              <img src={j.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(j.nama_lengkap)}&background=random`} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">{j.nama_lengkap}</span>
                <span className="text-xs text-slate-500">{j.jemaat_id} • {j.nama_satelit || '-'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function NewPengurusPage() {
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  const [jabatanOptions, setJabatanOptions] = useState<any[]>([]);
  const [periodeOptions, setPeriodeOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);

  const [selectedJemaat, setSelectedJemaat] = useState<any>(null);
  const [jemaatSearchQuery, setJemaatSearchQuery] = useState('');
  
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Multi-jabatan list
  const [jabatanList, setJabatanList] = useState<JabatanEntry[]>([defaultJabatanEntry()]);

  useEffect(() => {
    if (selectedJemaat?.satelit_id) {
      setJabatanList(prev => prev.map(j => j.lokasi_satelit_id === '' ? { ...j, lokasi_satelit_id: selectedJemaat.satelit_id.toString() } : j));
    }
  }, [selectedJemaat]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [resJab, resPer, resKom, resDep, resSat, resUser] = await Promise.all([
          fetch('/api/options?type=jabatan'),
          fetch('/api/options?type=periode_kepengurusan'),
          fetch('/api/options?type=komisi'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=satelit'),
          fetch('/api/auth/me'),
        ]);
        const [jabData, perData, komData, depData, satData] = await Promise.all([resJab.json(), resPer.json(), resKom.json(), resDep.json(), resSat.json()]);
        const authData = resUser.ok ? await resUser.json() : null;

        if (jabData.success) setJabatanOptions(jabData.data);
        if (perData.success) setPeriodeOptions(perData.data);
        if (komData.success) setKomisiOptions(komData.data);
        if (depData.success) setDepartemenOptions(depData.data);
        if (satData.success) setSatelitOptions(satData.data);

        if (authData) {
          if (authData.is_super_admin || authData.permissions?.includes('pengurus_manage')) {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        } else {
          setHasAccess(false);
        }
      } catch (e) { 
        console.error('Failed to fetch options', e); 
        setHasAccess(false);
      }
    };
    fetchOptions();
  }, []);

  const handleAddJabatan = () => {
    const newEntry = defaultJabatanEntry();
    if (selectedJemaat?.satelit_id) newEntry.lokasi_satelit_id = selectedJemaat.satelit_id.toString();
    setJabatanList(prev => [...prev, newEntry]);
  };

  const handleRemoveJabatan = (idx: number) => {
    setJabatanList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleJabatanChange = (idx: number, updated: JabatanEntry) => {
    setJabatanList(prev => prev.map((j, i) => i === idx ? updated : j));
  };

  // Mantepin pilihan satelit final (misal Pusat diisi otomatis) tiap jabatannya
  const resolveSatelitId = (jab: JabatanEntry): number => {
    if (jab.lingkup === 'Pusat') {
      const pusat = satelitOptions.find(s => s.nama_satelit.toLowerCase().includes('pusat') || s.nama_satelit.toLowerCase().includes('eben'));
      return pusat ? pusat.id : 1;
    }
    return parseInt(jab.lokasi_satelit_id, 10);
  };

  const handleCreate = async () => {
    if (!selectedJemaat) { alert('Silakan pilih jemaat terlebih dahulu'); return; }

    for (let i = 0; i < jabatanList.length; i++) {
      const jab = jabatanList[i];
      if (!jab.jabatan_id) { alert(`Jabatan ${i + 1}: Jabatan harus dipilih`); return; }
      if (!jab.periode_id) { alert(`Jabatan ${i + 1}: Periode harus dipilih`); return; }
      if (!jab.tanggal_mulai) { alert(`Jabatan ${i + 1}: Tanggal mulai harus diisi`); return; }
      if (jab.lingkup !== 'Pusat' && !jab.lokasi_satelit_id) { alert(`Jabatan ${i + 1}: Lokasi satelit harus dipilih`); return; }
      if (jab.lingkup === 'Komisi' && !jab.komisi_id) { alert(`Jabatan ${i + 1}: Komisi harus dipilih`); return; }
      if (jab.lingkup === 'Departemen' && !jab.departemen_id) { alert(`Jabatan ${i + 1}: Departemen harus dipilih`); return; }
    }

    try {
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: '' });

      const payload = {
        jemaat_id: selectedJemaat.id,
        jabatan_list: jabatanList.map(jab => ({
          jabatan_id: jab.jabatan_id,
          lingkup: jab.lingkup,
          satelit_id: resolveSatelitId(jab),
          komisi_id: jab.komisi_id || null,
          departemen_id: jab.departemen_id || null,
          periode_id: jab.periode_id,
          tanggal_mulai: jab.tanggal_mulai,
          jalur_pengangkatan: jab.jalur_pengangkatan,
          catatan: jab.catatan || null,
        })),
      };

      const res = await fetch('/api/pengurus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: data.message || 'Pengurus berhasil ditambahkan!' });
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal menyimpan data' });
      }
    } catch (err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan pada server.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasAccess === false) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center text-slate-500 gap-4">
        <span className="material-icons-round text-6xl text-rose-300">gpp_bad</span>
        <h2 className="text-xl font-bold text-slate-700">Akses Ditolak</h2>
        <p className="text-sm">Anda tidak memiliki wewenang (pengurus_manage) untuk menambahkan pengurus baru.</p>
        <Link href="/pengurus" className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors">
          Kembali ke Database Pengurus
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-10">

      {/* Breadcrumb & Title */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <Link href="/pengurus" className="text-slate-500 hover:text-violet-600">Database Pengurus</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Tambah Pengurus</span>
        </div>
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex flex-col justify-start items-start">
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Registrasi Pengurus</h1>
            <div className="text-slate-500 text-base font-medium font-sans leading-6 flex gap-1">
              <span>ID Pengurus:</span>
              <span className="text-slate-700 font-bold">Otomatis Terbuat (P...)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full border-b border-slate-200 inline-flex justify-start items-start gap-8">
        <div className="px-2 py-3 border-b-2 border-slate-700 inline-flex flex-col justify-center items-center cursor-pointer">
          <span className="text-slate-700 text-sm font-bold font-sans leading-5">Data Pengurus</span>
        </div>
      </div>

      <div className="w-full flex flex-col gap-8 mt-2">

        {/* Identity Card — Cari Jemaat */}
        <div className="w-full p-6 bg-white rounded-xl shadow-sm border border-slate-200 inline-flex justify-start items-center gap-6">
          <div className="relative inline-flex flex-col justify-start items-start">
            <div className="w-24 h-24 bg-slate-100 rounded-xl border border-slate-200 inline-flex justify-center items-center overflow-hidden shrink-0">
              {selectedJemaat ? (
                <img src={selectedJemaat.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedJemaat.nama_lengkap)}&background=random`} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="material-icons-round text-slate-300 text-[48px]">person</span>
              )}
            </div>
          </div>
          <div className="inline-flex flex-col justify-start items-start relative w-full md:w-fit mr-auto">
            <JemaatAutocomplete
              label="Cari Jemaat Aktif (Nama)"
              valueName={jemaatSearchQuery}
              placeholder="Ketik nama jemaat aktif untuk dijadikan pengurus..."
              onSelect={(jemaat, name) => { setSelectedJemaat(jemaat); setJemaatSearchQuery(name); }}
            />
            {selectedJemaat && (
              <div className="mt-3 inline-flex items-center gap-4 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-lg w-fit animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">ID Jemaat</span>
                  <span className="font-sans text-slate-800">{selectedJemaat.jemaat_id}</span>
                </div>
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Satelit Terdaftar</span>
                  <span className="font-sans font-semibold text-slate-800">{selectedJemaat.nama_satelit || '-'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Daftar Jabatan — Multi */}
        <div className="w-full flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-icons-round text-slate-700 text-[20px]">workspace_premium</span>
              <span className="text-slate-900 text-base font-black font-sans">Daftar Jabatan</span>
              <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-black flex items-center justify-center">{jabatanList.length}</span>
            </div>
            <button
              type="button"
              onClick={handleAddJabatan}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2 font-bold text-sm shadow-sm transition-colors"
            >
              <span className="material-icons-round text-[18px]">add</span>
              Tambah Jabatan Lagi
            </button>
          </div>

          {jabatanList.map((jab, idx) => (
            <div key={idx} className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Card Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-violet-600 text-white text-sm font-black flex items-center justify-center shrink-0">{idx + 1}</div>
                  <span className="text-slate-700 text-sm font-bold font-sans">
                    {jab.jabatan_id
                      ? jabatanOptions.find(j => j.id.toString() === jab.jabatan_id)?.nama_jabatan || 'Jabatan Baru'
                      : `Jabatan ${idx + 1}`}
                  </span>
                  {jab.lingkup && (
                    <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-black uppercase rounded-full">{jab.lingkup}</span>
                  )}
                </div>
                {jabatanList.length > 1 && (
                  <button type="button" onClick={() => handleRemoveJabatan(idx)}
                    className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors border border-red-100">
                    <span className="material-icons-round text-[18px]">delete_outline</span>
                  </button>
                )}
              </div>
              {/* Card Body */}
              <div className="p-6">
                <FormDetailKepengurusan
                  data={jab}
                  onChange={updated => handleJabatanChange(idx, updated)}
                  jabatanOptions={jabatanOptions}
                  satelitOptions={satelitOptions}
                  komisiOptions={komisiOptions}
                  departemenOptions={departemenOptions}
                  periodeOptions={periodeOptions}
                  defaultSatelitId={selectedJemaat?.satelit_id?.toString()}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="w-full inline-flex justify-end items-center gap-4 mt-4">
          <Link href="/pengurus" className="px-8 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex flex-col justify-center items-center transition-colors">
            <span className="text-slate-700 text-sm font-bold font-sans uppercase leading-5 tracking-wide">Batal</span>
          </Link>
          <button
            onClick={handleCreate}
            className={`px-10 py-2.5 bg-slate-700 hover:bg-slate-800 rounded-lg flex justify-start items-center gap-2 transition-all shadow-lg ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {isSubmitting ? (
              <span className="material-icons-round text-white animate-spin text-[20px]">sync</span>
            ) : (
              <span className="material-icons-round text-white text-[20px]">save</span>
            )}
            <span className="text-white text-sm font-bold font-sans uppercase leading-5 tracking-wide">
              Simpan {jabatanList.length > 1 ? `(${jabatanList.length} Jabatan)` : 'Data'}
            </span>
          </button>
        </div>
      </div>

      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        errors={submitState.errors}
        onClose={() => {
          if (submitState.status === 'success') router.push('/pengurus');
          else setSubmitState({ status: 'idle', message: '' });
        }}
      />
    </div>
  );
}
