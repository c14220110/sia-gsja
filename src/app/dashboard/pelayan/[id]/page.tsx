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

  // Error pesan duplikat role
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [roleOptions, setRoleOptions] = useState<any[]>([]);
  const [pelayan, setPelayan] = useState<any>(null);

  const [formData, setFormData] = useState({
    tanggal_mulai: '',
    status_pelayan: 'Aktif',
    catatan: '',
    roles: [] as RoleEntry[],
  });

  useEffect(() => {
    const fetchRoleOptions = async () => {
      try {
        const res = await fetch('/api/options?type=role_pelayan');
        const data = await res.json();
        if (data.success) setRoleOptions(data.data);
      } catch (err) { console.error('Failed to fetch role options:', err); }
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
      // Jika status diubah jadi Aktif, hapus tanggal selesai
      if (field === 'status_role' && value === 'Aktif') {
        updated = { ...updated, tanggal_selesai: '' };
      }
      newRoles[index] = updated;
      return { ...prev, roles: newRoles };
    });
  };

  // Validasi duplikat role
  const checkDuplicateRoles = (roles: RoleEntry[]): string | null => {
    const filledRoles = roles.filter(r => r.role_id);
    const roleIds = filledRoles.map(r => r.role_id);
    const uniqueIds = new Set(roleIds);
    if (uniqueIds.size !== roleIds.length) {
      // Temukan yang duplikat
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

  // Filter opsi dropdown agar role yang sudah dipakai di baris lain tidak muncul
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

    // Validasi setiap role
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

    // Validasi duplikat
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
        <p className="text-slate-500 font-['Inter']">Data pelayan tidak ditemukan.</p>
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
          <div className="inline-flex flex-col justify-start items-start relative w-fit mr-auto">
            <div className="text-slate-400 text-xs font-bold font-['Inter'] uppercase tracking-wider mb-1">Profile Jemaat Terhubung</div>
            <div className="text-slate-900 text-2xl font-bold font-['Inter'] leading-8 mb-1">{pelayan.nama_lengkap}</div>
            
            <div className="mt-3 inline-flex items-center gap-4 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-lg w-fit">
               <div className="flex flex-col">
                 <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">ID Jemaat</span>
                 <span className="font-['Liberation_Mono'] text-slate-800">{pelayan.jemaat_nomor || '-'}</span>
               </div>
               <div className="w-px h-8 bg-slate-200"></div>
               <div className="flex flex-col">
                 <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Satelit</span>
                 <span className="font-['Inter'] font-semibold text-slate-800">{pelayan.nama_satelit || '-'}</span>
               </div>
               <div className="w-px h-8 bg-slate-200"></div>
               <div className="flex flex-col">
                 <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Status Pelayan</span>
                 <span className={`font-['Inter'] text-xs font-bold uppercase rounded-full px-2 py-0.5 block w-fit ${pelayan.status_pelayan === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
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
                    name="status_pelayan" value={formData.status_pelayan} onChange={handleInputChange} disabled={isReadOnly}
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Tidak Aktif">Tidak Aktif</option>
                  </select>
                </div>
                <div className="flex-1 flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tgl Mulai (Global)</label>
                  <input type="date" name="tanggal_mulai" value={formData.tanggal_mulai} onChange={handleInputChange} disabled={isReadOnly}
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500" />
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
                  name="catatan" value={formData.catatan} onChange={handleInputChange} disabled={isReadOnly}
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
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Role / Departemen</label>
                      <select 
                        value={role.role_id} 
                        onChange={(e) => handleRoleChange(idx, 'role_id', e.target.value)} 
                        disabled={isReadOnly}
                        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        <option value="">-- Pilih Role --</option>
                        {/* Filter: sembunyikan role yang sudah dipakai baris lain */}
                        {getAvailableRoles(idx).map(r => (
                          <option key={r.id} value={r.id}>{r.nama_role}</option>
                        ))}
                        {/* Selalu tampilkan yang sedang dipilih baris ini */}
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
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tanggal Mulai Role</label>
                      <input type="date" value={role.tanggal_mulai}
                        onChange={(e) => handleRoleChange(idx, 'tanggal_mulai', e.target.value)} disabled={isReadOnly}
                        className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500" />
                    </div>
                    <div className="flex-1 flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Status</label>
                      <select value={role.status_role}
                        onChange={(e) => handleRoleChange(idx, 'status_role', e.target.value)} disabled={isReadOnly}
                        className={`px-3 py-2 bg-white rounded-lg border focus:outline-none focus:ring-2 focus:border-violet-500 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500 ${role.status_role === 'Tidak Aktif' ? 'border-amber-300 focus:ring-amber-300/20' : 'border-slate-200 focus:ring-violet-500/20'}`}
                      >
                        <option value="Aktif">Aktif</option>
                        <option value="Tidak Aktif">Tidak Aktif</option>
                      </select>
                    </div>
                  </div>

                  {/* Baris 3: Tanggal Selesai (KONDISIONAL — hanya muncul jika Tidak Aktif) */}
                  {role.status_role === 'Tidak Aktif' && (
                    <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className="text-amber-600 text-xs font-bold font-['Inter'] uppercase leading-4 flex items-center gap-1">
                        <span className="material-icons-round text-[14px]">event_busy</span>
                        Tanggal Selesai Role <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="date" 
                        value={role.tanggal_selesai}
                        onChange={(e) => handleRoleChange(idx, 'tanggal_selesai', e.target.value)} 
                        disabled={isReadOnly}
                        min={role.tanggal_mulai || undefined}
                        className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 text-slate-900 text-sm font-['Inter'] w-full transition-all disabled:bg-slate-50 disabled:text-slate-500 ${!role.tanggal_selesai && !isReadOnly ? 'border-amber-400 bg-amber-50' : 'border-amber-200 bg-white'}`}
                      />
                      {!role.tanggal_selesai && !isReadOnly && (
                        <p className="text-amber-600 text-[11px] font-medium mt-0.5">
                          ⚠️ Wajib diisi — kapan {roleOptions.find(r => r.id.toString() === role.role_id)?.nama_role || 'role ini'} selesai?
                        </p>
                      )}
                    </div>
                  )}

                  {/* Badge ringkasan historis jika sudah ada tanggal selesai (mode view) */}
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
                  <span className="text-sm font-['Inter']">Belum ada role diassign. Silakan klik tombol &quot;+ Tambah Role&quot;.</span>
                </div>
              )}

              {/* Hint validasi anti-duplikat */}
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
            <Link href={`/dashboard/pelayan/${id}?mode=view`} className="px-8 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex flex-col justify-center items-center transition-colors">
              <span className="text-slate-700 text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Batal</span>
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
              <span className="text-white text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Simpan Pembaruan</span>
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
            window.location.href = `/dashboard/pelayan/${id}?mode=view`;
          } else {
            setSubmitState({ status: 'idle', message: '' });
          }
        }} 
      />
    </div>
  );
}
