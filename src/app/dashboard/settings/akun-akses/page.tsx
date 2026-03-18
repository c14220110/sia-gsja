'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(valueName); }, [valueName]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
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
      <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase leading-4">{label}</label>
      <input 
        type="text" value={query} onChange={(e) => search(e.target.value)} 
        onFocus={() => { if(results.length > 0) setIsOpen(true); }} placeholder={placeholder} 
        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 w-full text-sm transition-all" 
      />
      {isOpen && (
        <div className="absolute z-[90] top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-xl max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-slate-500">Mencari...</div>
          ) : (
            results.map((j) => (
              <div 
                key={j.id} 
                className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3"
                onClick={() => {
                  onSelect(j, j.nama_lengkap);
                  setQuery(j.nama_lengkap);
                  setIsOpen(false);
                }}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                  <img src={j.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(j.nama_lengkap)}&background=random`} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">{j.nama_lengkap}</span>
                  <span className="text-[11px] text-slate-500 font-mono">{j.jemaat_id}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

type TabKey = 'role_permission' | 'akun_pengguna' | 'akses_sementara';

export default function AkunAksesPage() {
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();

  const [activeTab, setActiveTab] = useState<TabKey>('role_permission');
  const [dataRoles, setDataRoles] = useState<any[]>([]);
  const [dataUsers, setDataUsers] = useState<any[]>([]);

  // Modals state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  
  // Matrix Checkbox State (per module)
  const [permissionsMaster, setPermissionsMaster] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);

  // Add User State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [newUserSelectedJemaat, setNewUserSelectedJemaat] = useState<any>(null);
  const [newUserSearchQuery, setNewUserSearchQuery] = useState('');
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    role_id: '',
    satelit_id: ''
  });

  // Temporary Access State
  const [isAddTempModalOpen, setIsAddTempModalOpen] = useState(false);
  const [tempUserSelectedJemaat, setTempUserSelectedJemaat] = useState<any>(null);
  const [tempUserSearchQuery, setTempUserSearchQuery] = useState('');
  const [tempUserForm, setTempUserForm] = useState({
    user_id: '',
    role_id: '',
    satelit_id: '',
    tanggal_mulai: '',
    tanggal_selesai: ''
  });

  const fetchRolesData = async () => {
    try {
      showLoader();
      const res = await fetch('/api/settings/akun-akses/roles');
      const json = await res.json();
      if (json.success) {
        setDataRoles(json.data.roles);
        setPermissionsMaster(json.data.permissions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      hideLoader();
    }
  };

  const fetchUsersData = async () => {
    try {
      showLoader();
      const [resUsers, resSat] = await Promise.all([
         fetch('/api/settings/akun-akses/users'),
         fetch('/api/options?type=satelit')
      ]);
      const jsonUsers = await resUsers.json();
      const jsonSat = await resSat.json();

      if (jsonUsers.success) setDataUsers(jsonUsers.data);
      if (jsonSat.success) setSatelitOptions(jsonSat.data);
    } catch (e) {
      console.error(e);
    } finally {
      hideLoader();
    }
  };

  useEffect(() => {
    if (activeTab === 'role_permission') {
      fetchRolesData();
    } else if (activeTab === 'akun_pengguna') {
      fetchUsersData();
    }
  }, [activeTab]);

  const handleEditRoleAccess = async (role: any) => {
    setSelectedRole(role);
    try {
      showLoader();
      const res = await fetch(`/api/settings/akun-akses/roles?role_id=${role.id}`);
      const json = await res.json();
      if (json.success) {
        setRolePermissions(json.data); // array of permission_id
        setIsRoleModalOpen(true);
      }
    } catch (e) {
      console.error(e);
      alert('Gagal mengambil detail hak akses.');
    } finally {
      hideLoader();
    }
  };

  const togglePermission = (permId: number) => {
    setRolePermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(id => id !== permId)
        : [...prev, permId]
    );
  };

  const saveRolePermissions = async () => {
    if (!selectedRole) return;
    try {
       showLoader();
       const res = await fetch('/api/settings/akun-akses/roles', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           role_id: selectedRole.id,
           permission_ids: rolePermissions
         })
       });
       const json = await res.json();
       if (json.success) {
         alert('Update sukses');
         setIsRoleModalOpen(false);
       } else {
         alert(json.message);
       }
    } catch(e) {
      console.error(e);
      alert('Terjadi kesalahan pada server');
    } finally {
      hideLoader();
    }
  };

  /** Helper untuk mapping master permission ke format tabel Matrix */
  const getPermId = (modulNamePrefix: string, suffix: string) => {
     const p = permissionsMaster.find(x => x.nama_permission === `${modulNamePrefix}_${suffix}`);
     return p ? p.id : null;
  };

  const modulesLayout = [
    { label: 'Data Jemaat', prefix: 'jemaat', hasView: true, hasCreate: true, hasEdit: true, manageSuffix: null },
    { label: 'Data Pelayan', prefix: 'pelayan', hasView: true, hasCreate: false, hasEdit: false, manageSuffix: 'manage' },
    { label: 'Data Pengurus', prefix: 'pengurus', hasView: true, hasCreate: false, hasEdit: false, manageSuffix: 'manage' },
    { label: 'Kegiatan & Absen', prefix: 'kegiatan', hasView: true, hasCreate: true, hasEdit: true, manageSuffix: 'absensi_input' }, // trick for absent input
    { label: 'Kas & Bank', prefix: 'kas', hasView: true, hasCreate: false, hasEdit: false, manageSuffix: 'kas_input', customPrefix: true },
    { label: 'Proposal & LPJ', prefix: 'lpj', hasView: true, hasCreate: false, hasEdit: false, manageSuffix: 'lpj_approve', customPrefix: true },
    { label: 'Sistem & Master Data', prefix: 'master_data', hasView: false, hasCreate: false, hasEdit: false, manageSuffix: 'manage' },
  ];

  const handleCreateUser = async () => {
     if (!newUserSelectedJemaat) return alert("Pilih Jemaat terlebih dahulu");
     if (!newUserForm.email || !newUserForm.password || !newUserForm.role_id || !newUserForm.satelit_id) {
       return alert("Lengkapi Form (Email, Password, Role, dan Satelit)!");
     }

     try {
       showLoader();
       const res = await fetch('/api/settings/akun-akses/users', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: newUserForm.email,
           password: newUserForm.password,
           jemaat_id: newUserSelectedJemaat.id,
           role_id: parseInt(newUserForm.role_id),
           satelit_id: parseInt(newUserForm.satelit_id)
         })
       });
       const json = await res.json();
       if (json.success) {
         alert('Akun berhasil dibuat!');
         setIsAddUserModalOpen(false);
         setNewUserForm({ email: '', password: '', role_id: '', satelit_id: '' });
         setNewUserSelectedJemaat(null);
         setNewUserSearchQuery('');
         fetchUsersData();
       } else {
         alert(json.message);
       }
     } catch(e) {
       console.error(e);
       alert("Terjadi kesalahan server");
     } finally {
       hideLoader();
     }
  };

  return (
    <div className="w-full flex justify-start items-start gap-8 flex-col sm:flex-row pb-12">
      {/* Kolom Kiri - Header & Tabs */}
      <div className="flex-col justify-start items-start gap-8 inline-flex w-full">
        {/* Header */}
        <div className="flex-col justify-start items-start gap-2 flex">
          <div className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">
            Akun &amp; Hak Akses
          </div>
          <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 max-w-xl">
            Kelola Role Sistem (*matriks akses/permissions*) dan berikan kunci gembok (*akun login*) kepada jemaat yang berhak.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="w-full bg-slate-100 rounded-xl p-1 inline-flex justify-start items-center gap-1 overflow-x-auto">
          {[
            { key: 'role_permission', label: 'Manajemen Role & Permission', icon: 'admin_panel_settings' },
            { key: 'akun_pengguna', label: 'Daftar Akun Pengguna', icon: 'vpn_key' },
            { key: 'akses_sementara', label: 'Akses Sementara', icon: 'timelapse' },
          ].map((tab) => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex-1 h-10 px-4 rounded-lg flex justify-center items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-white shadow-sm border border-slate-200'
                  : 'hover:bg-slate-200/50 text-slate-500'
              }`}
            >
              <span className={`material-icons-round text-[18px] ${activeTab === tab.key ? 'text-violet-600' : ''}`}>
                {tab.icon}
              </span>
              <span className={`text-sm font-bold font-['Inter'] leading-5 ${activeTab === tab.key ? 'text-slate-800' : ''}`}>
                {tab.label}
              </span>
            </div>
          ))}
        </div>

        {/* Konten Tab 1: Manajemen Role */}
        {activeTab === 'role_permission' && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-icons-round text-violet-500">list_alt</span> Daftar Role Sistem
                </h2>
             </div>

             <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
               <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 font-semibold text-slate-800 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-200">Nama Role</th>
                      <th className="px-6 py-4 border-b border-slate-200">Akses Utama Modul</th>
                      <th className="px-6 py-4 border-b border-slate-200 text-center">Jml Pengguna</th>
                      <th className="px-6 py-4 border-b border-slate-200 w-32">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataRoles.map((role) => (
                      <tr key={role.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold text-slate-900">{role.nama_role}</div>
                          <div className="text-xs text-slate-500 mt-1 max-w-xs">{role.deskripsi || '-'}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <span className={`px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap flex items-center w-fit gap-1`}>
                             {role.is_active ? 'AKTIF' : 'NONAKTIF'}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-center">
                          <div className="inline-flex items-center justify-center bg-violet-50 text-violet-700 font-bold px-3 py-1 rounded-full text-xs">
                             {role.jumlah_pengguna} User
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                           <button 
                             onClick={() => handleEditRoleAccess(role)}
                             className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm w-full justify-center"
                           >
                              <span className="material-icons-round text-[16px]">edit_note</span> Matrix
                           </button>
                        </td>
                      </tr>
                    ))}
                    {dataRoles.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400">Tidak ada data Role</td></tr>
                    )}
                  </tbody>
               </table>
             </div>
          </div>
        )}

        {/* Konten Tab 3: Akses Sementara */}
        {activeTab === 'akses_sementara' && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="material-icons-round text-violet-500">timelapse</span> Akses Panitia Sementara
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Delegasi hak akses yang akan hangus otomatis melewati batas tanggal selesai.</p>
                </div>
                <button 
                  onClick={() => setIsAddTempModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-md"
                >
                  <span className="material-icons-round text-[18px]">add_task</span> Assign Akses Sementara
                </button>
             </div>
             
             <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
               <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 font-semibold text-slate-800 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-200">Kredensial Login</th>
                      <th className="px-6 py-4 border-b border-slate-200">Akses Kepanitiaan & Lokasi</th>
                      <th className="px-6 py-4 border-b border-slate-200">Masa Berlaku</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataUsers.filter(u => u.roles?.some((r: any) => r.tanggal_selesai)).map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold text-slate-900">{user.nama_lengkap}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            {user.roles.filter((r: any) => r.tanggal_selesai).map((r: any, i: number) => {
                               const tglSelesai = new Date(r.tanggal_selesai);
                               const sisaHari = Math.ceil((tglSelesai.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                               return (
                                <div key={i} className="flex flex-col border border-slate-200 rounded-lg p-2 bg-slate-50/50 w-fit">
                                  <span className="font-bold text-violet-700 text-xs flex items-center gap-1">
                                    <span className="material-icons-round text-[12px]">admin_panel_settings</span> {r.role_name}
                                  </span>
                                  <span className="text-[11px] text-slate-500 mt-0.5">@ {r.satelit_name}</span>
                                  {sisaHari > 0 ? (
                                     <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1 mt-1 rounded w-fit font-bold">Aktiv sisa {sisaHari} hr</span>
                                  ) : (
                                     <span className="text-[10px] bg-rose-100 text-rose-700 px-1 mt-1 rounded w-fit font-bold">KADALUARSA</span>
                                  )}
                                </div>
                               )
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                           {user.roles.filter((r: any) => r.tanggal_selesai).map((r: any, i: number) => (
                              <div key={i} className="text-xs text-slate-700 mb-2">
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{new Date(r.tanggal_mulai).toLocaleDateString('id-ID')}</span> 
                                <span className="mx-1">s/d</span> 
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{new Date(r.tanggal_selesai).toLocaleDateString('id-ID')}</span>
                              </div>
                           ))}
                        </td>
                      </tr>
                    ))}
                    {dataUsers.filter(u => u.roles?.some((r: any) => r.tanggal_selesai)).length === 0 && (
                      <tr><td colSpan={3} className="p-8 text-center text-slate-400">Belum ada daftar kepanitiaan yang menggunakan akses sementara.</td></tr>
                    )}
                  </tbody>
               </table>
             </div>
          </div>
        )}
        {activeTab === 'akun_pengguna' && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-icons-round text-violet-500">people</span> Daftar Akun Pengguna
                </h2>
                <button 
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-md"
                >
                  <span className="material-icons-round text-[18px]">person_add</span> Tambah Akun Baru
                </button>
             </div>
             
             <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
               <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 font-semibold text-slate-800 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-200">Kredensial Login</th>
                      <th className="px-6 py-4 border-b border-slate-200">Akses Sistem & Lokasi</th>
                      <th className="px-6 py-4 border-b border-slate-200">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold text-slate-900">{user.nama_lengkap}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div>
                          {!user.is_active && <span className="mt-2 inline-block px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded">SUSPENDED</span>}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            {user.roles && user.roles.map((r: any, i: number) => (
                              <div key={i} className="flex flex-col border border-slate-200 rounded-lg p-2 bg-slate-50/50 w-fit">
                                <span className="font-bold text-violet-700 text-xs flex items-center gap-1">
                                  <span className="material-icons-round text-[12px]">admin_panel_settings</span> {r.role_name}
                                </span>
                                <span className="text-[11px] text-slate-500 mt-0.5">@ {r.satelit_name}</span>
                                {r.tanggal_mulai && (
                                   <span className="text-[10px] bg-amber-100 text-amber-700 px-1 mt-1 rounded w-fit italic">
                                     Panitia: {new Date(r.tanggal_mulai).toLocaleDateString('id-ID')} s/d {new Date(r.tanggal_selesai).toLocaleDateString('id-ID')}
                                   </span>
                                )}
                              </div>
                            ))}
                            {(!user.roles || user.roles.length === 0) && <span className="text-slate-400 italic text-xs">Akses belum di-assign</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-xs text-slate-500">
                          {user.last_login_at ? new Date(user.last_login_at).toLocaleString('id-ID') : 'Belum pernah login'}
                        </td>
                      </tr>
                    ))}
                    {dataUsers.length === 0 && (
                      <tr><td colSpan={3} className="p-8 text-center text-slate-400">Belum ada akun terdaftar</td></tr>
                    )}
                  </tbody>
               </table>
             </div>
          </div>
        )}

        {/* Konten Tab 3: Akses Sementara */}
        {activeTab === 'akses_sementara' && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="material-icons-round text-amber-500">timelapse</span> Akses Panitia Sementara
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Delegasi hak akses yang akan hangus otomatis melewati batas tanggal selesai.</p>
                </div>
                <button 
                  onClick={() => setIsAddTempModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-md"
                >
                  <span className="material-icons-round text-[18px]">add_task</span> Assign Akses Sementara
                </button>
             </div>
             
             <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
               <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 font-semibold text-slate-800 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-200">Kredensial Login</th>
                      <th className="px-6 py-4 border-b border-slate-200">Akses Kepanitiaan & Lokasi</th>
                      <th className="px-6 py-4 border-b border-slate-200">Masa Berlaku</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataUsers.filter(u => u.roles?.some((r: any) => r.tanggal_selesai)).map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold text-slate-900">{user.nama_lengkap}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            {user.roles.filter((r: any) => r.tanggal_selesai).map((r: any, i: number) => {
                               const tglSelesai = new Date(r.tanggal_selesai);
                               const sisaHari = Math.ceil((tglSelesai.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                               return (
                                <div key={i} className="flex flex-col border border-slate-200 rounded-lg p-2 bg-slate-50/50 w-fit">
                                  <span className="font-bold text-violet-700 text-xs flex items-center gap-1">
                                    <span className="material-icons-round text-[12px]">admin_panel_settings</span> {r.role_name}
                                  </span>
                                  <span className="text-[11px] text-slate-500 mt-0.5">@ {r.satelit_name}</span>
                                  {sisaHari > 0 ? (
                                     <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1 mt-1 rounded w-fit font-bold">Aktiv sisa {sisaHari} hr</span>
                                  ) : (
                                     <span className="text-[10px] bg-rose-100 text-rose-700 px-1 mt-1 rounded w-fit font-bold">KADALUARSA</span>
                                  )}
                                </div>
                               )
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                           {user.roles.filter((r: any) => r.tanggal_selesai).map((r: any, i: number) => (
                              <div key={i} className="text-xs text-slate-700 mb-2">
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{new Date(r.tanggal_mulai).toLocaleDateString('id-ID')}</span> 
                                <span className="mx-1">s/d</span> 
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{new Date(r.tanggal_selesai).toLocaleDateString('id-ID')}</span>
                              </div>
                           ))}
                        </td>
                      </tr>
                    ))}
                    {dataUsers.filter(u => u.roles?.some((r: any) => r.tanggal_selesai)).length === 0 && (
                      <tr><td colSpan={3} className="p-8 text-center text-slate-400">Belum ada daftar kepanitiaan yang menggunakan akses sementara.</td></tr>
                    )}
                  </tbody>
               </table>
             </div>
          </div>
        )}

        {/* Modal Role Permission Matrix */}
        {isRoleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
              
              <div className="h-2 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>
              
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-icons-round text-violet-500">admin_panel_settings</span>
                    Matrix Edit Hak Akses
                  </h3>
                  <div className="text-sm font-medium text-slate-500">
                    Menyesuaikan wewenang untuk role: <span className="font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{selectedRole?.nama_role}</span>
                  </div>
                </div>
                <button onClick={() => setIsRoleModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                  <span className="material-icons-round text-[20px]">close</span>
                </button>
              </div>

              <div className="p-8 overflow-y-auto bg-slate-50/50">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 uppercase text-[11px] font-bold text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-6 py-4 border-b border-slate-200 w-1/4">Modul Sistem</th>
                        <th className="px-6 py-4 border-b border-slate-200 text-center text-sky-600">
                          <div className="flex flex-col items-center gap-1"><span className="material-icons-round">visibility</span> Lihat (View)</div>
                        </th>
                        <th className="px-6 py-4 border-b border-slate-200 text-center text-emerald-600">
                          <div className="flex flex-col items-center gap-1"><span className="material-icons-round">add_circle</span> Tambah (Create)</div>
                        </th>
                        <th className="px-6 py-4 border-b border-slate-200 text-center text-amber-600">
                          <div className="flex flex-col items-center gap-1"><span className="material-icons-round">edit</span> Ubah (Edit)</div>
                        </th>
                        <th className="px-6 py-4 border-b border-slate-200 text-center text-rose-600">
                          <div className="flex flex-col items-center gap-1"><span className="material-icons-round">gavel</span> Khusus (Manage)</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modulesLayout.map((mod, idx) => {
                        const viewId   = mod.customPrefix ? getPermId(mod.prefix, 'view') : getPermId(mod.prefix, 'view');
                        const createId = mod.customPrefix ? null : getPermId(mod.prefix, 'create');
                        const editId   = mod.customPrefix ? null : getPermId(mod.prefix, 'edit');
                        const manageId = mod.customPrefix ? getPermId(mod.manageSuffix!, '') : (mod.manageSuffix ? getPermId(mod.prefix, mod.manageSuffix) : null);

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4 font-bold text-slate-700">{mod.label}</td>
                            
                            {/* VIEW */}
                            <td className="px-6 py-4 text-center">
                              {mod.hasView && viewId ? (
                                <input type="checkbox" className="w-5 h-5 accent-sky-500 cursor-pointer hover:scale-110 transition-transform" 
                                  checked={rolePermissions.includes(viewId)} onChange={() => togglePermission(viewId)} />
                              ) : <span className="text-slate-300">-</span>}
                            </td>

                            {/* CREATE */}
                            <td className="px-6 py-4 text-center">
                              {mod.hasCreate && createId ? (
                                <input type="checkbox" className="w-5 h-5 accent-emerald-500 cursor-pointer hover:scale-110 transition-transform" 
                                  checked={rolePermissions.includes(createId)} onChange={() => togglePermission(createId)} />
                              ) : <span className="text-slate-300">-</span>}
                            </td>

                            {/* EDIT */}
                            <td className="px-6 py-4 text-center">
                              {mod.hasEdit && editId ? (
                                <input type="checkbox" className="w-5 h-5 accent-amber-500 cursor-pointer hover:scale-110 transition-transform" 
                                  checked={rolePermissions.includes(editId)} onChange={() => togglePermission(editId)} />
                              ) : <span className="text-slate-300">-</span>}
                            </td>

                            {/* MANAGE (Khusus) */}
                            <td className="px-6 py-4 text-center">
                              {manageId ? (
                                <input type="checkbox" className="w-5 h-5 accent-rose-500 cursor-pointer hover:scale-110 transition-transform" 
                                  checked={rolePermissions.includes(manageId)} onChange={() => togglePermission(manageId)} />
                              ) : <span className="text-slate-300">-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0">
                <button onClick={() => setIsRoleModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  Batal
                </button>
                <button onClick={saveRolePermissions} className="px-8 py-2 rounded-lg text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-md flex items-center gap-2">
                  <span className="material-icons-round text-[18px]">done_all</span>
                  Simpan Hak Akses
                </button>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Modal Tambah Akun Pengguna */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-visible">
            
            <div className="h-2 w-full bg-gradient-to-r from-violet-500 to-sky-500 rounded-t-2xl"></div>
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center text-slate-800">
               <h3 className="text-xl font-bold flex items-center gap-2">
                 <span className="material-icons-round text-violet-500">person_add</span> Buat Akun Sistem
               </h3>
               <button onClick={() => setIsAddUserModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex justify-center items-center">
                 <span className="material-icons-round text-[20px] text-slate-500">close</span>
               </button>
            </div>

            <div className="p-6 flex flex-col gap-6 bg-slate-50/50">
               {/* 1. Cari Jemaat (Wajib Fisik Terdaftar) */}
               <div className="flex flex-col gap-1 w-full relative">
                 <JemaatAutocomplete
                   label="Beri Akses Kepada: (Cari Jemaat)"
                   valueName={newUserSearchQuery}
                   placeholder="Ketik nama jemaat terdaftar..."
                   onSelect={(j, str) => {
                     setNewUserSelectedJemaat(j);
                     setNewUserSearchQuery(str);
                     // set email default kalau jemaat punya email, kalau tidak kosongkan
                     setNewUserForm(p => ({ ...p, email: j?.email || p.email }));
                   }}
                 />
                 {newUserSelectedJemaat && (
                    <div className="mt-2 p-2 bg-emerald-50 text-emerald-700 text-xs font-bold font-mono border border-emerald-100 rounded flex gap-2 w-fit">
                      <span className="material-icons-round text-[16px]">check_circle</span> 
                      {newUserSelectedJemaat.jemaat_id} - Terverifikasi
                    </div>
                 )}
               </div>

               {/* Kredensial Login */}
               <div className="grid grid-cols-2 gap-4">
                 <div className="flex flex-col gap-1">
                   <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Email Login</label>
                   <input type="email" placeholder="contoh@gsjapusat.id" className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                     value={newUserForm.email} onChange={e => setNewUserForm(p => ({ ...p, email: e.target.value }))} />
                 </div>
                 <div className="flex flex-col gap-1">
                   <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Password</label>
                   <input type="text" placeholder="Default Password" className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                     value={newUserForm.password} onChange={e => setNewUserForm(p => ({ ...p, password: e.target.value }))} />
                 </div>
               </div>

               {/* Assign Role Sistem */}
               <div className="flex flex-col gap-3 p-4 bg-violet-50 border border-violet-100 rounded-xl">
                  <div className="text-violet-800 font-bold text-sm flex items-center gap-1">
                    <span className="material-icons-round text-[16px]">how_to_reg</span> Assign Role Inti
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-violet-700 text-xs font-bold uppercase">Role Akses</label>
                      <select className="px-3 py-2.5 bg-white border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-semibold text-slate-800"
                        value={newUserForm.role_id} onChange={e => setNewUserForm(p => ({ ...p, role_id: e.target.value }))}>
                         <option value="">-- Pilih Sistem Role --</option>
                         {dataRoles.filter(r => r.is_active).map(r => (
                           <option key={r.id} value={r.id}>{r.nama_role}</option>
                         ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-violet-700 text-xs font-bold uppercase">Lokasi Akses (Satelit)</label>
                      <select className="px-3 py-2.5 bg-white border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-semibold text-slate-800"
                        value={newUserForm.satelit_id} onChange={e => setNewUserForm(p => ({ ...p, satelit_id: e.target.value }))}>
                         <option value="">-- Pilih Wilayah / Satelit --</option>
                         {satelitOptions.map(s => (
                           <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                         ))}
                      </select>
                    </div>
                  </div>
               </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl bg-white">
               <button onClick={() => setIsAddUserModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
               <button onClick={handleCreateUser} className="px-8 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow flex items-center gap-2">
                 <span className="material-icons-round text-[18px]">vpn_key</span> Buat Akses Sekarang
               </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
