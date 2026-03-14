'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Helper component for Jemaat Autocomplete
const JemaatAutocomplete = ({ 
  label, 
  valueName, 
  valueId, 
  onSelect,
  placeholder = "Ketik nama..." 
}: { 
  label: string, 
  valueName: string, 
  valueId: string, 
  onSelect: (id: string, name: string) => void,
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
      onSelect('', searchTerm); // Just name, no ID
      return;
    }
    
    onSelect('', searchTerm); // Update name while typing, ID null
    
    try {
      setLoading(true);
      const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(searchTerm)}`);
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
        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" 
      />
      
      {isOpen && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-slate-500">Mencari...</div>
          ) : (
            results.map((j) => (
              <div 
                key={j.id} 
                className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                onClick={() => {
                  onSelect(j.id.toString(), j.nama_lengkap);
                  setQuery(j.nama_lengkap);
                  setIsOpen(false);
                }}
              >
                <div className="text-sm font-semibold text-slate-900">{j.nama_lengkap}</div>
                <div className="text-xs text-slate-500">{j.jemaat_id} • {j.jenis_kelamin}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default function NewJemaatPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  
  // Options State
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
  const [pekerjaanOptions, setPekerjaanOptions] = useState<any[]>([]);

  // Auth State
  const [userData, setUserData] = useState<any>(null);

  // Form State mapped to exact Schema
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    jenis_kelamin: 'Laki-laki',
    nik: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    alamat: '',
    kota: 'Surabaya',
    kecamatan: '',
    kelurahan: '',
    kode_pos: '',
    no_hp: '',
    email: '',
    pekerjaan: '',
    satelit_id: '',
    komisi_ids: [] as string[],
    status_baptis: 'Belum',
    tanggal_baptis: '',
    status_pernikahan: 'Lajang',
    status_jemaat: 'Aktif',
    foto_url: '',
    
    // Family
    ayah_id: '',
    ayah_nama: '',
    gereja_asal_ayah: '',
    ibu_id: '',
    ibu_nama: '',
    gereja_asal_ibu: '',
    pasangan_id: '',
    pasangan_nama: '',
    gereja_asal_pasangan: '',
    anak: [] as { anak_jemaat_id: string, nama_anak: string, gereja_asal_anak: string }[],
    saudara: [] as { saudara_jemaat_id: string, nama_saudara: string, gereja_asal_saudara: string }[],
    pekerjaan_id: '',
    departemen_ids: [] as string[],
  });

  const [inputPekerjaanManual, setInputPekerjaanManual] = useState(false);

  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      try {
        const [resSatelit, resKomisi, resDepartemen, resPekerjaan, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=komisi'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=pekerjaan'),
          fetch('/api/auth/me')
        ]);
        const satelitData = await resSatelit.json();
        const komisiData = await resKomisi.json();
        const deptData = await resDepartemen.json();
        const pekrData = await resPekerjaan.json();
        const authData = resUser.ok ? await resUser.json() : null;

        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (komisiData.success) setKomisiOptions(komisiData.data);
        if (deptData.success) setDepartemenOptions(deptData.data);
        if (pekrData.success) setPekerjaanOptions(pekrData.data);
        if (authData) {
          setUserData(authData);
          if (authData.role_name === 'GEMBALA SATELIT') {
            setFormData(prev => ({ ...prev, satelit_id: authData.satelit_id?.toString() || '' }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      }
    };
    fetchOptionsAndUser();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert('Ukuran maksimal foto 10MB');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setFormData(prev => ({ ...prev, foto_url: '' }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData((prev) => {
      if (checked) {
        return { ...prev, komisi_ids: [...prev.komisi_ids, value] };
      } else {
        return { ...prev, komisi_ids: prev.komisi_ids.filter((id) => id !== value) };
      }
    });
  };

  const handleDeptCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData((prev) => {
      if (checked) {
        return { ...prev, departemen_ids: [...prev.departemen_ids, value] };
      } else {
        return { ...prev, departemen_ids: prev.departemen_ids.filter((id) => id !== value) };
      }
    });
  };

  const handlePekerjaanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'Other') {
      setInputPekerjaanManual(true);
      setFormData(prev => ({ ...prev, pekerjaan_id: '', pekerjaan: '' }));
    } else {
      setInputPekerjaanManual(false);
      setFormData(prev => ({ ...prev, pekerjaan_id: val, pekerjaan: '' })); // backend will fetch by id or we let standard
    }
  };

  const handleAddAnak = () => {
    setFormData(prev => ({
      ...prev,
      anak: [...prev.anak, { anak_jemaat_id: '', nama_anak: '', gereja_asal_anak: '' }]
    }));
  };

  const handleRemoveAnak = (index: number) => {
    setFormData(prev => ({
      ...prev,
      anak: prev.anak.filter((_, i) => i !== index)
    }));
  };

  const handleAnakChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const newAnak = [...prev.anak];
      newAnak[index] = { ...newAnak[index], [field]: value };
      return { ...prev, anak: newAnak };
    });
  };

  const handleAddSaudara = () => {
    setFormData(prev => ({
      ...prev,
      saudara: [...prev.saudara, { saudara_jemaat_id: '', nama_saudara: '', gereja_asal_saudara: '' }]
    }));
  };

  const handleRemoveSaudara = (index: number) => {
    setFormData(prev => ({
      ...prev,
      saudara: prev.saudara.filter((_, i) => i !== index)
    }));
  };

  const handleSaudaraChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const newSaudara = [...prev.saudara];
      newSaudara[index] = { ...newSaudara[index], [field]: value };
      return { ...prev, saudara: newSaudara };
    });
  };

  const handleCreate = async () => {
    try {
      setIsSubmitting(true);
      
      let finalFotoUrl = formData.foto_url;
      if (imageFile) {
        const fileData = new FormData();
        fileData.append('file', imageFile);
        const uploadRes = await fetch('/api/upload', {
           method: 'POST',
           body: fileData
        });
        const uploadJson = await uploadRes.json();
        if (uploadJson.success) {
           finalFotoUrl = uploadJson.url;
        } else {
           alert('Gagal mengupload foto: ' + uploadJson.message);
           setIsSubmitting(false);
           return;
        }
      }

      const payload = { ...formData, foto_url: finalFotoUrl || null };

      const res = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Data jemaat berhasil disimpan!');
        router.push('/dashboard/members');
      } else {
        alert('Gagal menyimpan data: ' + data.message);
      }
    } catch(err) {
      console.error(err);
      alert('Terjadi kesalahan pada server saat menyimpan data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-10">
      
      {/* Breadcrumb & Title Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
          <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
            <Link href="/dashboard" className="text-slate-500 hover:text-blue-600">Manajemen User</Link>
            <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
            <Link href="/dashboard/members" className="text-slate-500 hover:text-blue-600">Jemaat</Link>
            <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
            <span className="text-slate-700 font-bold">Tambah Jemaat</span>
          </div>
          <div className="self-stretch inline-flex justify-between items-end">
            <div className="inline-flex flex-col justify-start items-start">
              <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Registrasi Jemaat</h1>
              <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 flex gap-1">
                <span>ID Jemaat:</span>
                <span className="text-slate-700 font-bold">Otomatis Terbuat</span>
              </div>
            </div>
          </div>
        </div>

      {/* Tabs */}
      <div className="w-full border-b border-slate-200 inline-flex justify-start items-start gap-8">
          <div className="px-2 py-3 border-b-2 border-slate-700 inline-flex flex-col justify-center items-center cursor-pointer">
            <span className="text-slate-700 text-sm font-bold font-['Inter'] leading-5">Data Jemaat</span>
          </div>
          <div className="px-2 py-3 border-b-2 border-transparent inline-flex flex-col justify-center items-center cursor-not-allowed opacity-50">
            <span className="text-slate-400 text-sm font-bold font-['Inter'] leading-5">Family Tree</span>
          </div>
        </div>

      {/* Content Area */}
      <div className="w-full flex flex-col justify-start items-start gap-8 mt-2">
            
            {/* Top Identity Card */}
            <div className="w-full p-6 bg-white rounded-xl shadow-sm border border-slate-200 inline-flex justify-start items-center gap-6">
              <div className="relative inline-flex flex-col justify-start items-start group">
                <div className="w-32 h-32 bg-slate-100 rounded-xl border-2 border-slate-200 inline-flex justify-center items-center overflow-hidden">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-icons-round text-slate-300 text-[64px]">person</span>
                  )}
                </div>
                <label className="w-8 h-8 absolute right-[-10px] bottom-[-10px] bg-slate-700 rounded-full border-2 border-white cursor-pointer inline-flex justify-center items-center hover:bg-slate-800 transition-colors shadow-lg z-10">
                  <span className="material-icons-round text-white text-[16px]">add_a_photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              </div>
              <div className="inline-flex flex-col justify-start items-start w-full">
                <input 
                  type="text"
                  name="nama_lengkap"
                  value={formData.nama_lengkap}
                  onChange={handleInputChange}
                  placeholder="Ketik nama lengkap di sini..."
                  className="w-full bg-transparent focus:outline-none focus:border-blue-500 border-b border-transparent text-slate-900 text-2xl font-bold font-['Inter'] leading-8 mb-1" 
                />
                <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 mb-3">
                  Silakan lengkapi seluruh formulir registrasi jemaat baru.
                </div>
                <div className="self-stretch pt-2 inline-flex justify-start items-start gap-2">
                    <div className="px-3 py-1 bg-green-100 rounded-full inline-flex flex-col justify-start items-start">
                        <div className="text-green-700 text-[10px] font-bold font-['Inter'] uppercase leading-4 tracking-wide">Pendaftaran Baru</div>
                    </div>
                </div>
              </div>
            </div>

            {/* Grid Form Sections */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              
              {/* KOLOM KIRI */}
              <div className="flex flex-col gap-8">
                {/* Informasi Personal */}
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6">
                  <div className="w-full inline-flex justify-start items-center gap-2">
                    <span className="material-icons-round text-slate-700 text-[18px]">badge</span>
                    <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Informasi Personal</span>
                  </div>
                  
                  <div className="w-full flex-col gap-4 flex">
                    <div className="w-full flex gap-4">
                      <div className="flex-[2] flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">No. NIK KTP</label>
                        <input type="text" name="nik" value={formData.nik} onChange={handleInputChange} placeholder="16 Digit NIK" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Jenis Kelamin</label>
                        <select name="jenis_kelamin" value={formData.jenis_kelamin} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all">
                          <option value="Laki-laki">Laki-laki</option>
                          <option value="Perempuan">Perempuan</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="w-full flex gap-4">
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kota Lahir</label>
                        <input type="text" name="tempat_lahir" value={formData.tempat_lahir} onChange={handleInputChange} placeholder="Asal kota" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tanggal Lahir</label>
                        <input type="date" name="tanggal_lahir" value={formData.tanggal_lahir} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    </div>

                    <div className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Pekerjaan</label>
                      <select name="pekerjaan_id" value={formData.pekerjaan_id || (inputPekerjaanManual ? 'Other' : '')} onChange={handlePekerjaanChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all">
                        <option value="">-- Pilih Pekerjaan --</option>
                        {pekerjaanOptions.map((p) => (
                           <option key={p.id} value={p.id}>{p.nama_pekerjaan}</option>
                        ))}
                        <option value="Other">Lainnya (Ketik Manual)</option>
                      </select>
                      {inputPekerjaanManual && (
                         <input type="text" name="pekerjaan" value={formData.pekerjaan || ''} onChange={handleInputChange} placeholder="Ketik profesi/pekerjaan manual..." className="mt-2 px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Jemaat */}
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
                  <div className="w-full inline-flex justify-start items-center gap-2">
                    <span className="material-icons-round text-slate-700 text-[20px]">how_to_reg</span>
                    <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Status Jemaat & Baptis</span>
                  </div>
                  
                  <div className="w-full flex-col gap-4 flex">
                    <div className="w-full flex gap-4">
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Status Baptis</label>
                        <select name="status_baptis" value={formData.status_baptis} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all">
                          <option value="Sudah">Sudah Baptis</option>
                          <option value="Belum">Belum Baptis</option>
                        </select>
                      </div>
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tanggal Baptis</label>
                        <input type="date" name="tanggal_baptis" value={formData.tanggal_baptis} onChange={handleInputChange} disabled={formData.status_baptis !== 'Sudah'} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    </div>

                    <div className="w-full flex gap-4">
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Status Hubungan</label>
                        <select name="status_pernikahan" value={formData.status_pernikahan} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all">
                          <option value="Lajang">Lajang</option>
                          <option value="Menikah">Menikah</option>
                          <option value="Duda">Duda</option>
                          <option value="Janda">Janda</option>
                        </select>
                      </div>
                      
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Keaktifan Jemaat</label>
                        <select name="status_jemaat" value={formData.status_jemaat} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all">
                          <option value="Aktif">Aktif</option>
                          <option value="Tidak Aktif">Tidak Aktif</option>
                          <option value="Keluar">Keluar</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Pasangan — hanya tampil jika Menikah */}
                {formData.status_pernikahan === 'Menikah' && (
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
                  <div className="w-full inline-flex justify-start items-center gap-2">
                    <span className="material-icons-round text-slate-700 text-[20px]">favorite</span>
                    <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Data Pasangan</span>
                  </div>
                  <div className="w-full flex-col gap-4 flex">
                    <JemaatAutocomplete 
                      label="Nama Pasangan"
                      valueName={formData.pasangan_nama}
                      valueId={formData.pasangan_id}
                      placeholder="Cari jemaat..."
                      onSelect={(id, name) => setFormData(prev => ({ ...prev, pasangan_id: id, pasangan_nama: name }))}
                    />
                    {!formData.pasangan_id && formData.pasangan_nama.length > 2 && (
                      <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-1">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Gereja Asal Pasangan</label>
                        <input type="text" name="gereja_asal_pasangan" value={formData.gereja_asal_pasangan} onChange={handleInputChange} placeholder="Isi jika dari gereja luar" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    )}
                  </div>
                </div>
                )}
                {/* Data Anak */}
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
                  <div className="w-full inline-flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-icons-round text-slate-700 text-[20px]">child_care</span>
                      <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Data Anak</span>
                    </div>
                    <button type="button" onClick={handleAddAnak} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center gap-1 transition-colors text-xs font-bold">
                      <span className="material-icons-round text-[16px]">add</span> Tambah Anak
                    </button>
                  </div>
                  
                  {formData.anak.map((ank, idx) => (
                    <div key={idx} className="w-full bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col gap-3">
                      {/* Item header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Anak ke-{idx + 1}</span>
                        <button type="button" onClick={() => handleRemoveAnak(idx)}
                          className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors">
                          <span className="material-icons-round" style={{fontSize: 14}}>close</span>
                        </button>
                      </div>
                      <JemaatAutocomplete 
                        label=""
                        valueName={ank.nama_anak}
                        valueId={ank.anak_jemaat_id}
                        placeholder="Cari Database / Ketik Nama..."
                        onSelect={(id, name) => {
                          handleAnakChange(idx, 'anak_jemaat_id', id);
                          handleAnakChange(idx, 'nama_anak', name);
                        }}
                      />
                      {!ank.anak_jemaat_id && ank.nama_anak.length > 2 && (
                        <div className="w-full flex-col gap-1 flex">
                          <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Gereja Asal</label>
                          <input type="text" value={ank.gereja_asal_anak} onChange={(e) => handleAnakChange(idx, 'gereja_asal_anak', e.target.value)} placeholder="Isi jika dari gereja luar" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {formData.anak.length === 0 && (
                    <div className="w-full py-4 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <span className="material-icons-round text-3xl opacity-50">child_care</span>
                      <span className="text-xs font-['Inter']">Belum ada data anak. Klik "+ Tambah Anak".</span>
                    </div>
                  )}
                </div>

                {/* Data Saudara */}
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
                  <div className="w-full inline-flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-icons-round text-slate-700 text-[20px]">people</span>
                      <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Data Saudara Kandung</span>
                    </div>
                    <button type="button" onClick={handleAddSaudara} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg flex items-center gap-1 transition-colors text-xs font-bold">
                      <span className="material-icons-round text-[16px]">add</span> Tambah Saudara
                    </button>
                  </div>

                  {formData.saudara.map((sd, idx) => (
                    <div key={idx} className="w-full bg-amber-50/50 rounded-xl border border-amber-100 p-4 flex flex-col gap-3">
                      {/* Item header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">Saudara ke-{idx + 1}</span>
                        <button type="button" onClick={() => handleRemoveSaudara(idx)}
                          className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors">
                          <span className="material-icons-round" style={{fontSize: 14}}>close</span>
                        </button>
                      </div>
                      <JemaatAutocomplete
                        label=""
                        valueName={sd.nama_saudara}
                        valueId={sd.saudara_jemaat_id}
                        placeholder="Cari Database Jemaat..."
                        onSelect={(id, name) => {
                          handleSaudaraChange(idx, 'saudara_jemaat_id', id);
                          handleSaudaraChange(idx, 'nama_saudara', name);
                          if (id) handleSaudaraChange(idx, 'gereja_asal_saudara', '');
                        }}
                      />
                      {!sd.saudara_jemaat_id && sd.nama_saudara.length > 2 && (
                        <div className="w-full flex-col gap-1 flex">
                          <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Gereja Asal</label>
                          <input
                            type="text"
                            value={(sd as any).gereja_asal_saudara || ''}
                            onChange={(e) => handleSaudaraChange(idx, 'gereja_asal_saudara', e.target.value)}
                            placeholder="Isi jika dari gereja luar"
                            className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400 text-slate-900 text-sm font-['Inter'] w-full transition-all"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {formData.saudara.length === 0 && (
                    <div className="w-full py-4 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <span className="material-icons-round text-3xl opacity-50">people_outline</span>
                      <span className="text-xs font-['Inter']">Belum ada data saudara. Klik "+ Tambah Saudara".</span>
                    </div>
                  )}
                </div>

              </div>

              {/* KOLOM KANAN */}
              <div className="flex flex-col gap-8">
                {/* Kontak & Domisili */}
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
                  <div className="w-full inline-flex justify-start items-center gap-2">
                    <span className="material-icons-round text-slate-700 text-xl">contact_mail</span>
                    <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Kontak & Domisili</span>
                  </div>
                  
                  <div className="w-full flex-col gap-4 flex">
                    <div className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Alamat Domisili</label>
                      <input type="text" name="alamat" value={formData.alamat} onChange={handleInputChange} placeholder="Masukkan alamat lengkap" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                    </div>
                    
                    <div className="w-full flex gap-4">
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kecamatan</label>
                        <input type="text" name="kecamatan" value={formData.kecamatan} onChange={handleInputChange} placeholder="Mulyorejo" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kelurahan</label>
                        <input type="text" name="kelurahan" value={formData.kelurahan} onChange={handleInputChange} placeholder="Kalisari" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    </div>

                    <div className="w-full flex gap-4">
                      <div className="flex-[2] flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kota</label>
                        <input type="text" name="kota" value={formData.kota} onChange={handleInputChange} placeholder="Surabaya" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kode Pos</label>
                        <input type="text" name="kode_pos" value={formData.kode_pos} onChange={handleInputChange} placeholder="60293" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    </div>
                    
                    <div className="w-full flex gap-4">
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">No Telepon / WA</label>
                        <div className="relative w-full">
                          <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold font-['Inter']">+62</span>
                          <input type="text" name="no_hp" value={formData.no_hp} onChange={handleInputChange} placeholder="812345678" className="pl-12 pr-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                        </div>
                      </div>
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Alamat Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="email@gmail.com" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Orang Tua */}
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
                  <div className="w-full inline-flex justify-start items-center gap-2">
                    <span className="material-icons-round text-slate-700 text-[20px]">family_restroom</span>
                    <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Data Orang Tua</span>
                  </div>
                  
                  <div className="w-full flex-col gap-4 flex border-b border-slate-100 pb-4 mb-1">
                    <JemaatAutocomplete 
                      label="Nama Ayah"
                      valueName={formData.ayah_nama}
                      valueId={formData.ayah_id}
                      placeholder="Cari Database / Ketik Nama..."
                      onSelect={(id, name) => setFormData(prev => ({ ...prev, ayah_id: id, ayah_nama: name }))}
                    />
                    {!formData.ayah_id && formData.ayah_nama.length > 2 && (
                      <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-1">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Gereja Asal Ayah</label>
                        <input type="text" name="gereja_asal_ayah" value={formData.gereja_asal_ayah} onChange={handleInputChange} placeholder="Isi jika dari gereja luar" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    )}
                  </div>

                  <div className="w-full flex-col gap-4 flex">
                    <JemaatAutocomplete 
                      label="Nama Ibu"
                      valueName={formData.ibu_nama}
                      valueId={formData.ibu_id}
                      placeholder="Cari Database / Ketik Nama..."
                      onSelect={(id, name) => setFormData(prev => ({ ...prev, ibu_id: id, ibu_nama: name }))}
                    />
                    {!formData.ibu_id && formData.ibu_nama.length > 2 && (
                      <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-1">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Gereja Asal Ibu</label>
                        <input type="text" name="gereja_asal_ibu" value={formData.gereja_asal_ibu} onChange={handleInputChange} placeholder="Isi jika dari gereja luar" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Detail Satelit & Komisi */}
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
                  <div className="w-full inline-flex justify-start items-center gap-2">
                    <span className="material-icons-round text-slate-700 text-xl">church</span>
                    <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Detail Satelit</span>
                  </div>
                  
                  <div className="w-full flex-col gap-4 flex">
                    <div className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Nama Satelit</label>
                      <select 
                        name="satelit_id" 
                        value={formData.satelit_id} 
                        onChange={handleInputChange} 
                        disabled={userData?.role_name === 'GEMBALA SATELIT'}
                        className={`px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 text-sm font-['Inter'] w-full transition-all ${
                          userData?.role_name === 'GEMBALA SATELIT' ? 'bg-slate-200 cursor-not-allowed opacity-70' : 'bg-white focus:border-blue-500 scrollbar-hide'
                        }`}
                      >
                        {userData?.role_name !== 'GEMBALA SATELIT' && <option value="">-- Pilih Satelit Utama --</option>}
                        {satelitOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4 mb-2">Nama Komisi (Bisa Pilih Lebih dari 1)</label>
                      <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-slate-200">
                        {!formData.satelit_id ? (
                          <span className="text-sm text-slate-400 italic">Pilih satelit utama terlebih dahulu</span>
                        ) : (
                          komisiOptions
                            .filter((k) => k.satelit_id.toString() === formData.satelit_id)
                            .map((k) => (
                              <label key={k.id} className="flex items-center gap-2 cursor-pointer pr-4 hover:bg-slate-50 p-1 rounded-md transition-colors">
                                <input
                                  type="checkbox"
                                  value={k.id.toString()}
                                  checked={formData.komisi_ids.includes(k.id.toString())}
                                  onChange={handleCheckboxChange}
                                  className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-slate-700 text-sm font-['Inter']">{k.nama_komisi}</span>
                              </label>
                            ))
                        )}
                        {formData.satelit_id && komisiOptions.filter(k => k.satelit_id.toString() === formData.satelit_id).length === 0 && (
                          <span className="text-sm text-slate-400 italic">Gereja ini belum memiliki struktur komisi</span>
                        )}
                      </div>
                    </div>

                    <div className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4 mb-2">Nama Departemen (Bisa Pilih Lebih dari 1)</label>
                      <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-slate-200">
                        {departemenOptions.length === 0 ? (
                            <span className="text-sm text-slate-400 italic">Belum ada data departemen</span>
                          ) : (
                            departemenOptions.map((d) => (
                              <label key={d.id} className="flex items-center gap-2 cursor-pointer pr-4 hover:bg-slate-50 p-1 rounded-md transition-colors">
                                <input
                                  type="checkbox"
                                  value={d.id.toString()}
                                  checked={formData.departemen_ids.includes(d.id.toString())}
                                  onChange={handleDeptCheckboxChange}
                                  className="w-4 h-4 text-purple-600 bg-slate-100 border-slate-300 rounded focus:ring-purple-500"
                                />
                                <span className="text-slate-700 text-sm font-['Inter']">{d.nama_departemen}</span>
                              </label>
                            ))
                          )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
            
            {/* Actions */}
            <div className="w-full inline-flex justify-end items-center gap-4 mt-8">
              <Link href="/dashboard/members" className="px-8 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex flex-col justify-center items-center transition-colors">
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
    </div>
  );
}
