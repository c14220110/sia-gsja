'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { useLoader } from '@/components/ui/GlobalLoader';

// Helper component for Jemaat Autocomplete
const JemaatAutocomplete = ({ 
  label, 
  valueName, 
  onSelect,
  placeholder = "Ketik nama..." 
}: { 
  label: string, 
  valueName: string, 
  onSelect: (jemaat: any | null, name: string) => void,
  placeholder?: string 
}) => {
  const [query, setQuery] = useState(valueName);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(valueName);
  }, [valueName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = async (searchTerm: string) => {
    setQuery(searchTerm);
    if (searchTerm.length < 2) {
      setResults([]);
      setIsOpen(false);
      onSelect(null, searchTerm);
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(searchTerm)}&only_active=true`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setResults(data.data);
        setIsOpen(true);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-col gap-1 flex relative" ref={wrapperRef}>
      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">{label}</label>
      <input 
        type="text" 
        value={query} 
        onChange={(e) => search(e.target.value)} 
        onFocus={() => { if(results.length > 0) setIsOpen(true); }}
        placeholder={placeholder} 
        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" 
      />
      
      {isOpen && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-slate-500">Mencari...</div>
          ) : (
            results.map((j) => (
              <div 
                key={j.id} 
                className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3 transition-colors"
                onClick={() => {
                  onSelect(j, j.nama_lengkap);
                  setQuery(j.nama_lengkap);
                  setIsOpen(false);
                }}
              >
                <img src={j.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(j.nama_lengkap)}&background=random`} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">{j.nama_lengkap}</span>
                  <span className="text-xs text-slate-500">{j.jemaat_id} • {j.nama_satelit || '-'}</span>
                </div>
              </div>
            ))
          )}
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

  // Selected Jemaat state
  const [selectedJemaat, setSelectedJemaat] = useState<any>(null);
  const [jemaatSearchQuery, setJemaatSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    jabatan_id: '',
    lingkup: 'Satelit' as 'Pusat' | 'Satelit' | 'Komisi' | 'Departemen',
    lokasi_satelit_id: '', // for overriding jemaat's default satelit if needed
    komisi_id: '',
    departemen_id: '',
    periode_id: '',
    tanggal_mulai: '',
    jalur_pengangkatan: 'Penunjukan' as 'Penunjukan' | 'Pemilihan',
    catatan: '',
  });

  useEffect(() => {
    // When a Jemaat is selected, default lokasinya ke satelit di mana dia terdaftar (jika ada)
    if (selectedJemaat && selectedJemaat.satelit_id) {
      setFormData(prev => ({ ...prev, lokasi_satelit_id: selectedJemaat.satelit_id.toString() }));
    }
  }, [selectedJemaat]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [resJab, resPer, resKom, resDep, resSat] = await Promise.all([
          fetch('/api/options?type=jabatan'),
          fetch('/api/options?type=periode_kepengurusan'),
          fetch('/api/options?type=komisi'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=satelit')
        ]);
        const jabData = await resJab.json();
        const perData = await resPer.json();
        const komData = await resKom.json();
        const depData = await resDep.json();
        const satData = await resSat.json();

        if (jabData.success) setJabatanOptions(jabData.data);
        if (perData.success) setPeriodeOptions(perData.data);
        if (komData.success) setKomisiOptions(komData.data);
        if (depData.success) setDepartemenOptions(depData.data);
        if (satData.success) setSatelitOptions(satData.data);
      } catch (error) {
        console.error('Failed to fetch options', error);
      }
    };
    fetchOptions();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      let overrides = {};
      if (name === 'lingkup') {
        overrides = { komisi_id: '', departemen_id: '' };
      }
      return { ...prev, [name]: value, ...overrides };
    });
  };

  const handleCreate = async () => {
    if (!selectedJemaat) {
      alert('Silakan pilih jemaat terlebih dahulu');
      return;
    }
    if (!formData.jabatan_id) {
      alert('Jabatan harus dipilih');
      return;
    }
    if (!formData.periode_id) {
      alert('Periode kepengurusan harus dipilih');
      return;
    }
    if (!formData.tanggal_mulai) {
      alert('Tanggal Mulai Menjabat harus diisi');
      return;
    }

    if (formData.lingkup !== 'Pusat' && !formData.lokasi_satelit_id) {
      alert('Lokasi Satelit harus dipilih');
      return;
    }

    if (formData.lingkup === 'Komisi' && !formData.komisi_id) {
      alert('Komisi harus dipilih untuk lingkup komisi');
      return;
    }
    if (formData.lingkup === 'Departemen' && !formData.departemen_id) {
      alert('Departemen harus dipilih untuk lingkup departemen');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: '' });

      // Identify pusat_id from options or fallback to 1 (usually Eben Haezer)
      const pusatSatelit = satelitOptions.find(s => s.nama_satelit.toLowerCase().includes('pusat') || s.nama_satelit.toLowerCase().includes('eben'));
      const finalSatelitId = formData.lingkup === 'Pusat' 
        ? (pusatSatelit ? pusatSatelit.id : 1) 
        : parseInt(formData.lokasi_satelit_id, 10);

      const payload = {
        jemaat_id: selectedJemaat.id,
        satelit_id: finalSatelitId, // The satelit where the jabatan is held
        jabatan_id: formData.jabatan_id,
        lingkup: formData.lingkup,
        komisi_id: formData.komisi_id || null,
        departemen_id: formData.departemen_id || null,
        periode_id: formData.periode_id,
        tanggal_mulai: formData.tanggal_mulai,
        jalur_pengangkatan: formData.jalur_pengangkatan,
        catatan: formData.catatan,
      };

      const res = await fetch('/api/pengurus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Data pengurus berhasil ditambahkan!' });
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal menyimpan data' });
      }
    } catch(err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan pada server saat menyimpan data.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-10">
      
      {/* Breadcrumb & Title Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
          <Link href="/dashboard" className="text-slate-500 hover:text-violet-600">Manajemen User</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/dashboard/pengurus" className="text-slate-500 hover:text-violet-600">Pengurus</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Tambah Pengurus</span>
        </div>
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex flex-col justify-start items-start">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Registrasi Pengurus</h1>
            <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 flex gap-1">
              <span>ID Pengurus:</span>
              <span className="text-slate-700 font-bold">Otomatis Terbuat (P...)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full border-b border-slate-200 inline-flex justify-start items-start gap-8">
        <div className="px-2 py-3 border-b-2 border-slate-700 inline-flex flex-col justify-center items-center cursor-pointer">
          <span className="text-slate-700 text-sm font-bold font-['Inter'] leading-5">Data Pengurus</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full flex flex-col justify-start items-start gap-8 mt-2">
            
        {/* Top Identity Card */}
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
              onSelect={(jemaat, name) => {
                setSelectedJemaat(jemaat);
                setJemaatSearchQuery(name);
              }}
            />
            {selectedJemaat && (
              <div className="mt-3 inline-flex items-center gap-4 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-lg w-fit relative overflow-hidden animate-in fade-in slide-in-from-top-2">
                 <div className="flex flex-col">
                   <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">ID Jemaat</span>
                   <span className="font-['Liberation_Mono'] text-slate-800">{selectedJemaat.jemaat_id}</span>
                 </div>
                 <div className="w-px h-8 bg-slate-200"></div>
                 <div className="flex flex-col">
                   <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Satelit Terdaftar</span>
                   <span className="font-['Inter'] font-semibold text-slate-800">{selectedJemaat.nama_satelit || '-'}</span>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Grid Form Sections */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* KOLOM KIRI */}
          <div className="flex flex-col gap-8">
            {/* Informasi Kepengurusan */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
              <div className="w-full inline-flex justify-start items-center gap-2">
                <span className="material-icons-round text-slate-700 text-[18px]">admin_panel_settings</span>
                <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Informasi Kepengurusan</span>
              </div>
              
              <div className="w-full flex-col gap-4 flex lg:flex-row">
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">ID Pengurus</label>
                  <input type="text" disabled value="Akan di-generate otomatis" className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-400 text-sm font-['Inter'] w-full italic cursor-not-allowed" />
                </div>
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Jabatan</label>
                  <select 
                    name="jabatan_id" 
                    value={formData.jabatan_id} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all cursor-pointer"
                  >
                    <option value="">-- Pilih Jabatan --</option>
                    {jabatanOptions.map(j => (
                      <option key={j.id} value={j.id}>{j.nama_jabatan}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="w-full flex-col gap-4 flex lg:flex-row">
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Periode Kepengurusan</label>
                  <select 
                    name="periode_id" 
                    value={formData.periode_id} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all cursor-pointer"
                  >
                    <option value="">-- Pilih Periode --</option>
                    {periodeOptions.map(p => (
                      <option key={p.id} value={p.id}>{p.nama_periode} ({p.tahun_mulai}-{p.tahun_akhir})</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tanggal Mulai Menjabat</label>
                  <input 
                    type="date" 
                    name="tanggal_mulai" 
                    value={formData.tanggal_mulai} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" 
                  />
                </div>
              </div>

              <div className="w-full flex-col gap-4 flex lg:flex-row">
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Jalur Pengangkatan</label>
                  <select 
                    name="jalur_pengangkatan" 
                    value={formData.jalur_pengangkatan} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all cursor-pointer"
                  >
                    <option value="Penunjukan">Penunjukan/Aklamasi</option>
                    <option value="Pemilihan">Pemilihan</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Catatan Pengurus */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
              <div className="w-full inline-flex justify-start items-center gap-2">
                <span className="material-icons-round text-slate-700 text-[18px]">edit_note</span>
                <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Catatan Khusus</span>
              </div>
              
              <div className="w-full flex-col gap-1 flex">
                <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Catatan (Opsional)</label>
                <textarea 
                  name="catatan" 
                  value={formData.catatan} 
                  onChange={handleInputChange} 
                  placeholder="Isi jika ada catatan khusus terkait kepengurusan ini..." 
                  className="px-3 py-3 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full min-h-[140px] resize-y transition-all" 
                />
              </div>
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="flex flex-col gap-8">

            {/* Lingkup Pelayanan (Satelit / Komisi / Departemen) */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
              <div className="w-full inline-flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-icons-round text-slate-700 text-[20px]">account_tree</span>
                  <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Lingkup Kepengurusan</span>
                </div>
              </div>
              
              <div className="w-full flex-col gap-4 flex">
                <div className="w-full flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Lingkup</label>
                  <select 
                    name="lingkup" 
                    value={formData.lingkup} 
                    onChange={handleInputChange} 
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all cursor-pointer"
                  >
                    <option value="Pusat">Pusat (Umum / Majelis)</option>
                    <option value="Satelit">Satelit (Umum)</option>
                    <option value="Komisi">Komisi</option>
                    <option value="Departemen">Departemen</option>
                  </select>
                </div>
                
                {formData.lingkup === 'Pusat' && (
                  <div className="w-full py-4 px-4 text-emerald-600 bg-emerald-50/50 rounded-lg border border-dashed border-emerald-200 flex items-start gap-3">
                    <span className="material-icons-round text-[20px] opacity-70 mt-0.5">verified</span>
                    <span className="text-sm font-['Inter'] leading-5 font-medium">Pengurus ini akan didaftarkan di tingkat Pusat/Majelis (Eben Haezer).</span>
                  </div>
                )}

                {formData.lingkup !== 'Pusat' && (
                  <div className="w-full flex-col gap-1 flex items-start animate-in fade-in slide-in-from-top-1">
                    <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Pilih Lokasi Satelit</label>
                    <select 
                      name="lokasi_satelit_id" 
                      value={formData.lokasi_satelit_id} 
                      onChange={handleInputChange} 
                      className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900 text-sm font-['Inter'] w-full transition-all cursor-pointer font-medium"
                    >
                      <option value="">-- Pilih Satelit Penugasan --</option>
                      {satelitOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.lingkup === 'Komisi' && (
                  <div className="w-full flex-col gap-1 flex items-start animate-in fade-in slide-in-from-top-1">
                    <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Pilih Komisi</label>
                    <select 
                      name="komisi_id" 
                      value={formData.komisi_id} 
                      onChange={handleInputChange} 
                      className="px-3 py-2 bg-violet-50 rounded-lg border border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900 text-sm font-['Inter'] w-full transition-all cursor-pointer"
                    >
                      <option value="">-- Pilih Komisi --</option>
                      {komisiOptions.map(k => (
                        <option key={k.id} value={k.id}>{k.nama_komisi}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.lingkup === 'Departemen' && (
                  <div className="w-full flex-col gap-1 flex items-start animate-in fade-in slide-in-from-top-1">
                    <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Pilih Departemen</label>
                    <select 
                      name="departemen_id" 
                      value={formData.departemen_id} 
                      onChange={handleInputChange} 
                      className="px-3 py-2 bg-sky-50 rounded-lg border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-slate-900 text-sm font-['Inter'] w-full transition-all cursor-pointer"
                    >
                      <option value="">-- Pilih Departemen --</option>
                      {departemenOptions.map(d => (
                        <option key={d.id} value={d.id}>{d.nama_departemen}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="w-full inline-flex justify-end items-center gap-4 mt-8">
          <Link href="/dashboard/pengurus" className="px-8 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex flex-col justify-center items-center transition-colors">
            <span className="text-slate-700 text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Batal</span>
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
            <span className="text-white text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Simpan Data</span>
          </button>
        </div>
        
      </div>
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => {
          if (submitState.status === 'success') {
            router.push('/dashboard/pengurus');
          } else {
            setSubmitState({ status: 'idle', message: '' });
          }
        }} 
      />
    </div>
  );
}
