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
      <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">{label}</label>
      <input 
        type="text" 
        value={query} 
        onChange={(e) => search(e.target.value)} 
        onFocus={(e) => search(e.target.value)}
        placeholder={placeholder} 
        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all" 
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
      <label className="text-blue-800 text-xs font-bold font-sans uppercase leading-4">{label}</label>
      <div className="relative">
        <input 
          type="text" 
          value={query} 
          onChange={handleInputChange}
          onFocus={() => { if(query.length >= 3 && results.length > 0) setIsOpen(true); }}
          placeholder={placeholder} 
          className="px-4 py-3 pr-10 bg-white rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all" 
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

export default function EditKegiatanPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const id = unwrappedParams.id;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Master Data Options
  const [jenisKegiatanOptions, setJenisKegiatanOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
  const [pengurusOptions, setPengurusOptions] = useState<{id: string, name: string}[]>([]); // specifically mapped for generic autocomplete
  const [raOptions, setRaOptions] = useState<any[]>([]);
  const [raSearchQuery, setRaSearchQuery] = useState('');

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
    
    // Card 5: Biaya & Akses
    is_published: true,
    butuh_registrasi: false,
    berbayar: false,
    harga_tiket_rp: '',
    kuota_peserta: '',
    
    // Sumber Anggaran (RA Link)
    anggaran_tahunan_id: '',

    status_kegiatan: 'Draft',
    url_banner: ''
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Fetch Existing Data to Prefill Form
  useEffect(() => {
    if (typeof window !== 'undefined') {
       const wParams = new URLSearchParams(window.location.search);
       if (wParams.get('mode') === 'view') {
           setIsViewOnly(true);
       }
    }

    const fetchExistingData = async () => {
       try {
          const res = await fetch(`/api/kegiatan/${id}`);
          const data = await res.json();
          if (data.success && data.data) {
             const k = data.data;
             
             let tipe = 'Satelit';
             if (k.komisi_id) tipe = 'Komisi';
             else if (k.departemen_id) tipe = 'Departemen';

             setFormData({
               nama_kegiatan: k.nama_kegiatan || '',
               jenis_kegiatan_id: k.jenis_kegiatan_id?.toString() || '',
               frekuensi_kegiatan: k.frekuensi_kegiatan || 'Insidental - Tahunan',
               tanggal_mulai: k.tanggal_mulai ? new Date(k.tanggal_mulai).toISOString().split('T')[0] : '',
               tanggal_selesai: k.tanggal_selesai ? new Date(k.tanggal_selesai).toISOString().split('T')[0] : '',
               waktu_mulai: k.waktu_mulai?.substring(0, 5) || '',
               waktu_selesai: k.waktu_selesai?.substring(0, 5) || '',
               lokasi_kegiatan: k.lokasi_kegiatan || '',
               keterangan: k.keterangan || '',
               
               tema_khotbah: k.tema_khotbah || '',
               nama_pengkhotbah_1: k.nama_pengkhotbah_1 || '',
               nama_pengkhotbah_2: k.nama_pengkhotbah_2 || '',
               
               tipe_penyelenggara: tipe,
               satelit_id: k.satelit_id?.toString() || '',
               komisi_id: k.komisi_id?.toString() || '',
               departemen_id: k.departemen_id?.toString() || '',
               pic_pengurus_id: k.pic_pengurus_id?.toString() || '',
               pic_pengurus_name: k.pic_name || '', // Will be injected by dropdown
               
               is_published: k.is_published ?? true,
               butuh_registrasi: k.butuh_registrasi ?? false,
               berbayar: k.berbayar || false,
               harga_tiket_rp: k.harga_tiket_rp?.toString() || '',
               kuota_peserta: k.kuota_peserta?.toString() || '',
               anggaran_tahunan_id: k.anggaran_tahunan_id || '',
               status_kegiatan: k.status_kegiatan || 'Draft',
               url_banner: k.url_banner || ''
             });
          }
       } catch (err) {
         console.error('Failed to load existing data', err);
       }
    };
    fetchExistingData();
  }, [id]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [resJenis, resSatelit, resKomisi, resDept, resPengurus, resRA] = await Promise.all([
          fetch('/api/options?type=jenis_kegiatan'),
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=komisi'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=pengurus'),
          fetch('/api/options?type=ra_approved')
        ]);
        
        const dataJenis = await resJenis.json();
        const dataSatelit = await resSatelit.json();
        const dataKomisi = await resKomisi.json();
        const dataDept = await resDept.json();
        const dataPengurus = await resPengurus.json();
        const dataRA = await resRA.json();

        if (dataJenis.success) setJenisKegiatanOptions(dataJenis.data);
        if (dataSatelit.success) setSatelitOptions(dataSatelit.data);
        if (dataKomisi.success) setKomisiOptions(dataKomisi.data);
        if (dataDept.success) setDepartemenOptions(dataDept.data);
        if (dataRA.success) setRaOptions(dataRA.data);
        
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert('Ukuran maksimal banner 10MB');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setFormData(prev => ({ ...prev, url_banner: '' }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if ((name === 'harga_tiket_rp' || name === 'kuota_peserta') && type === 'number') {
      // Prevent float precision bug (e.g. 49999.999... → parseInt → 49999)
      const rounded = value === '' ? '' : String(Math.round(Number(value)));
      setFormData(prev => ({ ...prev, [name]: rounded }));
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

  const handleUpdate = async (statusOverride: string) => {
    try {
      if (!formData.nama_kegiatan.trim()) {
        alert("Nama Kegiatan wajib diisi!");
        return;
      }
      if (!formData.tanggal_mulai) {
        alert("Tanggal pelaksanaan acara wajib diisi!");
        return;
      }
      if (!formData.waktu_mulai.trim()) {
        alert("Jam mulai acara wajib diisi!");
        return;
      }
      
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: 'Memperbarui jadwal kegiatan...' });
      
      let finalBannerUrl = formData.url_banner;
      if (imageFile) {
        const fileData = new FormData();
        fileData.append('file', imageFile);
        fileData.append('bucket', 'poster-kegiatan');
        
        try {
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: fileData
          });
          const uploadJson = await uploadRes.json();
          if (uploadJson.success) {
            finalBannerUrl = uploadJson.url;
          } else {
            alert('Gagal mengupload banner ke server: ' + uploadJson.message);
            setIsSubmitting(false);
            return;
          }
        } catch (err) {
          console.error(err);
          alert('Terjadi kesalahan jaringan saat mengunggah foto.');
          setIsSubmitting(false);
          return;
        }
      }
      
      const payload = { ...formData, status_kegiatan: statusOverride, url_banner: finalBannerUrl };

      const res = await fetch(`/api/kegiatan/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Jadwal kegiatan berhasil diperbarui!' });
        setTimeout(() => {
           if (statusOverride === 'Akan Datang') {
              router.push(`/kegiatan/${id}`);
           } else {
              router.push('/kegiatan');
           }
        }, 1500);
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal memperbarui kegiatan', errors: data.errors });
        setTimeout(() => setIsSubmitting(false), 3000);
      }
    } catch(err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan pada server saat mengeksekusi.' });
      setTimeout(() => setIsSubmitting(false), 3000);
    }
  };

  // Determine if the selected event is Worship (Kebaktian Umum/Ibadah Raya)
  const selectedJenis = jenisKegiatanOptions.find(jk => jk.id.toString() === formData.jenis_kegiatan_id);
  const isKebaktian = selectedJenis && selectedJenis.nama_jenis_kegiatan.toLowerCase().includes('kebaktian');

  // Approval workflow: lock form when pending approval
  const isPendingApproval = formData.status_kegiatan === 'Menunggu Persetujuan';
  const isFormLocked = isViewOnly || isPendingApproval;

  const handleRecall = async () => {
    try {
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: 'Menarik kembali proposal ke Draft...' });
      const res = await fetch(`/api/kegiatan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_kegiatan: 'Draft' })
      });
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Proposal berhasil ditarik kembali ke Draft. Silakan edit dan ajukan ulang.' });
        setFormData(prev => ({ ...prev, status_kegiatan: 'Draft' }));
        setTimeout(() => {
          setIsSubmitting(false);
          setSubmitState({ status: 'idle', message: '' });
        }, 1800);
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal menarik kembali proposal.' });
        setTimeout(() => setIsSubmitting(false), 3000);
      }
    } catch (err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan server.' });
      setTimeout(() => setIsSubmitting(false), 3000);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-20 relative">
      {isSubmitting && <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => { setIsSubmitting(false); setSubmitState({ status: 'idle', message: '' }); }} />}

      {/* Header Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <span className="text-slate-500">Modul Kegiatan</span>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/kegiatan" className="text-slate-500 hover:text-blue-600">Daftar Kegiatan</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">{isViewOnly ? 'Lihat Proposal' : 'Edit Kegiatan'}</span>
        </div>
        
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex gap-4 items-center">
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">{isViewOnly ? 'Proposal Konfigurasi Kegiatan' : 'Edit Konfigurasi Kegiatan'}</h1>
            {(() => {
              const status = formData.status_kegiatan || 'Draft';
              let colorClass = "bg-slate-100 text-slate-700 border-slate-200 mt-1";
              let dotClass = "bg-slate-500";
              
              if (status === 'Draft') { colorClass = "bg-amber-100 text-amber-800 border-amber-300 mt-1"; dotClass = "bg-amber-500 animate-pulse"; }
              else if (status === 'Menunggu Persetujuan') { colorClass = "bg-orange-100 text-orange-800 border-orange-300 mt-1"; dotClass = "bg-orange-500"; }
              else if (status === 'Ditolak' || status === 'Dibatalkan') { colorClass = "bg-red-100 text-red-800 border-red-300 mt-1"; dotClass = "bg-red-500"; }
              else if (status === 'Akan Datang') { colorClass = "bg-indigo-100 text-indigo-800 border-indigo-300 mt-1"; dotClass = "bg-indigo-500"; }
              else if (status === 'Ongoing') { colorClass = "bg-blue-100 text-blue-800 border-blue-300 mt-1"; dotClass = "bg-blue-500 animate-pulse"; }
              else if (status === 'Selesai') { colorClass = "bg-emerald-100 text-emerald-800 border-emerald-300 mt-1"; dotClass = "bg-emerald-500"; }
              else if (status === 'Menunggu LPJ') { colorClass = "bg-amber-100 text-amber-800 border-amber-300 mt-1"; dotClass = "bg-amber-500"; }

              return (
                <div className={`px-3 py-1 rounded border flex items-center gap-1.5 ${colorClass}`}>
                  <div className={`w-2 h-2 rounded-full ${dotClass}`}></div>
                  <span className="text-xs font-bold uppercase tracking-wide">{status}</span>
                </div>
              );
            })()}
          </div>
          <div className="text-slate-500 text-sm font-medium font-sans flex gap-1 items-center">
            <span className="material-icons-round text-lg text-slate-400">qr_code</span> ID: <span className="text-slate-700 font-bold">Otomatis Terbuat</span>
          </div>
        </div>
      </div>

      {isViewOnly && (
        <div className="w-full p-3 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-bold rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <span className="material-icons-round text-indigo-500">lock</span> Mode Pratinjau Proposal Berlangsung. Seluruh pengisian formulir bersifat Read-Only.
        </div>
      )}

      {isPendingApproval && !isViewOnly && (
        <div className="w-full p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
          <span className="material-icons-round text-orange-500 text-[22px] mt-0.5">hourglass_top</span>
          <div className="flex flex-col gap-1">
            <span className="text-orange-900 text-sm font-bold">Proposal Sedang Dalam Proses Review Majelis</span>
            <span className="text-orange-700 text-xs leading-relaxed">
              Formulir dikunci selama proses persetujuan untuk menjaga integritas data yang sedang ditinjau.
              Jika perlu melakukan perubahan, tarik kembali proposal ke Draft terlebih dahulu.
            </span>
          </div>
        </div>
      )}

      <div className={`w-full grid grid-cols-1 md:grid-cols-[70%_30%] gap-8 items-start mt-2 ${isFormLocked ? 'pointer-events-none opacity-90' : ''}`}>
        {/* KOLOM KIRI (70% - Form Utama) */}
        <div className="flex flex-col gap-8">
          
          {/* CARD 1: INFORMASI DASAR */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-full inline-flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-icons-round text-[18px]">info</span>
              </div>
              <span className="text-slate-800 text-sm font-bold font-sans uppercase tracking-wider">Informasi Dasar</span>
            </div>
            
            <div className="w-full flex-col gap-5 flex">
              <div className="w-full flex-col gap-1.5 flex">
                <label className="text-slate-500 text-xs font-bold font-sans uppercase">Nama Kegiatan <span className="text-red-500">*</span></label>
                <input 
                  type="text" name="nama_kegiatan" value={formData.nama_kegiatan} onChange={handleInputChange} 
                  placeholder="Contoh: Ibadah Raya 1 Pagi" 
                  className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all" 
                />
              </div>

              <div className="w-full flex gap-5">
                <div className="flex-[2] flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-sans uppercase">Jenis Kegiatan <span className="text-red-500">*</span></label>
                  <select name="jenis_kegiatan_id" value={formData.jenis_kegiatan_id} onChange={handleInputChange} className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer">
                    <option value="">-- Pilih Spesifikasi --</option>
                    {jenisKegiatanOptions.map((jk) => (
                      <option key={jk.id} value={jk.id}>{jk.nama_jenis_kegiatan}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-sans uppercase">Frekuensi <span className="text-red-500">*</span></label>
                  <select name="frekuensi_kegiatan" value={formData.frekuensi_kegiatan} onChange={handleInputChange} className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer">
                    <option value="Mingguan">Mingguan</option>
                    <option value="Bulanan">Bulanan</option>
                    <option value="Tahunan">Tahunan</option>
                    <option value="Insidental">Insidental (Sekali)</option>
                  </select>
                </div>
              </div>

              <div className="w-full flex-col gap-1.5 flex mt-2 border-t border-slate-100 pt-5">
                <label className="text-slate-500 text-xs font-bold font-sans uppercase">Poster / Banner Kegiatan (Opsional)</label>
                {imagePreview ? (
                  <div className="relative w-full h-48 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden group">
                    <img src={imagePreview} alt="Banner Preview" onClick={() => setIsLightboxOpen(true)} className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity pointer-events-auto" />
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-2 right-2 w-8 h-8 bg-slate-900/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors">
                      <span className="material-icons-round text-[18px]">close</span>
                    </button>
                    <div className="absolute font-bold text-xs bottom-2 right-2 bg-slate-900/60 text-white px-2 py-1 rounded">Siap Diunggah (Edit)</div>
                  </div>
                ) : formData.url_banner ? (
                  <div className="relative w-full h-48 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden group">
                    <img src={formData.url_banner} alt="Current Banner" onClick={() => setIsLightboxOpen(true)} className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity pointer-events-auto" />
                    <button type="button" onClick={() => { setFormData(prev => ({...prev, url_banner: ''})); }} className="absolute top-2 right-2 w-8 h-8 bg-slate-900/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors">
                      <span className="material-icons-round text-[18px]">close</span>
                    </button>
                    <div className="absolute font-bold text-xs bottom-2 right-2 bg-slate-900/60 text-white px-2 py-1 rounded">Banner Saat Ini</div>
                  </div>
                ) : (
                  <label className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors">
                    <span className="material-icons-round text-slate-400 text-[32px] mb-2">add_photo_alternate</span>
                    <span className="text-sm font-semibold text-slate-600">Klik untuk unggah banner / poster baru</span>
                    <span className="text-xs text-slate-400 px-4 text-center mt-1">Rasio lanskap (16:9) disarankan. Maks: 10MB</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* CARD 2: JADWAL & LOKASI */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-100 fill-mode-both">
            <div className="w-full inline-flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-icons-round text-[18px]">event</span>
              </div>
              <span className="text-slate-800 text-sm font-bold font-sans uppercase tracking-wider">Jadwal & Lokasi</span>
            </div>
            
            <div className="w-full flex-col gap-5 flex">
              <div className="w-full flex gap-5">
                <div className="flex-1 flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-sans uppercase flex items-center gap-1"><span className="material-icons-round text-[14px]">calendar_today</span> Tanggal Mulai <span className="text-red-500">*</span></label>
                  <input type="date" name="tanggal_mulai" value={formData.tanggal_mulai} onChange={handleInputChange} className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-sans w-full transition-all" />
                </div>
                <div className="flex-1 flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-sans uppercase flex items-center gap-1"><span className="material-icons-round text-[14px]">event_busy</span> Tanggal Selesai</label>
                  <input type="date" name="tanggal_selesai" value={formData.tanggal_selesai} onChange={handleInputChange} className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-sans w-full transition-all" />
                  <span className="text-[10px] text-slate-400 mt-0.5 ml-1">Kosongkan jika acara hanya 1 hari melaju.</span>
                </div>
              </div>

              <div className="w-full flex gap-5">
                <div className="flex-1 flex-col gap-1.5 flex">
                  <label className="text-slate-500 text-xs font-bold font-sans uppercase flex items-center gap-1"><span className="material-icons-round text-[14px]">schedule</span> Jam Pelaksanaan <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-2">
                    <input type="time" name="waktu_mulai" value={formData.waktu_mulai} onChange={handleInputChange} className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-sans w-full transition-all" />
                    <span className="text-slate-400 font-bold">-</span>
                    <input type="time" name="waktu_selesai" value={formData.waktu_selesai} onChange={handleInputChange} className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-sans w-full transition-all" />
                  </div>
                </div>
              </div>

              <div className="w-full flex-col gap-1.5 flex mt-2 border-t border-slate-100 pt-5">
                <label className="text-slate-500 text-xs font-bold font-sans uppercase flex items-center gap-1">
                  <span className="material-icons-round text-[14px]">pin_drop</span> Lokasi Kegiatan
                </label>
                <div className="relative">
                  <span className="material-icons-round absolute left-4 top-3 text-slate-400 text-[18px]">place</span>
                  <input type="text" name="lokasi_kegiatan" value={formData.lokasi_kegiatan} onChange={handleInputChange} placeholder="contoh: Ruang Ibadah Utama / Balai Rw 05" className="pl-11 pr-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-sans w-full transition-all" />
                </div>
              </div>

              <div className="w-full flex-col gap-1.5 flex mt-2">
                <label className="text-slate-500 text-xs font-bold font-sans uppercase flex items-center gap-1">
                  <span className="material-icons-round text-[14px]">notes</span> Keterangan / Catatan Tambahan (Opsional)
                </label>
                <textarea 
                  name="keterangan" 
                  value={formData.keterangan || ''} 
                  onChange={handleInputChange} 
                  placeholder="Instruksi khusus Sekretaris, misal: Gunakan AC utama maksimal 22 derajat..." 
                  rows={3}
                  className="px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 text-sm font-sans w-full transition-all resize-none" 
                />
              </div>

            </div>
          </div>

          {/* CARD 3: DETAIL KHUSUS IBADAH (DYNAMIC 🔥) */}
          {isKebaktian && (
            <div className="relative p-6 bg-blue-50/50 rounded-xl shadow-sm border border-blue-100 flex flex-col gap-6 animate-in slide-in-from-top-4 fade-in duration-500">
              <div className="absolute right-0 top-0 w-48 h-48 overflow-hidden pointer-events-none rounded-tr-xl">
                 <span className="material-icons-round text-[150px] text-blue-900 absolute -top-4 -right-4 opacity-[0.03]">auto_stories</span>
              </div>
              <div className="w-full inline-flex items-center justify-between border-b border-blue-100 pb-3 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <span className="material-icons-round text-[18px]">church</span>
                  </div>
                  <span className="text-blue-900 text-sm font-bold font-sans uppercase tracking-wider">Detail Ibadah (*Auto-Triggered*)</span>
                </div>
                <div className="px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold tracking-wide">
                  MODE KHOTBAH
                </div>
              </div>
              
              <div className="w-full flex-col gap-5 flex z-10">
                <div className="w-full flex-col gap-1.5 flex">
                  <label className="text-blue-800 text-xs font-bold font-sans uppercase">Tema / Judul Khotbah Mingguan</label>
                  <input type="text" name="tema_khotbah" value={formData.tema_khotbah} onChange={handleInputChange} placeholder="Garam dan Terang Dunia..." className="px-4 py-3 bg-white rounded-lg border border-blue-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans text-sm w-full placeholder-slate-400 transition-all" />
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

        {/* KOLOM KANAN (30% - Sidebar) */}
        <div className="flex flex-col gap-6">
          
          {/* CARD SUMBER ANGGARAN (RA LINK) */}
          {(() => {
            const selectedRA = raOptions.find(r => r.id === formData.anggaran_tahunan_id);
            const filteredRA = raOptions.filter(r => {
              if (!raSearchQuery) return true;
              const q = raSearchQuery.toLowerCase();
              return (
                r.kode_dokumen?.toLowerCase().includes(q) ||
                r.nama_rancangan?.toLowerCase().includes(q) ||
                r.nama_satelit?.toLowerCase().includes(q) ||
                r.nama_komisi?.toLowerCase().includes(q)
              );
            });
            const multiEventRA = filteredRA.filter(r => r.pola_penggunaan === 'Bertahap');
            const sekaliPakaiRA = filteredRA.filter(r => r.pola_penggunaan === 'Sekali Pakai');

            return (
              <div className="p-6 bg-gradient-to-br from-violet-50 to-white rounded-xl shadow-sm border border-violet-200 flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-300 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 overflow-hidden pointer-events-none rounded-tr-xl">
                  <span className="material-icons-round text-[100px] text-violet-900 absolute -top-3 -right-3 opacity-[0.04]">account_balance_wallet</span>
                </div>
                <div className="w-full inline-flex items-center justify-between border-b border-violet-100 pb-3 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                      <span className="material-icons-round text-[18px]">receipt_long</span>
                    </div>
                    <span className="text-violet-900 text-sm font-bold font-sans uppercase tracking-wider">Sumber Anggaran</span>
                  </div>
                  <div className="px-2 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded text-[10px] font-bold tracking-wide">WAJIB SAAT AJUKAN</div>
                </div>

                {/* Selected RA Summary */}
                {selectedRA ? (
                  <div className="w-full p-4 bg-white rounded-lg border border-violet-200 flex flex-col gap-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-round text-violet-600 text-[16px]">description</span>
                        <span className="text-sm font-black text-violet-800 tracking-wide">{selectedRA.kode_dokumen}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setFormData(prev => ({ ...prev, anggaran_tahunan_id: '' })); setRaSearchQuery(''); }}
                        className="w-6 h-6 rounded-full bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors"
                      >
                        <span className="material-icons-round text-[14px]">close</span>
                      </button>
                    </div>
                    <div className="text-sm font-bold text-slate-900">{selectedRA.nama_rancangan}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      {selectedRA.nama_satelit && <span>🏛️ {selectedRA.nama_satelit}</span>}
                      {selectedRA.nama_komisi && <span>👥 {selectedRA.nama_komisi}</span>}
                    </div>
                    <div className="w-full h-px bg-slate-100 my-1"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Plafon Disetujui</span>
                      <span className="text-sm font-black text-emerald-700">Rp {Number(selectedRA.total_disetujui || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedRA.pola_penggunaan === 'Bertahap' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>{selectedRA.pola_penggunaan === 'Sekali Pakai' ? 'Tunggal' : selectedRA.pola_penggunaan}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedRA.status === 'Disetujui Penuh' 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                          : 'bg-sky-100 text-sky-700 border border-sky-200'
                      }`}>{selectedRA.status}</span>
                      {selectedRA.pola_penggunaan === 'Bertahap' && (
                        <span className="text-[10px] text-slate-500">{selectedRA.jumlah_kegiatan_aktif} kegiatan aktif</span>
                      )}
                    </div>
                  </div>
                ) : (
                  /* RA Search + Selection List */
                  <div className="w-full flex flex-col gap-3">
                    <div className="relative">
                      <span className="material-icons-round absolute left-3 top-2.5 text-violet-400 text-[18px]">search</span>
                      <input
                        type="text"
                        value={raSearchQuery}
                        onChange={(e) => setRaSearchQuery(e.target.value)}
                        placeholder="Cari kode RA atau nama rancangan..."
                        className="pl-10 pr-4 py-2.5 bg-white rounded-lg border border-violet-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all placeholder-slate-400"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                      {filteredRA.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-400 flex flex-col items-center gap-1">
                          <span className="material-icons-round text-[28px] text-slate-300">search_off</span>
                          {raOptions.length === 0 ? 'Belum ada RA yang disetujui Majelis.' : 'Tidak ditemukan RA yang cocok.'}
                        </div>
                      ) : (
                        <>
                          {multiEventRA.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 bg-blue-50 text-[10px] font-bold text-blue-600 uppercase tracking-wider sticky top-0 z-10">🔄 Multi Event</div>
                              {multiEventRA.map(ra => (
                                <button
                                  key={ra.id}
                                  type="button"
                                  onClick={() => { setFormData(prev => ({ ...prev, anggaran_tahunan_id: ra.id })); setRaSearchQuery(''); }}
                                  className="w-full text-left px-3 py-2.5 hover:bg-violet-50 transition-colors flex flex-col gap-0.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-violet-700">{ra.kode_dokumen}</span>
                                    <span className="text-[10px] text-slate-400">·</span>
                                    <span className="text-[10px] text-emerald-600 font-bold">Rp {Number(ra.total_disetujui || 0).toLocaleString('id-ID')}</span>
                                  </div>
                                  <span className="text-xs text-slate-700 font-medium truncate">{ra.nama_rancangan}</span>
                                  <span className="text-[10px] text-slate-400">{ra.jumlah_kegiatan_aktif} kegiatan aktif</span>
                                </button>
                              ))}
                            </>
                          )}
                          {sekaliPakaiRA.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 bg-amber-50 text-[10px] font-bold text-amber-600 uppercase tracking-wider sticky top-0 z-10">📌 Tunggal</div>
                              {sekaliPakaiRA.map(ra => (
                                <button
                                  key={ra.id}
                                  type="button"
                                  disabled={!ra.is_available}
                                  onClick={() => { if (ra.is_available) { setFormData(prev => ({ ...prev, anggaran_tahunan_id: ra.id })); setRaSearchQuery(''); } }}
                                  className={`w-full text-left px-3 py-2.5 transition-colors flex flex-col gap-0.5 ${
                                    ra.is_available ? 'hover:bg-violet-50 cursor-pointer' : 'opacity-50 cursor-not-allowed bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-black ${ra.is_available ? 'text-violet-700' : 'text-slate-400'}`}>{ra.kode_dokumen}</span>
                                    <span className="text-[10px] text-slate-400">·</span>
                                    <span className="text-[10px] text-emerald-600 font-bold">Rp {Number(ra.total_disetujui || 0).toLocaleString('id-ID')}</span>
                                    {!ra.is_available && <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded">SUDAH TERPAKAI</span>}
                                  </div>
                                  <span className="text-xs text-slate-700 font-medium truncate">{ra.nama_rancangan}</span>
                                </button>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-start gap-1">
                      <span className="material-icons-round text-[12px] mt-0.5">info</span>
                      Hanya RA berstatus "Disetujui" yang tampil. Boleh kosong saat Draft.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* CARD 4: PENYELENGGARA & PIC */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-5 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="w-full inline-flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="material-icons-round text-slate-700 text-[20px]">groups</span>
              <span className="text-slate-800 text-sm font-bold font-sans uppercase tracking-wider">Eksekutor</span>
            </div>
            
            <div className="w-full flex-col gap-4 flex">
              <div className="w-full flex flex-col gap-2">
                <label className="text-slate-500 text-xs font-bold font-sans uppercase">Level Organisasi <span className="text-red-500">*</span></label>
                <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-inner">
                  {['Satelit', 'Departemen', 'Komisi'].map(type => (
                    <label key={type} className={`flex-1 flex items-center justify-center p-2 rounded cursor-pointer transition-colors ${formData.tipe_penyelenggara === type ? 'bg-white shadow border border-slate-200 text-blue-700 font-bold' : 'text-slate-500 font-medium hover:text-slate-700'}`}>
                      <input type="radio" value={type} checked={formData.tipe_penyelenggara === type} onChange={handleRadioChange} className="hidden" />
                      <span className="text-xs font-sans uppercase tracking-wide">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formData.tipe_penyelenggara === 'Satelit' && (
                <div className="w-full flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1">
                  <label className="text-slate-500 text-xs font-bold font-sans uppercase">Pilih Satelit <span className="text-red-500">*</span></label>
                  <select name="satelit_id" value={formData.satelit_id} onChange={handleInputChange} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full cursor-pointer">
                    <option value="">-- Pilih --</option>
                    {satelitOptions.map((s) => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                  </select>
                </div>
              )}

              {formData.tipe_penyelenggara === 'Departemen' && (
                <div className="w-full flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1">
                  <label className="text-slate-500 text-xs font-bold font-sans uppercase">Pilih Departemen Pusat <span className="text-red-500">*</span></label>
                  <select name="departemen_id" value={formData.departemen_id} onChange={handleInputChange} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full cursor-pointer">
                    <option value="">-- Pilih --</option>
                    {departemenOptions.map((d) => <option key={d.id} value={d.id}>{d.nama_departemen}</option>)}
                  </select>
                </div>
              )}

              {formData.tipe_penyelenggara === 'Komisi' && (
                <div className="w-full flex flex-col gap-4 animate-in fade-in slide-in-from-top-1">
                  <div className="w-full flex flex-col gap-1.5 border border-blue-100 bg-blue-50/30 p-3 rounded-lg">
                    <label className="text-blue-800 text-xs font-bold font-sans uppercase">1. Induk Satelit <span className="text-red-500">*</span></label>
                    <select name="satelit_id" value={formData.satelit_id} onChange={(e) => { handleInputChange(e); setFormData(prev => ({ ...prev, komisi_id: '' })); }} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full cursor-pointer">
                      <option value="">-- Pilih Satelit Terlebih Dahulu --</option>
                      {satelitOptions.map((s) => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                    </select>
                  </div>
                  
                  <div className="w-full flex flex-col gap-1.5 border border-slate-200 bg-slate-50 p-3 rounded-lg">
                    <label className="text-slate-500 text-xs font-bold font-sans uppercase">2. Pilih Komisi Lokal <span className="text-red-500">*</span></label>
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

          {/* CARD 5: PENGATURAN AKSES & BIAYA */}
          <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6 animate-in fade-in slide-in-from-right-2 duration-300 delay-100 fill-mode-both">
            <div className="w-full inline-flex items-center gap-2 border-b border-slate-100 pb-3">
               <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                 <span className="material-icons-round text-[16px]">settings_accessibility</span>
               </div>
              <span className="text-slate-800 text-sm font-bold font-sans uppercase tracking-wider">Akses & Publikasi</span>
            </div>
            
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col max-w-[200px]">
                  <span className="text-slate-800 text-sm font-bold">Publish ke Portal?</span>
                  <span className="text-slate-500 text-[11px] leading-tight mt-1">Acara akan ditampilkan di Timeline aplikasi Jemaat.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input type="checkbox" name="is_published" checked={formData.is_published} onChange={handleInputChange} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none ring-0 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="w-full h-px bg-slate-100"></div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col max-w-[200px]">
                  <span className="text-slate-800 text-sm font-bold">Wajib Registrasi?</span>
                  <span className="text-slate-500 text-[11px] leading-tight mt-1">Jemaat harus mengisi form daftar. Jika off, jemaat langsung datang (Go-Show).</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input type="checkbox" name="butuh_registrasi" checked={formData.butuh_registrasi} onChange={handleInputChange} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none ring-0 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
              
              <div className="w-full h-px bg-slate-100"></div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col max-w-[200px]">
                  <span className="text-slate-800 text-sm font-bold">Acara Berbayar?</span>
                  <span className="text-slate-500 text-[11px] leading-tight mt-1">Tiket pendaftaran memerlukan pembayaran online / manual.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input type="checkbox" name="berbayar" checked={formData.berbayar} onChange={handleInputChange} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none ring-0 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
            
            {formData.berbayar && !isKebaktian && (
              <div className="w-full p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-2 mt-2">
                 <div className="w-full flex-col gap-1.5 flex">
                    <label className="text-blue-800 text-xs font-bold font-sans uppercase">Harga Tiket (Rp)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-slate-500 text-sm font-bold">Rp</span>
                      <input type="number" min="0" step="1" name="harga_tiket_rp" value={formData.harga_tiket_rp} onChange={handleInputChange} placeholder="0" className="pl-11 pr-4 py-3 bg-white rounded-lg border border-blue-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans text-sm w-full transition-all" />
                    </div>
                 </div>
              </div>
            )}
            
            {formData.butuh_registrasi && (
              <div className="w-full p-4 bg-amber-50 border border-amber-100 rounded-lg animate-in fade-in slide-in-from-top-2 mt-2">
                 <div className="w-full flex-col gap-1.5 flex">
                    <label className="text-amber-800 text-xs font-bold font-sans uppercase">Kuota / Batas Peserta (Opsional)</label>
                    <input type="number" min="1" step="1" name="kuota_peserta" value={formData.kuota_peserta} onChange={handleInputChange} placeholder="Biarkan kosong jika tidak berbatas" className="px-4 py-3 bg-white rounded-lg border border-amber-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-sans text-sm w-full transition-all" />
                 </div>
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
      {!isViewOnly && (
        <div className="fixed bottom-0 left-[260px] right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] flex items-center justify-between z-40 transition-all md:w-[calc(100%-260px)] w-full ml-[-260px] md:ml-0">
           <button onClick={() => router.back()} className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors text-sm">
             Batalkan
           </button>
           <div className="flex gap-3">
             {isPendingApproval ? (
               /* Status: Menunggu Persetujuan → only allow recall */
               <button onClick={handleRecall} className="px-8 py-2.5 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30 text-sm flex gap-2 items-center">
                 <span className="material-icons-round text-[18px]">undo</span> Tarik Kembali ke Draft
               </button>
             ) : formData.status_kegiatan === 'Draft' ? (
               <>
                 <button onClick={() => handleUpdate('Draft')} className="px-6 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors text-sm border border-slate-200">
                   Simpan sebagai Draft
                 </button>
                 <button onClick={() => setShowConfirmDialog(true)} className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 text-sm flex gap-2 items-center">
                   <span className="material-icons-round text-[18px]">send</span> Ajukan Jadwal Acara
                 </button>
               </>
             ) : formData.status_kegiatan === 'Ditolak' ? (
               <>
                 <button onClick={() => handleUpdate('Draft')} className="px-6 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors text-sm border border-slate-200">
                   Simpan sebagai Draft
                 </button>
                 <button onClick={() => setShowConfirmDialog(true)} className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 text-sm flex gap-2 items-center">
                   <span className="material-icons-round text-[18px]">send</span> Ajukan Ulang
                 </button>
               </>
             ) : (
               <button onClick={() => handleUpdate(formData.status_kegiatan)} className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 text-sm flex gap-2 items-center">
                 <span className="material-icons-round text-[18px]">save</span> Simpan Perubahan
               </button>
             )}
           </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG - Submit Proposal */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-0 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <span className="material-icons-round text-white text-[22px]">warning</span>
              </div>
              <div>
                <h3 className="text-white font-black text-lg">Konfirmasi Pengajuan</h3>
                <p className="text-white/80 text-xs font-medium">Proposal akan dikirim ke Majelis</p>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2 text-sm text-slate-700 leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="material-icons-round text-amber-500 text-[16px] mt-0.5">lock</span>
                  <span>Setelah diajukan, formulir kegiatan <b>akan dikunci</b> dan tidak bisa diedit selama proses review.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="material-icons-round text-blue-500 text-[16px] mt-0.5">info</span>
                  <span>Jika perlu perubahan, Anda harus <b>"Tarik Kembali ke Draft"</b> terlebih dahulu.</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Kegiatan yang akan diajukan:</span>
                <p className="text-sm font-bold text-slate-900 mt-1">{formData.nama_kegiatan || '(Tanpa Nama)'}</p>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors text-sm"
                >
                  Batal, Periksa Lagi
                </button>
                <button
                  onClick={() => { setShowConfirmDialog(false); handleUpdate('Menunggu Persetujuan'); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 text-sm flex items-center justify-center gap-2"
                >
                  <span className="material-icons-round text-[16px]">send</span> Ya, Ajukan Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX MODAL */}
      {isLightboxOpen && (imagePreview || formData.url_banner) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200" onClick={() => setIsLightboxOpen(false)}>
           <span className="absolute top-6 right-8 text-white material-icons-round text-[32px] cursor-pointer hover:scale-110 transition-transform">close</span>
           <img src={(imagePreview || formData.url_banner) as string} alt="Banner Full" className="max-w-full max-h-full object-contain cursor-default rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}
