'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

interface RoleEntry {
  role_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  status_role: string;
}

export default function PelayanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const id = typeof params.id === 'string' ? params.id : '';
  const isReadOnly = searchParams.get('mode') === 'view';

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [roleOptions, setRoleOptions] = useState<any[]>([]);
  const [pelayan, setPelayan] = useState<any>(null);

  // Data Sesi Pengguna
  const [userData, setUserData] = useState<any>(null);
  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  const [formData, setFormData] = useState({
    tanggal_mulai: '',
    status_pelayan: 'Aktif',
    catatan: '',
    roles: [] as RoleEntry[],
  });

  // Tempat menyimpan data riwayat pelayanannya
  const [activeTab, setActiveTab] = useState<'data' | 'riwayat'>('data');
  const [riwayatData, setRiwayatData] = useState<any>(null);
  const [isLoadingRiwayat, setIsLoadingRiwayat] = useState(false);

  useEffect(() => {
    const fetchRoleOptionsAndUser = async () => {
      try {
        const [resRole, resUser] = await Promise.all([
          fetch('/api/options?type=role_pelayan'),
          fetch('/api/auth/me')
        ]);
        const data = await resRole.json();
        if (data.success) setRoleOptions(data.data);

        if (resUser.ok) {
          const authData = await resUser.json();
          setUserData(authData);
          
          const canManage = authData?.is_super_admin || authData?.permissions?.includes('pelayan_manage');
          if (!canManage && searchParams.get('mode') === 'edit') {
            router.replace(`/pelayan/${id}?mode=view`);
          }
        }
      } catch (err) { console.error('Failed to fetch initial options & user:', err); }
    };
    fetchRoleOptionsAndUser();
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
              tanggal_selesai: r.tanggal_selesai ? new Date(r.tanggal_selesai).toISOString().split('T')[0] : '',
              status_role: r.status_role || 'Aktif',
            }))
          });
        }
      } catch (err) { console.error('Failed to fetch pelayan data:', err); }
      finally { setIsLoading(false); }
    };
    fetchPelayan();
  }, [id]);

  useEffect(() => {
    const fetchRiwayat = async () => {
      if (activeTab === 'riwayat' && !riwayatData && id) {
        setIsLoadingRiwayat(true);
        try {
          const res = await fetch(`/api/pelayan/${id}/riwayat`);
          const result = await res.json();
          if (result.success) {
            setRiwayatData(result.data);
          }
        } catch (error) {
          console.error('Failed to fetch riwayat:', error);
        } finally {
          setIsLoadingRiwayat(false);
        }
      }
    };
    fetchRiwayat();
  }, [activeTab, id, riwayatData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddRole = () => {
    if (isReadOnly) return;
    setFormData(prev => ({
      ...prev,
      roles: [...prev.roles, { role_id: '', tanggal_mulai: '', tanggal_selesai: '', status_role: 'Aktif' }]
    }));
    setDuplicateError(null);
  };

  const handleRemoveRole = (index: number) => {
    if (isReadOnly) return;
    setFormData(prev => ({ ...prev, roles: prev.roles.filter((_, i) => i !== index) }));
    setDuplicateError(null);
  };

  const handleRoleChange = (index: number, field: keyof RoleEntry, value: string) => {
    if (isReadOnly) return;
    setDuplicateError(null);
    setFormData(prev => {
      const newRoles = [...prev.roles];
      let updated = { ...newRoles[index], [field]: value };
      // Kalau statusnya diganti jadi Aktif, kosongin aja tanggal selesainya biar jalan terus
      if (field === 'status_role' && value === 'Aktif') {
        updated = { ...updated, tanggal_selesai: '' };
      }
      newRoles[index] = updated;
      return { ...prev, roles: newRoles };
    });
  };

  // Cek bentar, jangan-jangan ada peran (role) yang dipilih dua kali
  const checkDuplicateRoles = (roles: RoleEntry[]): string | null => {
    const filledRoles = roles.filter(r => r.role_id);
    const roleIds = filledRoles.map(r => r.role_id);
    const uniqueIds = new Set(roleIds);
    if (uniqueIds.size !== roleIds.length) {
      // Lacak baris mana yang isinya kembaran
      const seen = new Set<string>();
      for (const r of filledRoles) {
        if (seen.has(r.role_id)) {
          const roleName = roleOptions.find(ro => ro.id.toString() === r.role_id)?.nama_role || r.role_id;
          return `⚠️ Role "${roleName}" tidak boleh dipilih lebih dari sekali!`;
        }
        seen.add(r.role_id);
      }
    }
    return null;
  };

  // Saring dropdown supaya peran yang udah kepilih di baris sebelah gak nongol lagi, biar gak mubazir
  const getAvailableRoles = (currentIdx: number) => {
    const usedRoleIds = formData.roles
      .map((r, i) => i !== currentIdx ? r.role_id : null)
      .filter(Boolean) as string[];
    return roleOptions.filter(r => !usedRoleIds.includes(r.id.toString()));
  };

  const handleSave = async () => {
    if (isReadOnly) return;

    if (!formData.tanggal_mulai) {
      setSubmitState({ status: 'error', message: 'Tanggal mulai pelayan harus diisi' });
      return;
    }

    // Periksa satu per satu setiap peran yang ada
    for (const r of formData.roles) {
      if (!r.role_id || !r.tanggal_mulai) {
        setSubmitState({ status: 'error', message: 'Setiap baris role harus memiliki role dan tanggal mulai yang terisi' });
        return;
      }
      if (r.status_role === 'Tidak Aktif' && !r.tanggal_selesai) {
        const roleName = roleOptions.find(ro => ro.id.toString() === r.role_id)?.nama_role || r.role_id;
        setSubmitState({ status: 'error', message: `Role "${roleName}" berstatus Tidak Aktif — wajib isi Tanggal Selesai!` });
        return;
      }
    }

    // Pastiin sebersih mungkin gak ada yang tumpang tindih
    const dupError = checkDuplicateRoles(formData.roles);
    if (dupError) {
      setDuplicateError(dupError);
      setSubmitState({ status: 'error', message: dupError });
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: '' });

      const payload = {
        tanggal_mulai: formData.tanggal_mulai,
        status_pelayan: formData.status_pelayan,
        catatan: formData.catatan,
        roles: formData.roles.map(r => ({
          role_id: parseInt(r.role_id),
          tanggal_mulai: r.tanggal_mulai || null,
          tanggal_selesai: r.tanggal_selesai || null,
          status_role: r.status_role,
        })),
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
        <p className="text-slate-500 font-sans">Data pelayan tidak ditemukan.</p>
        <Link href="/pelayan" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
          Kembali ke Daftar Pelayan
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
          <span className="text-slate-700 font-bold">{pelayan.nama_lengkap}</span>
        </div>
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex flex-col justify-start items-start">
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">
              {isReadOnly ? 'Detail Pelayan' : 'Edit Pelayan'}
            </h1>
            <div className="text-slate-500 text-base font-medium font-sans leading-6 flex gap-1">
              <span>ID Pelayanan:</span>
              <span className="text-slate-700 font-bold">{pelayan.id_pelayanan}</span>
            </div>
          </div>
          {isReadOnly && hasPermission('pelayan_manage') && (
            <Link 
              href={`/pelayan/${id}?mode=edit`}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2 font-bold text-sm shadow-sm transition-colors"
            >
              <span className="material-icons-round text-[18px]">edit</span> Edit Data
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full border-b border-slate-200 inline-flex justify-start items-start gap-8">
        <div 
          onClick={() => setActiveTab('data')}
          className={`px-2 py-3 border-b-2 inline-flex flex-col justify-center items-center cursor-pointer transition-colors ${activeTab === 'data' ? 'border-slate-700 text-slate-700' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
        >
          <span className="text-sm font-bold font-sans leading-5">Data Pelayan</span>
        </div>
        <div 
          onClick={() => setActiveTab('riwayat')}
          className={`px-2 py-3 border-b-2 inline-flex flex-col justify-center items-center cursor-pointer transition-colors ${activeTab === 'riwayat' ? 'border-slate-700 text-slate-700' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
        >
          <span className="text-sm font-bold font-sans leading-5">Riwayat Pelayanan</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full flex flex-col justify-start items-start gap-8 mt-2">
            
        {/* Top Identity Card */}
        <div className="w-full p-6 bg-white rounded-xl shadow-sm border border-slate-200 inline-flex flex-col md:flex-row justify-start md:items-center gap-6">
          <div className="relative inline-flex flex-col justify-start items-start">
            <img 
              src={pelayan.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pelayan.nama_lengkap)}&background=random`} 
              alt="Avatar" 
              className="w-24 h-24 rounded-xl object-cover border border-slate-200 shrink-0" 
            />
          </div>
          <div className="inline-flex flex-col justify-start items-start relative w-fit mr-auto">
            <div className="text-slate-400 text-xs font-bold font-sans uppercase tracking-wider mb-1">Profile Jemaat Terhubung</div>
            <div className="text-slate-900 text-2xl font-bold font-sans leading-8 mb-1">{pelayan.nama_lengkap}</div>
            
            <div className="mt-3 inline-flex items-center gap-4 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-lg w-fit">
               <div className="flex flex-col">
                 <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">ID Jemaat</span>
                 <span className="font-sans text-slate-800">{pelayan.jemaat_nomor || '-'}</span>
               </div>
               <div className="w-px h-8 bg-slate-200"></div>
               <div className="flex flex-col">
                 <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Satelit</span>
                 <span className="font-sans font-semibold text-slate-800">{pelayan.nama_satelit || '-'}</span>
               </div>
               <div className="w-px h-8 bg-slate-200"></div>
               <div className="flex flex-col">
                 <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Status Pelayan</span>
                 <span className={`font-sans text-xs font-bold uppercase rounded-full px-2 py-0.5 block w-fit ${pelayan.status_pelayan === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                   {pelayan.status_pelayan}
                 </span>
               </div>
            </div>
          </div>
        </div>

        {/* Grid Form Sections (TAB DATA) */}
        {activeTab === 'data' && (
          <>
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
                      <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Status Pelayanan (Global)</label>
                      <select 
                        name="status_pelayan" value={formData.status_pelayan} onChange={handleInputChange} disabled={isReadOnly}
                        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        <option value="Aktif">Aktif</option>
                        <option value="Tidak Aktif">Tidak Aktif</option>
                      </select>
                    </div>
                    <div className="flex-1 flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Tgl Mulai (Global)</label>
                      <input type="date" name="tanggal_mulai" value={formData.tanggal_mulai} onChange={handleInputChange} disabled={isReadOnly}
                        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all disabled:bg-slate-50 disabled:text-slate-500" />
                    </div>
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
                      name="catatan" value={formData.catatan} onChange={handleInputChange} disabled={isReadOnly}
                      placeholder="Isi jika ada catatan riwayat / teguran / pujian khusus..." 
                      className="px-3 py-3 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full min-h-[140px] resize-y transition-all disabled:bg-slate-50 disabled:text-slate-500 disabled:resize-none" 
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
                    {!isReadOnly && (
                      <button type="button" onClick={handleAddRole} className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-lg flex items-center gap-1 transition-colors text-xs font-bold border border-violet-100">
                        <span className="material-icons-round text-[16px]">add</span> Tambah Role
                      </button>
                    )}
                  </div>

                  {/* Pesan error duplikat */}
                  {duplicateError && (
                    <div className="w-full px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 font-semibold flex items-center gap-2">
                      <span className="material-icons-round text-[18px] text-rose-500">warning</span>
                      {duplicateError}
                    </div>
                  )}
                  
                  {formData.roles.map((role, idx) => (
                    <div key={idx} className="w-full bg-slate-50 rounded-xl border border-slate-100 p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1">
                      {/* Baris 1: Pilih Role + Delete */}
                      <div className="w-full flex gap-3 items-end">
                        <div className="flex-1 flex-col gap-1 flex">
                          <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Role / Departemen</label>
                          <select 
                            value={role.role_id} 
                            onChange={(e) => handleRoleChange(idx, 'role_id', e.target.value)} 
                            disabled={isReadOnly}
                            className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all disabled:bg-slate-50 disabled:text-slate-500"
                          >
                            <option value="">-- Pilih Role --</option>
                            {getAvailableRoles(idx).map(r => (
                              <option key={r.id} value={r.id}>{r.nama_role}</option>
                            ))}
                            {role.role_id && !getAvailableRoles(idx).find(r => r.id.toString() === role.role_id) && (
                              <option value={role.role_id}>{roleOptions.find(r => r.id.toString() === role.role_id)?.nama_role || role.role_id}</option>
                            )}
                          </select>
                        </div>
                        {!isReadOnly && (
                          <button type="button" onClick={() => handleRemoveRole(idx)}
                            className="w-10 h-10 shrink-0 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors border border-red-100">
                            <span className="material-icons-round text-[20px]">delete_outline</span>
                          </button>
                        )}
                      </div>
                      
                      {/* Baris 2: Tanggal Mulai + Status */}
                      <div className="w-full flex gap-3">
                        <div className="flex-1 flex-col gap-1 flex">
                          <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Tanggal Mulai Role</label>
                          <input type="date" value={role.tanggal_mulai}
                            onChange={(e) => handleRoleChange(idx, 'tanggal_mulai', e.target.value)} disabled={isReadOnly}
                            className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all disabled:bg-slate-50 disabled:text-slate-500" />
                        </div>
                        <div className="flex-1 flex-col gap-1 flex">
                          <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Status</label>
                          <select value={role.status_role}
                            onChange={(e) => handleRoleChange(idx, 'status_role', e.target.value)} disabled={isReadOnly}
                            className={`px-3 py-2 bg-white rounded-lg border focus:outline-none focus:ring-2 focus:border-violet-500 text-slate-900 text-sm font-sans w-full transition-all disabled:bg-slate-50 disabled:text-slate-500 ${role.status_role === 'Tidak Aktif' ? 'border-amber-300 focus:ring-amber-300/20' : 'border-slate-200 focus:ring-violet-500/20'}`}
                          >
                            <option value="Aktif">Aktif</option>
                            <option value="Tidak Aktif">Tidak Aktif</option>
                          </select>
                        </div>
                      </div>

                      {/* Baris 3: Tanggal Selesai (KONDISIONAL) */}
                      {role.status_role === 'Tidak Aktif' && (
                        <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-1 duration-200">
                          <label className="text-amber-600 text-xs font-bold font-sans uppercase leading-4 flex items-center gap-1">
                            <span className="material-icons-round text-[14px]">event_busy</span>
                            Tanggal Selesai Role <span className="text-red-500">*</span>
                          </label>
                          <input 
                            type="date" 
                            value={role.tanggal_selesai}
                            onChange={(e) => handleRoleChange(idx, 'tanggal_selesai', e.target.value)} 
                            disabled={isReadOnly}
                            min={role.tanggal_mulai || undefined}
                            className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 text-slate-900 text-sm font-sans w-full transition-all disabled:bg-slate-50 disabled:text-slate-500 ${!role.tanggal_selesai && !isReadOnly ? 'border-amber-400 bg-amber-50' : 'border-amber-200 bg-white'}`}
                          />
                          {!role.tanggal_selesai && !isReadOnly && (
                            <p className="text-amber-600 text-[11px] font-medium mt-0.5">
                              ⚠️ Wajib diisi — kapan {roleOptions.find(r => r.id.toString() === role.role_id)?.nama_role || 'role ini'} selesai?
                            </p>
                          )}
                        </div>
                      )}

                      {isReadOnly && role.tanggal_selesai && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <span className="material-icons-round text-[14px] text-amber-500">history</span>
                          <span>Masa bakti: <strong>{role.tanggal_mulai}</strong> s/d <strong>{role.tanggal_selesai}</strong></span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {formData.roles.length === 0 && (
                    <div className="w-full py-6 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-300">
                      <span className="material-icons-round text-4xl opacity-50">note_add</span>
                      <span className="text-sm font-sans">Belum ada role diassign. Silakan klik tombol &quot;+ Tambah Role&quot;.</span>
                    </div>
                  )}

                  {!isReadOnly && formData.roles.length > 1 && (
                    <div className="w-full text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                      <span className="material-icons-round text-[14px]">info_outline</span>
                      Dropdown otomatis menyembunyikan role yang sudah dipilih di baris lain.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            {!isReadOnly && (
              <div className="w-full inline-flex justify-end items-center gap-4 mt-8">
                <Link href={`/pelayan/${id}?mode=view`} className="px-8 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex flex-col justify-center items-center transition-colors">
                  <span className="text-slate-700 text-sm font-bold font-sans uppercase leading-5 tracking-wide">Batal</span>
                </Link>
                <button 
                  onClick={handleSave} 
                  className={`px-10 py-2.5 bg-slate-700 hover:bg-slate-800 rounded-lg flex justify-start items-center gap-2 transition-all shadow-lg ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}
                >
                  {isSubmitting ? (
                    <span className="material-icons-round text-white animate-spin text-[20px]">sync</span>
                  ) : (
                    <span className="material-icons-round text-white text-[20px]">save</span>
                  )}
                  <span className="text-white text-sm font-bold font-sans uppercase leading-5 tracking-wide">Simpan Pembaruan</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* TAB RIWAYAT PELAYANAN */}
        {activeTab === 'riwayat' && (
          <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isLoadingRiwayat ? (
              <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-violet-600 animate-spin"></div>
              </div>
            ) : !riwayatData ? (
              <div className="text-slate-500 text-center p-8">Gagal memuat riwayat.</div>
            ) : (
              <>
                {/* Stats Section */}
                <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Ditugaskan</span>
                    <span className="text-slate-900 text-3xl font-black">{riwayatData.statistik.total_jadwal}</span>
                  </div>
                  <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                    <span className="text-emerald-500 text-xs font-bold uppercase tracking-wider mb-2">Kehadiran (Hadir)</span>
                    <span className="text-emerald-600 text-3xl font-black">{riwayatData.statistik.total_hadir}</span>
                  </div>
                  <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                    <span className="text-rose-500 text-xs font-bold uppercase tracking-wider mb-2">Batal / Absen</span>
                    <span className="text-rose-600 text-3xl font-black">{riwayatData.statistik.total_batal}</span>
                  </div>
                  <div className="p-5 bg-violet-50 rounded-xl shadow-sm border border-violet-100 flex flex-col items-center justify-center text-center">
                    <span className="text-violet-600 text-xs font-bold uppercase tracking-wider mb-2">Tingkat Komitmen</span>
                    <div className="flex items-end gap-1">
                      <span className="text-violet-700 text-3xl font-black">{riwayatData.statistik.komitmen}</span>
                      <span className="text-violet-600 text-lg font-bold pb-1">%</span>
                    </div>
                  </div>
                </div>

                {/* Table Section */}
                <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="w-full bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-slate-800 font-bold font-sans">Riwayat Jadwal</h3>
                  </div>
                  
                  {riwayatData.riwayat.length === 0 ? (
                    <div className="p-12 flex flex-col items-center text-slate-400">
                      <span className="material-icons-round text-4xl mb-2 opacity-50">event_busy</span>
                      <span>Belum ada riwayat pelayanan.</span>
                    </div>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/50">
                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal & Waktu</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Kegiatan</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Peran (Role)</th>
                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Status Konfirmasi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {riwayatData.riwayat.map((row: any, i: number) => {
                            let statusColor = 'bg-slate-100 text-slate-600';
                            if (row.status_konfirmasi === 'Hadir' || row.status_konfirmasi === 'Bersedia') statusColor = 'bg-emerald-100 text-emerald-700';
                            if (row.status_konfirmasi === 'Berhalangan' || row.status_konfirmasi === 'Tidak Hadir') statusColor = 'bg-rose-100 text-rose-700';
                            if (row.status_konfirmasi === 'Menunggu Konfirmasi') statusColor = 'bg-amber-100 text-amber-700';

                            return (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-slate-800">
                                      {new Date(row.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                    <span className="text-xs text-slate-500 font-sans mt-0.5">{row.waktu_mulai.substring(0, 5)} WIB</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-700">{row.nama_kegiatan}</td>
                                <td className="px-6 py-4">
                                  <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                                    {row.nama_role}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColor} capitalize`}>
                                    {row.status_konfirmasi}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        
      </div>
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => {
          if (submitState.status === 'success') {
            window.location.href = `/pelayan/${id}?mode=view`;
          } else {
            setSubmitState({ status: 'idle', message: '' });
          }
        }} 
      />
    </div>
  );
}
