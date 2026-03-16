'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function PelayanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const id = typeof params.id === 'string' ? params.id : '';
  const isReadOnly = searchParams.get('mode') === 'view';

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  const [roleOptions, setRoleOptions] = useState<any[]>([]);

  // Pelayan Entity State
  const [pelayan, setPelayan] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    tanggal_mulai: '',
    status_pelayan: 'Aktif',
    catatan: '',
    roles: [] as { role_id: string, tanggal_mulai: string, status_role: string }[],
  });

  useEffect(() => {
    const fetchRoleOptions = async () => {
      try {
        const res = await fetch('/api/options?type=role_pelayan');
        const data = await res.json();
        if (data.success) {
          setRoleOptions(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch role options:', err);
      }
    };
    fetchRoleOptions();
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchPelayan = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/pelayan/${id}`);
        const json = await res.json();
        if (json.success && json.data) {
          const p = json.data;
          setPelayan(p);
          setFormData({
            tanggal_mulai: p.tanggal_mulai ? new Date(p.tanggal_mulai).toISOString().split('T')[0] : '',
            status_pelayan: p.status_pelayan || 'Aktif',
            catatan: p.catatan || '',
            roles: (p.roles || []).map((r: any) => ({
              role_id: r.role_id.toString(),
              tanggal_mulai: r.tanggal_mulai ? new Date(r.tanggal_mulai).toISOString().split('T')[0] : '',
              status_role: r.status_role || 'Aktif'
            }))
          });
        }
      } catch (err) {
        console.error('Failed to fetch pelayan data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPelayan();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddRole = () => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      roles: [...prev.roles, { role_id: '', tanggal_mulai: '', status_role: 'Aktif' }]
    }));
  };

  const handleRemoveRole = (index: number) => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.filter((_, i) => i !== index)
    }));
  };

  const handleRoleChange = (index: number, field: string, value: string) => {
    if (isReadOnly) return;
    setFormData(prev => {
      const newRoles = [...prev.roles];
      newRoles[index] = { ...newRoles[index], [field]: value };
      return { ...prev, roles: newRoles };
    });
  };

  const handleSave = async () => {
    if (isReadOnly) return;

    if (!formData.tanggal_mulai) {
      alert('Tanggal mulai pelayan harus diisi');
      return;
    }
    for (const r of formData.roles) {
      if (!r.role_id || !r.tanggal_mulai) {
        alert('Setiap baris role pelayanan harus memiliki role dan tanggal mulai yang terisi');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: '' });

      const payload = {
        tanggal_mulai: formData.tanggal_mulai,
        status_pelayan: formData.status_pelayan,
        catatan: formData.catatan,
        roles: formData.roles,
        jemaat_id: pelayan.jemaat_id,
        satelit_id: pelayan.satelit_id,
      };

      const res = await fetch(`/api/pelayan/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Data pelayan berhasil diperbarui!' });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-violet-600 animate-spin"></div>
      </div>
    );
  }

  if (!pelayan) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <span className="material-icons-round text-5xl text-slate-300">error_outline</span>
        <p className="text-slate-500 font-['Public_Sans']">Data pelayan tidak ditemukan.</p>
        <Link href="/dashboard/pelayan" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
          Kembali ke Daftar Pelayan
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-10">
      
      {/* Breadcrumb & Title Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
          <Link href="/dashboard" className="text-slate-500 hover:text-violet-600">Manajemen User</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/dashboard/pelayan" className="text-slate-500 hover:text-violet-600">Pelayan</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">{pelayan.nama_lengkap}</span>
        </div>
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex flex-col justify-start items-start">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">
              {isReadOnly ? 'Detail Pelayan' : 'Edit Pelayan'}
            </h1>
            <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 flex gap-1">
              <span>ID Pelayanan:</span>
              <span className="text-slate-700 font-bold">{pelayan.id_pelayanan}</span>
            </div>
          </div>
          {isReadOnly && (
            <Link 
              href={`/dashboard/pelayan/${id}?mode=edit`}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2 font-bold text-sm shadow-sm transition-colors"
            >
              <span className="material-icons-round text-[18px]">edit</span> Edit Data
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full border-b border-slate-200 inline-flex justify-start items-start gap-8">
        <div className="px-2 py-3 border-b-2 border-slate-700 inline-flex flex-col justify-center items-center cursor-pointer">
          <span className="text-slate-700 text-sm font-bold font-['Inter'] leading-5">Data Pelayan</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full flex flex-col justify-start items-start gap-8 mt-2">
            
        {/* Top Identity Card */}
        <div className="w-full p-6 bg-white rounded-xl shadow-sm border border-slate-200 inline-flex justify-start items-center gap-6">
          <div className="relative inline-flex flex-col justify-start items-start">
            <img 
              src={pelayan.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pelayan.nama_lengkap)}&background=random`} 
              alt="Avatar" 
              className="w-24 h-24 rounded-xl object-cover border border-slate-200 shrink-0" 
            />
          </div>
          <div className="inline-flex flex-col justify-start items-start w-full relative">
            <div className="text-slate-400 text-xs font-bold font-['Inter'] uppercase tracking-wider mb-1">Profile Jemaat Terhubung</div>
            <div className="text-slate-900 text-xl font-bold font-['Public_Sans']">{pelayan.nama_lengkap}</div>
            
            <div className="mt-3 flex items-center gap-4 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-lg w-full relative overflow-hidden">
               <div className="flex flex-col">
                 <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">ID Jemaat</span>
                 <span className="font-['Liberation_Mono'] text-slate-800">{pelayan.jemaat_nomor || '-'}</span>
               </div>
               <div className="w-px h-8 bg-slate-200"></div>
               <div className="flex flex-col">
                 <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Satelit</span>
                 <span className="font-['Public_Sans'] font-semibold text-slate-800">{pelayan.nama_satelit || '-'}</span>
               </div>
               <div className="w-px h-8 bg-slate-200"></div>
               <div className="flex flex-col">
                 <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Status Pelayan</span>
                 <span className={`font-['Public_Sans'] text-xs font-bold uppercase rounded-full px-2 py-0.5 block w-fit \${pelayan.status_pelayan === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                   {pelayan.status_pelayan}
                 </span>
               </div>
            </div>
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
                <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Informasi Kepelayanan</span>
              </div>
              
              <div className="w-full flex-col gap-4 flex lg:flex-row">
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Status Pelayanan (Global)</label>
                  <select 
                    name="status_pelayan" 
                    value={formData.status_pelayan} 
                    onChange={handleInputChange} 
                    disabled={isReadOnly}
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Tidak Aktif">Tidak Aktif</option>
                  </select>
                </div>
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tgl Mulai (Global)</label>
                  <input 
                    type="date" 
                    name="tanggal_mulai" 
                    value={formData.tanggal_mulai} 
                    onChange={handleInputChange} 
                    disabled={isReadOnly}
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500" 
                  />
                </div>
              </div>
            </div>

            {/* Catatan Pelayan */}
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
                  disabled={isReadOnly}
                  placeholder="Isi jika ada catatan riwayat / teguran / pujian khusus..." 
                  className="px-3 py-3 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full min-h-[140px] resize-y transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:resize-none" 
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
                  <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Role Pelayanan</span>
                </div>
                {!isReadOnly && (
                  <button type="button" onClick={handleAddRole} className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-lg flex items-center gap-1 transition-colors text-xs font-bold border border-violet-100">
                    <span className="material-icons-round text-[16px]">add</span> Tambah Role
                  </button>
                )}
              </div>
              
              {formData.roles.map((role, idx) => (
                <div key={idx} className="w-full bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-1">
                  <div className="w-full flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Role / Departemen</label>
                      <select 
                        value={role.role_id} 
                        onChange={(e) => handleRoleChange(idx, 'role_id', e.target.value)} 
                        disabled={isReadOnly}
                        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        <option value="">-- Pilih Role --</option>
                        {roleOptions.map(r => (
                          <option key={r.id} value={r.id}>{r.nama_role}</option>
                        ))}
                      </select>
                    </div>
                    {!isReadOnly && (
                      <button type="button" onClick={() => handleRemoveRole(idx)}
                        className="w-10 h-10 shrink-0 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors border border-red-100 outline-none">
                        <span className="material-icons-round text-[20px]">delete_outline</span>
                      </button>
                    )}
                  </div>
                  
                  <div className="w-full flex gap-4">
                    <div className="flex-1 flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tanggal Mulai Role</label>
                      <input 
                        type="date" 
                        value={role.tanggal_mulai} 
                        onChange={(e) => handleRoleChange(idx, 'tanggal_mulai', e.target.value)} 
                        disabled={isReadOnly}
                        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500" 
                      />
                    </div>
                    <div className="flex-1 flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Status</label>
                      <select 
                        value={role.status_role} 
                        onChange={(e) => handleRoleChange(idx, 'status_role', e.target.value)} 
                        disabled={isReadOnly}
                        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        <option value="Aktif">Aktif</option>
                        <option value="Tidak Aktif">Tidak Aktif</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              
              {formData.roles.length === 0 && (
                <div className="w-full py-6 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-300">
                  <span className="material-icons-round text-4xl opacity-50">note_add</span>
                  <span className="text-sm font-['Inter']">Belum ada role diassign. Silakan klik tombol "+ Tambah Role".</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Actions */}
        {!isReadOnly && (
          <div className="w-full inline-flex justify-end items-center gap-4 mt-8">
            <Link href={`/dashboard/pelayan/${id}?mode=view`} className="px-8 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex flex-col justify-center items-center transition-colors">
              <span className="text-slate-700 text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Batal</span>
            </Link>
            <button 
              onClick={handleSave} 
              className={`px-10 py-2.5 bg-slate-700 hover:bg-slate-800 rounded-lg flex justify-start items-center gap-2 transition-all shadow-lg \${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}
            >
              {isSubmitting ? (
                <span className="material-icons-round text-white animate-spin text-[20px]">sync</span>
              ) : (
                <span className="material-icons-round text-white text-[20px]">save</span>
              )}
              <span className="text-white text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Simpan Pemuikthahiran</span>
            </button>
          </div>
        )}
        
      </div>
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => {
          if (submitState.status === 'success') {
            router.push(`/dashboard/pelayan/${id}?mode=view`);
            // Force reload to get updated data
            window.location.href = `/dashboard/pelayan/${id}?mode=view`;
          } else {
            setSubmitState({ status: 'idle', message: '' });
          }
        }} 
      />
    </div>
  );
}
