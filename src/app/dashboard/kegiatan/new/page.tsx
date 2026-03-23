'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

// Helper component for Generic Autocomplete
const GenericAutocomplete = ({ 
  label, 
  valueName, 
  valueId, 
  options,
  onSelect,
  placeholder = "Ketik nama..." 
}: { 
  label: string, 
  valueName: string, 
  valueId: string, 
  options: any[],
  onSelect: (id: string, name: string) => void,
  placeholder?: string 
}) => {
  const [query, setQuery] = useState(valueName);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
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

  const search = (searchTerm: string) => {
    setQuery(searchTerm);
    if (searchTerm.length < 1) {
      setResults([]);
      setIsOpen(false);
      onSelect('', searchTerm);
      return;
    }
    
    // Auto sync string without ID
    onSelect('', searchTerm);
    
    const matched = options.filter(opt => 
      opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
    
    if (matched.length > 0) {
      setResults(matched);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  };

  return (
    <div className="w-full flex-col gap-1 flex relative" ref={wrapperRef}>
      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">{label}</label>
      <input 
        type="text" 
        value={query} 
        onChange={(e) => search(e.target.value)} 
        onFocus={(e) => search(e.target.value)}
        placeholder={placeholder} 
        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" 
      />
      
      {isOpen && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <div 
              key={i} 
              className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
              onClick={() => {
                onSelect(r.id.toString(), r.name);
                setQuery(r.name);
                setIsOpen(false);
              }}
            >
              <div className="text-sm font-semibold text-slate-900">{r.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper component for Hybrid Async Autocomplete (Search internal but allow free text external)
const HybridAsyncAutocomplete = ({ 
  label, 
  valueName, 
  onSelect,
  placeholder = "Ketik minimal 3 huruf..." 
}: { 
  label: string, 
  valueName: string, 
  onSelect: (name: string) => void,
  placeholder?: string 
}) => {
  const [query, setQuery] = useState(valueName);
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const fetchResults = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setResults(data.data);
        setIsOpen(true);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onSelect(val); // IMMEDIATELY sync as free text!
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      fetchResults(val);
    }, 400);
  };

  return (
    <div className="w-full flex-col gap-1 flex relative" ref={wrapperRef}>
      <label className="text-blue-800 text-xs font-bold font-['Inter'] uppercase leading-4">{label}</label>
      <div className="relative">
        <input 
          type="text" 
          value={query} 
          onChange={handleInputChange}
          onFocus={() => { if(query.length >= 3 && results.length > 0) setIsOpen(true); }}
          placeholder={placeholder} 
          className="px-4 py-3 pr-10 bg-white rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" 
        />
        {isLoading && (
          <div className="absolute right-3 top-3 w-4 h-4 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin"></div>
        )}
      </div>
      
      {isOpen && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-lg border border-blue-200 shadow-xl max-h-56 overflow-y-auto">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
            Saran dari Database Jemaat
          </div>
          {results.map((r, i) => (
            <div 
              key={i} 
              className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3"
              onClick={() => {
                onSelect(r.nama_lengkap);
                setQuery(r.nama_lengkap);
                setIsOpen(false);
              }}
            >
              {r.foto_url ? (
                <img src={r.foto_url} alt={r.nama_lengkap} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                   {r.nama_lengkap.charAt(0)}
                </div>
              )}
              <div className="flex flex-col">
                 <div className="text-sm font-bold text-slate-900">{r.nama_lengkap}</div>
                 <div className="text-[10px] text-slate-500">{r.jemaat_id} - {r.nama_satelit || 'Gereja'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function NewKegiatanPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  // Master Data Options
  const [jenisKegiatanOptions, setJenisKegiatanOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
  const [pengurusOptions, setPengurusOptions] = useState<{id: string, name: string}[]>([]); // specifically mapped for generic autocomplete

  // Form State
  const [formData, setFormData] = useState({
    nama_kegiatan: '',
    jenis_kegiatan_id: '',
    frekuensi_kegiatan: 'Mingguan',
    tanggal_mulai: '',
    tanggal_selesai: '',
    waktu_mulai: '',
    waktu_selesai: '',
    lokasi_kegiatan: '',
    keterangan: '',
    
    // Card 3: Ibadah Detail
    tema_khotbah: '',
    nama_pengkhotbah_1: '',
    nama_pengkhotbah_2: '',
    
    // Card 4: Penyelenggara Tracker
    tipe_penyelenggara: 'Satelit',
    satelit_id: '',
    komisi_id: '',
    departemen_id: '',
    pic_pengurus_id: '',
    pic_pengurus_name: '', // Display only tracker
    
    // Card 5: Biaya
    berbayar: false,
    
    status_kegiatan: 'Draft' 
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [resJenis, resSatelit, resKomisi, resDept, resPengurus] = await Promise.all([
          fetch('/api/options?type=jenis_kegiatan'),
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=komisi'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=pengurus')
        ]);
        
        const dataJenis = await resJenis.json();
        const dataSatelit = await resSatelit.json();
        const dataKomisi = await resKomisi.json();
        const dataDept = await resDept.json();
        const dataPengurus = await resPengurus.json();

        if (dataJenis.success) setJenisKegiatanOptions(dataJenis.data);
        if (dataSatelit.success) setSatelitOptions(dataSatelit.data);
        if (dataKomisi.success) setKomisiOptions(dataKomisi.data);
        if (dataDept.success) setDepartemenOptions(dataDept.data);
        
        if (dataPengurus.success) {
          const mapped = dataPengurus.data.map((p: any) => ({
            id: p.id,
            name: p.nama_lengkap
          }));
          setPengurusOptions(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch master data options', err);
      }
    };
    fetchOptions();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      tipe_penyelenggara: e.target.value,
      satelit_id: '',
      komisi_id: '',
      departemen_id: ''
    }));
  };

  const handleCreate = async (statusOverride: string) => {
    try {
      if (!formData.nama_kegiatan.trim()) {
        alert("Nama Kegiatan wajib diisi!");
        return;
      }
      
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: 'Menyimpan jadwal kegiatan...' });
      
      const payload = { ...formData, status_kegiatan: statusOverride };

      const res = await fetch('/api/kegiatan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Jadwal kegiatan berhasil disimpan!' });
        setTimeout(() => {
          router.push('/dashboard/kegiatan');
        }, 1500);
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal menyimpan kegiatan', errors: data.errors });
        setIsSubmitting(false);
      }
    } catch(err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan pada server saat mengeksekusi.' });
      setIsSubmitting(false);
    }
  };

  // Determine if the selected event is Worship (Kebaktian Umum/Ibadah Raya)
  const selectedJenis = jenisKegiatanOptions.find(jk => jk.id.toString() === formData.jenis_kegiatan_id);
  const isKebaktian = selectedJenis && selectedJenis.nama_jenis_kegiatan.toLowerCase().includes('kebaktian');

  return (
    <div className="w-full flex flex-col gap-6 pb-20 relative">
      {isSubmitting && <SubmitOverlay status={submitState.status} message={submitState.message} />}

      {/* Header Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
          <span className="text-slate-500">Modul Kegiatan</span>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/dashboard/kegiatan" className="text-slate-500 hover:text-blue-600">Daftar Kegiatan</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Tambah Kegiatan Baru</span>
        </div>
        
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex gap-4 items-center">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Buat Kegiatan Baru</h1>
            <div className="px-3 py-1 bg-amber-100 rounded border border-amber-300 flex items-center gap-1 mt-1">
               <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
               <span className="text-amber-800 text-xs font-bold uppercase tracking-wide">DRAFT</span>
            </div>
          </div>
          <div className="text-slate-500 text-sm font-medium font-['Inter'] flex gap-1 items-center">
            <span className="material-icons-round text-lg text-slate-400">qr_code</span> ID: <span className="text-slate-700 font-bold">Otomatis Terbuat</span>
          </div>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-[70%_30%] gap-8 items-start mt-2">
        {/* KOLOM KIRI (70% - Form Utama) */}
        <div className="flex flex-col gap-8">
          
          {/* CARD 1: INFORMASI DASAR */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-full inline-flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-icons-round text-[18px]">info</span>
              </div>
              <span className="text-slate-800 text-sm font-bold font-['Inter'] uppercase tracking-wider">Informasi Dasar</span>
            </div>
            
            <div className="w-full flex-col gap-5 flex">
              <div className="w-full flex-col gap-1.5 flex">
                <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">Nama Kegiatan <span className="text-red-500">*</span></label>
                <input 
                  type="text" name="nama_kegiatan" value={formData.nama_kegiatan} onChange={handleInputChange} 
                  placeholder="Contoh: Ibadah Raya 1 Pagi" 
                  className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" 
                />
              </div>

              <div className="w-full flex gap-5">
                <div className="flex-[2] flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">Jenis Kegiatan <span className="text-red-500">*</span></label>
                  <select name="jenis_kegiatan_id" value={formData.jenis_kegiatan_id} onChange={handleInputChange} className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all cursor-pointer">
                    <option value="">-- Pilih Spesifikasi --</option>
                    {jenisKegiatanOptions.map((jk) => (
                      <option key={jk.id} value={jk.id}>{jk.nama_jenis_kegiatan}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">Frekuensi <span className="text-red-500">*</span></label>
                  <select name="frekuensi_kegiatan" value={formData.frekuensi_kegiatan} onChange={handleInputChange} className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all cursor-pointer">
                    <option value="Mingguan">Mingguan</option>
                    <option value="Bulanan">Bulanan</option>
                    <option value="Tahunan">Tahunan</option>
                    <option value="Insidental">Insidental (Sekali)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: JADWAL & LOKASI */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-100 fill-mode-both">
            <div className="w-full inline-flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-icons-round text-[18px]">event</span>
              </div>
              <span className="text-slate-800 text-sm font-bold font-['Inter'] uppercase tracking-wider">Jadwal & Lokasi</span>
            </div>
            
            <div className="w-full flex-col gap-5 flex">
              <div className="w-full flex gap-5">
                <div className="flex-1 flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase flex items-center gap-1"><span className="material-icons-round text-[14px]">calendar_today</span> Tanggal Mulai <span className="text-red-500">*</span></label>
                  <input type="date" name="tanggal_mulai" value={formData.tanggal_mulai} onChange={handleInputChange} className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                </div>
                <div className="flex-1 flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase flex items-center gap-1"><span className="material-icons-round text-[14px]">event_busy</span> Tanggal Selesai</label>
                  <input type="date" name="tanggal_selesai" value={formData.tanggal_selesai} onChange={handleInputChange} className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                  <span className="text-[10px] text-slate-400 mt-0.5 ml-1">Kosongkan jika acara hanya 1 hari melaju.</span>
                </div>
              </div>

              <div className="w-full flex gap-5">
                <div className="flex-1 flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase flex items-center gap-1"><span className="material-icons-round text-[14px]">schedule</span> Jam Pelaksanaan <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-2">
                    <input type="time" name="waktu_mulai" value={formData.waktu_mulai} onChange={handleInputChange} className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                    <span className="text-slate-400 font-bold">-</span>
                    <input type="time" name="waktu_selesai" value={formData.waktu_selesai} onChange={handleInputChange} className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                  </div>
                </div>
              </div>

              <div className="w-full flex-col gap-1.5 flex mt-2 border-t border-slate-100 pt-5">
                <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase flex items-center gap-1">
                  <span className="material-icons-round text-[14px]">pin_drop</span> Lokasi Kegiatan
                </label>
                <div className="relative">
                  <span className="material-icons-round absolute left-4 top-3 text-slate-400 text-[18px]">place</span>
                  <input type="text" name="lokasi_kegiatan" value={formData.lokasi_kegiatan} onChange={handleInputChange} placeholder="contoh: Ruang Ibadah Utama / Balai Rw 05" className="pl-11 pr-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                </div>
              </div>

              <div className="w-full flex-col gap-1.5 flex mt-2">
                <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase flex items-center gap-1">
                  <span className="material-icons-round text-[14px]">notes</span> Keterangan / Catatan Tambahan (Opsional)
                </label>
                <textarea 
                  name="keterangan" 
                  value={formData.keterangan || ''} 
                  onChange={handleInputChange} 
                  placeholder="Instruksi khusus Sekretaris, misal: Gunakan AC utama maksimal 22 derajat..." 
                  rows={3}
                  className="px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-['Inter'] w-full transition-all resize-none" 
                />
              </div>

            </div>
          </div>

          {/* CARD 3: DETAIL KHUSUS IBADAH (DYNAMIC 🔥) */}
          {isKebaktian && (
            <div className="relative p-6 bg-blue-50/50 rounded-xl shadow-sm border border-blue-100 flex flex-col gap-6 animate-in slide-in-from-top-4 fade-in duration-500 overflow-hidden">
              <div className="absolute right-0 top-0 opacity-[0.03] pointer-events-none">
                 <span className="material-icons-round text-[150px] text-blue-900">auto_stories</span>
              </div>
              <div className="w-full inline-flex items-center justify-between border-b border-blue-100 pb-3 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <span className="material-icons-round text-[18px]">church</span>
                  </div>
                  <span className="text-blue-900 text-sm font-bold font-['Inter'] uppercase tracking-wider">Detail Ibadah (*Auto-Triggered*)</span>
                </div>
                <div className="px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold tracking-wide">
                  MODE KHOTBAH
                </div>
              </div>
              
              <div className="w-full flex-col gap-5 flex z-10">
                <div className="w-full flex-col gap-1.5 flex">
                  <label className="text-blue-800 text-xs font-bold font-['Inter'] uppercase">Tema / Judul Khotbah Mingguan</label>
                  <input type="text" name="tema_khotbah" value={formData.tema_khotbah} onChange={handleInputChange} placeholder="Garam dan Terang Dunia..." className="px-4 py-3 bg-white rounded-lg border border-blue-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-['Inter'] text-sm w-full placeholder-slate-400 transition-all" />
                </div>

                <div className="w-full flex gap-5">
                  <div className="flex-1 flex-col gap-1.5 flex">
                    <HybridAsyncAutocomplete 
                      label="Pengkhotbah Utama" 
                      valueName={formData.nama_pengkhotbah_1} 
                      placeholder="Cari jemaat atau ketik nama tamu..." 
                      onSelect={(name) => setFormData(prev => ({ ...prev, nama_pengkhotbah_1: name }))}
                    />
                    <span className="text-[10px] text-blue-600 mt-0.5 ml-1">Mendukung nama pendeta tamu dari luar gereja.</span>
                  </div>
                  <div className="flex-1 flex-col gap-1.5 flex">
                    <HybridAsyncAutocomplete 
                      label="Pengkhotbah Pendamping (Opsional)" 
                      valueName={formData.nama_pengkhotbah_2} 
                      placeholder="Cari/Ketik nama tandeman atau penerjemah..." 
                      onSelect={(name) => setFormData(prev => ({ ...prev, nama_pengkhotbah_2: name }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* KOLOM KANAN (30% - Sticky Sidebar) */}
        <div className="flex flex-col gap-6 sticky top-20">
          
          {/* CARD 4: PENYELENGGARA & PIC */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-5 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="w-full inline-flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="material-icons-round text-slate-700 text-[20px]">groups</span>
              <span className="text-slate-800 text-sm font-bold font-['Inter'] uppercase tracking-wider">Eksekutor</span>
            </div>
            
            <div className="w-full flex-col gap-4 flex">
              <div className="w-full flex flex-col gap-2">
                <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">Level Organisasi <span className="text-red-500">*</span></label>
                <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-inner">
                  {['Satelit', 'Departemen', 'Komisi'].map(type => (
                    <label key={type} className={`flex-1 flex items-center justify-center p-2 rounded cursor-pointer transition-colors ${formData.tipe_penyelenggara === type ? 'bg-white shadow border border-slate-200 text-blue-700 font-bold' : 'text-slate-500 font-medium hover:text-slate-700'}`}>
                      <input type="radio" value={type} checked={formData.tipe_penyelenggara === type} onChange={handleRadioChange} className="hidden" />
                      <span className="text-xs font-['Inter'] uppercase tracking-wide">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formData.tipe_penyelenggara === 'Satelit' && (
                <div className="w-full flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1">
                  <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">Pilih Satelit <span className="text-red-500">*</span></label>
                  <select name="satelit_id" value={formData.satelit_id} onChange={handleInputChange} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full cursor-pointer">
                    <option value="">-- Pilih --</option>
                    {satelitOptions.map((s) => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                  </select>
                </div>
              )}

              {formData.tipe_penyelenggara === 'Departemen' && (
                <div className="w-full flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1">
                  <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">Pilih Departemen Pusat <span className="text-red-500">*</span></label>
                  <select name="departemen_id" value={formData.departemen_id} onChange={handleInputChange} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full cursor-pointer">
                    <option value="">-- Pilih --</option>
                    {departemenOptions.map((d) => <option key={d.id} value={d.id}>{d.nama_departemen}</option>)}
                  </select>
                </div>
              )}

              {formData.tipe_penyelenggara === 'Komisi' && (
                <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-top-1">
                  <div className="w-full flex flex-col gap-1.5 border border-blue-100 bg-blue-50/30 p-3 rounded-lg">
                    <label className="text-blue-800 text-xs font-bold font-['Inter'] uppercase">1. Induk Satelit <span className="text-red-500">*</span></label>
                    <select name="satelit_id" value={formData.satelit_id} onChange={(e) => { handleInputChange(e); setFormData(prev => ({ ...prev, komisi_id: '' })); }} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full cursor-pointer">
                      <option value="">-- Pilih Satelit Terlebih Dahulu --</option>
                      {satelitOptions.map((s) => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                    </select>
                  </div>
                  
                  <div className="w-full flex flex-col gap-1.5 border border-slate-200 bg-slate-50 p-3 rounded-lg">
                    <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">2. Pilih Komisi Lokal <span className="text-red-500">*</span></label>
                    <select name="komisi_id" value={formData.komisi_id} onChange={handleInputChange} disabled={!formData.satelit_id} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      <option value="">{formData.satelit_id ? '-- Pilih Komisi --' : '-- Menunggu Satelit --'}</option>
                      {komisiOptions.filter(k => k.satelit_id === (formData.satelit_id ? parseInt(formData.satelit_id) : null)).map((k) => <option key={k.id} value={k.id}>{k.nama_komisi}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="w-full border-t border-slate-100 mt-2 pt-4">
                <GenericAutocomplete 
                  label="Penanggung Jawab (PIC)" 
                  valueName={formData.pic_pengurus_name} 
                  valueId={formData.pic_pengurus_id} 
                  options={pengurusOptions} 
                  placeholder="Sorot pengurus..." 
                  onSelect={(id, name) => setFormData(prev => ({ ...prev, pic_pengurus_id: id, pic_pengurus_name: name }))}
                />
              </div>
            </div>
          </div>

          {/* CARD 5: PENGATURAN BIAYA TIKET */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-5 animate-in fade-in slide-in-from-right-2 duration-300 delay-100 fill-mode-both">
            <div className="w-full inline-flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="material-icons-round text-slate-700 text-[20px]">local_activity</span>
              <span className="text-slate-800 text-sm font-bold font-['Inter'] uppercase tracking-wider">Ticketing</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-slate-800 text-sm font-bold">Acara Berbayar?</span>
                <span className="text-slate-400 text-xs">Pendaftaran butuh bayar/tiket?</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="berbayar" checked={formData.berbayar} onChange={handleInputChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            {formData.berbayar && !isKebaktian && (
              <div className="w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-2 mt-2">
                 <span className="text-xs text-blue-700 italic">Pengaturan detail harga tiket akan dibuka setelah kegiatan terbuat.</span>
              </div>
            )}
            {formData.berbayar && isKebaktian && (
              <div className="w-full p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2 mt-2">
                 <span className="material-icons-round text-red-500 text-sm mt-0.5">warning</span>
                 <span className="text-xs text-red-700">Kebaktian umum disarankan tidak mencentang acara berbayar.</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* FLOAT ACTION BAR */}
      <div className="fixed bottom-0 left-[260px] right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] flex items-center justify-between z-40 transition-all md:w-[calc(100%-260px)] w-full ml-[-260px] md:ml-0">
         <button onClick={() => router.back()} className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors text-sm">
           Batalkan
         </button>
         <div className="flex gap-3">
           <button onClick={() => handleCreate('Draft')} className="px-6 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors text-sm border border-slate-200">
             Simpan sebagai Draft
           </button>
           <button onClick={() => handleCreate('Akan Datang')} className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 text-sm flex gap-2 items-center">
             <span className="material-icons-round text-[18px]">publish</span> Publish Jadwal Acara
           </button>
         </div>
      </div>

    </div>
  );
}
