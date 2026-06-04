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
      <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">{label}</label>
      <input 
        type="text" 
        value={query} 
        onChange={(e) => search(e.target.value)} 
        onFocus={() => { if(results.length > 0) setIsOpen(true); }}
        placeholder={placeholder} 
        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all" 
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

export default function NewPelayanPage() {
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  const [roleOptions, setRoleOptions] = useState<any[]>([]);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [selectedSatelitId, setSelectedSatelitId] = useState<string>('');
  
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Selected Jemaat state
  const [selectedJemaat, setSelectedJemaat] = useState<any>(null);
  const [jemaatSearchQuery, setJemaatSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    tanggal_mulai: '',
    catatan: '',
    roles: [] as { role_id: string, tanggal_mulai: string }[],
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [resRole, resSat, resUser] = await Promise.all([
          fetch('/api/options?type=role_pelayan'),
          fetch('/api/options?type=satelit'),
          fetch('/api/auth/me'),
        ]);
        const roleData = await resRole.json();
        const satData  = await resSat.json();
        const authData = resUser.ok ? await resUser.json() : null;

        if (roleData.success) setRoleOptions(roleData.data);
        if (satData.success)  setSatelitOptions(satData.data);

        if (authData) {
          if (authData.is_super_admin || authData.permissions?.includes('pelayan_manage')) {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Failed to fetch options', error);
        setHasAccess(false);
      }
    };
    fetchOptions();
  }, []);

  // Saat jemaat dipilih, set default satelit ke satelit asal jemaat (bisa diubah)
  useEffect(() => {
    if (selectedJemaat?.satelit_id) {
      setSelectedSatelitId(selectedJemaat.satelit_id.toString());
    }
  }, [selectedJemaat]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddRole = () => {
    setFormData(prev => ({
      ...prev,
      roles: [...prev.roles, { role_id: '', tanggal_mulai: '' }]
    }));
  };

  const handleRemoveRole = (index: number) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.filter((_, i) => i !== index)
    }));
  };

  const handleRoleChange = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const newRoles = [...prev.roles];
      newRoles[index] = { ...newRoles[index], [field]: value };
      return { ...prev, roles: newRoles };
    });
  };

  const handleCreate = async () => {
    if (!selectedJemaat) {
      alert('Silakan pilih jemaat terlebih dahulu');
      return;
    }
    if (!formData.tanggal_mulai) {
      alert('Tanggal mulai pelayan harus diisi');
      return;
    }
    if (formData.roles.length === 0) {
      alert('Minimal harus mengisi 1 role pelayanan aktif');
      return;
    }
    for (const r of formData.roles) {
      if (!r.role_id || !r.tanggal_mulai) {
        alert('Setiap baris role pelayanan harus memiliki role dan tanggal mulai yang terisi');
        return;
      }
    }

      if (!selectedSatelitId) {
        alert('Pilih lokasi satelit pelayanan terlebih dahulu');
        return;
      }

      try {
        setIsSubmitting(true);
        setSubmitState({ status: 'loading', message: '' });

        const payload = {
          jemaat_id:     selectedJemaat.id,
          satelit_id:    selectedSatelitId,
          tanggal_mulai: formData.tanggal_mulai,
          catatan:       formData.catatan,
          roles:         formData.roles,
        };

      const res = await fetch('/api/pelayan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Data pelayan berhasil ditambahkan!' });
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

  if (hasAccess === false) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center text-slate-500 gap-4">
        <span className="material-icons-round text-6xl text-rose-300">gpp_bad</span>
        <h2 className="text-xl font-bold text-slate-700">Akses Ditolak</h2>
        <p className="text-sm">Anda tidak memiliki wewenang (pelayan_manage) untuk menambahkan pelayan baru.</p>
        <Link href="/pelayan" className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors">
          Kembali ke Data Pelayan
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-10">
      
      {/* Breadcrumb & Title Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <Link href="/dashboard" className="text-slate-500 hover:text-violet-600">Manajemen User</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/pelayan" className="text-slate-500 hover:text-violet-600">Pelayan</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Tambah Pelayan</span>
        </div>
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex flex-col justify-start items-start">
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Registrasi Pelayan</h1>
            <div className="text-slate-500 text-base font-medium font-sans leading-6 flex gap-1">
              <span>ID Pelayanan:</span>
              <span className="text-slate-700 font-bold">Otomatis Terbuat (P...)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full border-b border-slate-200 inline-flex justify-start items-start gap-8">
        <div className="px-2 py-3 border-b-2 border-slate-700 inline-flex flex-col justify-center items-center cursor-pointer">
          <span className="text-slate-700 text-sm font-bold font-sans leading-5">Data Pelayan</span>
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
              label="Cari Jemaat (Nama)"
              valueName={jemaatSearchQuery}
              placeholder="Ketik nama jemaat untuk dijadikan pelayan..."
              onSelect={(jemaat, name) => {
                setSelectedJemaat(jemaat);
                setJemaatSearchQuery(name);
              }}
            />
            {selectedJemaat && (
              <div className="mt-3 inline-flex items-center gap-4 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-lg w-fit relative overflow-hidden animate-in fade-in slide-in-from-top-2">
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

        {/* Grid Form Sections */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* KOLOM KIRI */}
          <div className="flex flex-col gap-8">
            {/* Informasi Pelayanan Global */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
              <div className="w-full inline-flex justify-start items-center gap-2">
                <span className="material-icons-round text-slate-700 text-[18px]">volunteer_activism</span>
                <span className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Informasi Kepelayanan</span>
              </div>
              
              <div className="w-full flex-col gap-4 flex lg:flex-row">
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">ID Pelayanan</label>
                  <input type="text" disabled value="Akan di-generate otomatis" className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-400 text-sm font-sans w-full italic cursor-not-allowed" />
                </div>
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Tgl Mulai (Global)</label>
                  <input type="date" name="tanggal_mulai" value={formData.tanggal_mulai} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all" />
                </div>
              </div>

              {/* Lokasi Satelit Pelayanan — bisa berbeda dari satelit asal jemaat */}
              <div className="w-full flex-col gap-1 flex">
                <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4 flex items-center gap-1">
                  Lokasi Satelit Pelayanan
                  {selectedJemaat && selectedSatelitId && selectedSatelitId !== selectedJemaat.satelit_id?.toString() && (
                    <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full normal-case tracking-normal">
                      ⚠ Berbeda dari satelit asal
                    </span>
                  )}
                </label>
                <select
                  value={selectedSatelitId}
                  onChange={e => setSelectedSatelitId(e.target.value)}
                  className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer"
                >
                  <option value="">-- Pilih Satelit Pelayanan --</option>
                  {satelitOptions.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.nama_satelit}
                      {selectedJemaat?.satelit_id === s.id ? ' (Asal Jemaat)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-slate-400 text-[11px] font-sans mt-0.5">
                  Default: satelit asal jemaat. Ubah jika jemaat ini melayani di satelit lain.
                </p>
              </div>
            </div>

            {/* Catatan Pelayan */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
              <div className="w-full inline-flex justify-start items-center gap-2">
                <span className="material-icons-round text-slate-700 text-[18px]">edit_note</span>
                <span className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Catatan Khusus</span>
              </div>
              
              <div className="w-full flex-col gap-1 flex">
                <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Catatan (Opsional)</label>
                <textarea 
                  name="catatan" 
                  value={formData.catatan} 
                  onChange={handleInputChange} 
                  placeholder="Isi jika ada catatan riwayat / teguran / pujian khusus..." 
                  className="px-3 py-3 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full min-h-[140px] resize-y transition-all" 
                />
              </div>
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="flex flex-col gap-8">

            {/* Role Pelayanan */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6 h-fit">
              <div className="w-full inline-flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-icons-round text-slate-700 text-[20px]">assignment_ind</span>
                  <span className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Role Pelayanan</span>
                </div>
                <button type="button" onClick={handleAddRole} className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-lg flex items-center gap-1 transition-colors text-xs font-bold border border-violet-100">
                  <span className="material-icons-round text-[16px]">add</span> Tambah Role
                </button>
              </div>
              
              {formData.roles.map((role, idx) => (
                <div key={idx} className="w-full bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col md:flex-row gap-4 items-end animate-in fade-in slide-in-from-top-1">
                  <div className="flex-1 w-full flex-col gap-1 flex">
                    <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Role / Departemen</label>
                    <select 
                      value={role.role_id} 
                      onChange={(e) => handleRoleChange(idx, 'role_id', e.target.value)} 
                      className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all cursor-pointer"
                    >
                      <option value="">-- Pilih Role --</option>
                      {roleOptions.map(r => (
                        <option key={r.id} value={r.id}>{r.nama_role}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 w-full flex-col gap-1 flex">
                    <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Tanggal Mulai Role</label>
                    <input 
                      type="date" 
                      value={role.tanggal_mulai} 
                      onChange={(e) => handleRoleChange(idx, 'tanggal_mulai', e.target.value)} 
                      className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all" 
                    />
                  </div>
                  <button type="button" onClick={() => handleRemoveRole(idx)}
                    className="w-10 h-10 shrink-0 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors border border-red-100 outline-none">
                    <span className="material-icons-round">delete_outline</span>
                  </button>
                </div>
              ))}
              
              {formData.roles.length === 0 && (
                <div className="w-full py-6 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-300">
                  <span className="material-icons-round text-4xl opacity-50">note_add</span>
                  <span className="text-sm font-sans">Belum ada role diassign. Silakan klik tombol "+ Tambah Role".</span>
                </div>
              )}
            </div>

            {/* Role Pelayanan part is correctly positioned in HTML structure here */}
          </div>
        </div>
        
        {/* Actions */}
        <div className="w-full inline-flex justify-end items-center gap-4 mt-8">
          <Link href="/pelayan" className="px-8 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex flex-col justify-center items-center transition-colors">
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
            <span className="text-white text-sm font-bold font-sans uppercase leading-5 tracking-wide">Simpan Data</span>
          </button>
        </div>
        
      </div>
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => {
          if (submitState.status === 'success') {
            router.push('/pelayan');
          } else {
            setSubmitState({ status: 'idle', message: '' });
          }
        }} 
      />
    </div>
  );
}
