'use client';

import React, { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

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
    if (searchTerm.length < 2) { setResults([]); setIsOpen(false); onSelect(null, searchTerm); return; }
    try {
      setLoading(true);
      const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) { setResults(data.data); setIsOpen(true); }
      else { setResults([]); setIsOpen(false); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="w-full flex-col gap-1 flex relative" ref={wrapperRef}>
      <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase leading-4">{label}</label>
      <input type="text" value={query} onChange={(e) => search(e.target.value)} onFocus={() => { if(results.length > 0) setIsOpen(true); }} placeholder={placeholder}
        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 w-full text-sm transition-all" />
      {isOpen && (
        <div className="absolute z-[90] top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-xl max-h-48 overflow-y-auto">
          {loading ? <div className="p-3 text-sm text-slate-500">Mencari...</div> : results.map((j) => (
            <div key={j.id} className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3" onClick={() => { onSelect(j, j.nama_lengkap); setQuery(j.nama_lengkap); setIsOpen(false); }}>
              <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                <img src={j.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(j.nama_lengkap)}&background=random`} alt="avatar" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">{j.nama_lengkap}</span>
                <span className="text-[11px] text-slate-500 font-mono">{j.jemaat_id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

type TabKey = 'role_permission' | 'akun_pengguna' | 'akses_sementara';
interface RoleAssignment { role_id: string; satelit_id: string; }

export default function AkunAksesPage() {
  const { showLoader, hideLoader } = useLoader();
  const [activeTab, setActiveTab] = useState<TabKey>('role_permission');
  const [dataRoles, setDataRoles] = useState<any[]>([]);
  const [dataUsers, setDataUsers] = useState<any[]>([]);

  // Submit & Alert State
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });
  const [alertState, setAlertState] = useState<{ isOpen: boolean; userId: number | null; newStatus: boolean }>({ isOpen: false, userId: null, newStatus: false });

  // Action menu state (pola ... seperti Data Jemaat)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Filter & Search states for Tab 2
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [filterUserRole, setFilterUserRole] = useState('');
  const [filterUserSatelit, setFilterUserSatelit] = useState('');
  const [filterUserStatus, setFilterUserStatus] = useState('Semua');

  // Matrix modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [permissionsMaster, setPermissionsMaster] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);

  // Add User modal
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [newUserSelectedJemaat, setNewUserSelectedJemaat] = useState<any>(null);
  const [newUserSearchQuery, setNewUserSearchQuery] = useState('');
  const [newUserForm, setNewUserForm] = useState({ email: '', password: '' });
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([{ role_id: '', satelit_id: '' }]);

  // Edit User modal
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ email: '', password: '' });
  const [editRoleAssignments, setEditRoleAssignments] = useState<RoleAssignment[]>([{ role_id: '', satelit_id: '' }]);

  // Temporary Access State
  const [isAddTempModalOpen, setIsAddTempModalOpen] = useState(false);
  const [tempUserForm, setTempUserForm] = useState({ user_id: '', role_id: '', satelit_id: '', tanggal_mulai: '', tanggal_selesai: '' });

  const fetchRolesData = async (silent = false) => {
    try {
      if (!silent) showLoader();
      const res = await fetch('/api/settings/akun-akses/roles');
      const json = await res.json();
      if (json.success) { setDataRoles(json.data.roles); setPermissionsMaster(json.data.permissions); }
    } catch (e) { console.error(e); } finally { if (!silent) hideLoader(); }
  };

  const fetchUsersData = async () => {
    try {
      showLoader();
      const [resUsers, resSat] = await Promise.all([fetch('/api/settings/akun-akses/users'), fetch('/api/options?type=satelit')]);
      const jsonUsers = await resUsers.json();
      const jsonSat = await resSat.json();
      if (jsonUsers.success) setDataUsers(jsonUsers.data);
      if (jsonSat.success) setSatelitOptions(jsonSat.data);
    } catch (e) { console.error(e); } finally { hideLoader(); }
  };

  useEffect(() => {
    if (activeTab === 'role_permission') fetchRolesData();
    else if (activeTab === 'akun_pengguna') { fetchUsersData(); fetchRolesData(true); }
  }, [activeTab]);

  const filteredUsers = dataUsers.filter(u => {
    // Search
    if (userSearchQuery && !u.nama_lengkap?.toLowerCase().includes(userSearchQuery.toLowerCase()) && !u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())) return false;
    
    // Status
    if (filterUserStatus === 'Aktif' && !u.is_active) return false;
    if (filterUserStatus === 'Nonaktif' && u.is_active) return false;
    
    // Satelit
    if (filterUserSatelit) {
      if (!u.roles?.some((r: any) => r.satelit_id?.toString() === filterUserSatelit)) return false;
    }
    
    // Role
    if (filterUserRole) {
      if (!u.roles?.some((r: any) => r.role_id?.toString() === filterUserRole)) return false;
    }
    
    return true;
  });

  const handleEditRoleAccess = async (role: any) => {
    setSelectedRole(role);
    try {
      showLoader();
      const res = await fetch(`/api/settings/akun-akses/roles?role_id=${role.id}`);
      const json = await res.json();
      if (json.success) { setRolePermissions(json.data); setIsRoleModalOpen(true); }
    } catch (e) { setSubmitState({ status: 'error', message: 'Gagal mengambil detail hak akses.' }); } finally { hideLoader(); }
  };

  const togglePermission = (permId: number) => {
    setRolePermissions(prev => prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]);
  };

  const saveRolePermissions = async () => {
    if (!selectedRole) return;
    setIsRoleModalOpen(false);
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch('/api/settings/akun-akses/roles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: selectedRole.id, permission_ids: rolePermissions }) });
      const json = await res.json();
      if (json.success) setSubmitState({ status: 'success', message: `Hak akses untuk ${selectedRole.nama_role} berhasil disimpan!` });
      else setSubmitState({ status: 'error', message: json.message || 'Gagal menyimpan hak akses.' });
    } catch(e) { setSubmitState({ status: 'error', message: 'Terjadi kesalahan pada server.' }); }
  };

  const getPermId = (modulNamePrefix: string, suffix: string) => {
    const p = permissionsMaster.find(x => x.nama_permission === `${modulNamePrefix}_${suffix}`);
    return p ? p.id : null;
  };

  const modulesLayout = [
    { label: 'Data Jemaat', prefix: 'jemaat', hasView: true, hasCreate: true, hasEdit: true, manageSuffix: null },
    { label: 'Data Pelayan', prefix: 'pelayan', hasView: true, hasCreate: false, hasEdit: false, manageSuffix: 'manage' },
    { label: 'Data Pengurus', prefix: 'pengurus', hasView: true, hasCreate: false, hasEdit: false, manageSuffix: 'manage' },
    { label: 'Kegiatan & Absen', prefix: 'kegiatan', hasView: true, hasCreate: true, hasEdit: true, manageSuffix: 'absensi_input' },
    { label: 'Kas & Bank', prefix: 'kas', hasView: true, hasCreate: false, hasEdit: false, manageSuffix: 'kas_input', customPrefix: true },
    { label: 'Proposal & LPJ', prefix: 'lpj', hasView: true, hasCreate: false, hasEdit: false, manageSuffix: 'lpj_approve', customPrefix: true },
    { label: 'Sistem & Master Data', prefix: 'master_data', hasView: false, hasCreate: false, hasEdit: false, manageSuffix: 'manage' },
  ];

  // Multi-role helpers
  const addRoleRow = (setter: React.Dispatch<React.SetStateAction<RoleAssignment[]>>) => setter(prev => [...prev, { role_id: '', satelit_id: '' }]);
  const removeRoleRow = (setter: React.Dispatch<React.SetStateAction<RoleAssignment[]>>, idx: number) => setter(prev => prev.filter((_, i) => i !== idx));
  const updateRoleRow = (setter: React.Dispatch<React.SetStateAction<RoleAssignment[]>>, idx: number, field: keyof RoleAssignment, value: string) => setter(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const handleCreateUser = async () => {
    if (!newUserSelectedJemaat) { setSubmitState({ status: 'error', message: 'Pilih Jemaat yang akan diberikan akun!' }); return; }
    if (!newUserForm.email || !newUserForm.password) { setSubmitState({ status: 'error', message: 'Email dan Password wajib diisi!' }); return; }
    const hasIncomplete = roleAssignments.some(r => (r.role_id && !r.satelit_id) || (!r.role_id && r.satelit_id));
    if (hasIncomplete) { setSubmitState({ status: 'error', message: 'Pilihan Role dan Satelit harus berpasangan (tidak boleh ada yang kosong)!' }); return; }
    
    const validRoles = roleAssignments.filter(r => r.role_id && r.satelit_id);
    if (validRoles.length === 0) { setSubmitState({ status: 'error', message: 'Assign minimal 1 Role dan Satelit!' }); return; }
    setIsAddUserModalOpen(false);
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch('/api/settings/akun-akses/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newUserForm.email, password: newUserForm.password, jemaat_id: newUserSelectedJemaat.id, roles: validRoles.map(r => ({ role_id: parseInt(r.role_id), satelit_id: parseInt(r.satelit_id) })) }) });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: 'Akun berhasil dibuat dan role berhasil di-assign!' });
        setNewUserForm({ email: '', password: '' }); setNewUserSelectedJemaat(null); setNewUserSearchQuery(''); setRoleAssignments([{ role_id: '', satelit_id: '' }]);
        fetchUsersData();
      } else setSubmitState({ status: 'error', message: json.message || 'Gagal membuat akun.' });
    } catch(e) { setSubmitState({ status: 'error', message: 'Terjadi kesalahan server.' }); }
  };

  const openEditModal = (user: any) => {
    setOpenMenuId(null);
    setEditingUser(user);
    setEditForm({ email: user.email, password: '' });
    const existingRoles = (user.roles || []).filter((r: any) => !r.tanggal_selesai).map((r: any) => ({
      role_id: String(dataRoles.find(dr => dr.nama_role === r.role_name)?.id || ''),
      satelit_id: String(satelitOptions.find(s => s.nama_satelit === r.satelit_name)?.id || '')
    }));
    setEditRoleAssignments(existingRoles.length > 0 ? existingRoles : [{ role_id: '', satelit_id: '' }]);
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (!editForm.email) { setSubmitState({ status: 'error', message: 'Email tidak boleh kosong!' }); return; }
    const hasIncomplete = editRoleAssignments.some(r => (r.role_id && !r.satelit_id) || (!r.role_id && r.satelit_id));
    if (hasIncomplete) { setSubmitState({ status: 'error', message: 'Pilihan Role dan Satelit harus berpasangan (tidak boleh ada yang kosong)!' }); return; }
    
    const validRoles = editRoleAssignments.filter(r => r.role_id && r.satelit_id);
    setIsEditUserModalOpen(false);
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch('/api/settings/akun-akses/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: editingUser.id, email: editForm.email, ...(editForm.password ? { password: editForm.password } : {}), roles: validRoles.map(r => ({ role_id: parseInt(r.role_id), satelit_id: parseInt(r.satelit_id) })) }) });
      const json = await res.json();
      if (json.success) { setSubmitState({ status: 'success', message: 'Data pengguna berhasil diperbarui!' }); fetchUsersData(); }
      else setSubmitState({ status: 'error', message: json.message || 'Gagal memperbarui data.' });
    } catch(e) { setSubmitState({ status: 'error', message: 'Terjadi kesalahan server.' }); }
  };

  const handleToggleStatus = (userId: number, currentStatus: boolean) => {
    setOpenMenuId(null);
    setAlertState({ isOpen: true, userId, newStatus: !currentStatus });
  };

  const confirmToggleStatus = async () => {
    const { userId, newStatus } = alertState;
    if (!userId) return;
    setAlertState({ isOpen: false, userId: null, newStatus: false });
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch('/api/settings/akun-akses/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, is_active: newStatus }) });
      const json = await res.json();
      if (json.success) {
        setDataUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
        setSubmitState({ status: 'success', message: newStatus ? 'Akun berhasil diaktifkan kembali.' : 'Akun berhasil dinonaktifkan.' });
      } else setSubmitState({ status: 'error', message: json.message || 'Gagal mengubah status akun.' });
    } catch(e) { setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi.' }); }
  };

  return (
    <div className="w-full flex justify-start items-start gap-8 flex-col sm:flex-row pb-12">

      {/* Lottie Popups - identik dengan Data Jemaat */}
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.newStatus ? 'Aktifkan Akun?' : 'Nonaktifkan Akun?'}
        message={alertState.newStatus ? 'Pengguna ini akan dapat login kembali ke sistem.' : <><strong>Pengguna tidak akan bisa login</strong> setelah dinonaktifkan. Anda bisa mengaktifkannya kembali kapan saja.</>}
        confirmText={alertState.newStatus ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan'}
        cancelText="Batal"
        onConfirm={confirmToggleStatus}
        onCancel={() => setAlertState({ isOpen: false, userId: null, newStatus: false })}
      />

      <div className="flex-col justify-start items-start gap-8 inline-flex w-full">
        {/* Header */}
        <div className="flex-col justify-start items-start gap-2 flex">
          <div className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Akun &amp; Hak Akses</div>
          <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 max-w-xl">
            Kelola Role Sistem (<strong>matriks akses/permissions</strong>) dan berikan kunci gembok (<strong>akun login</strong>) kepada jemaat yang berhak.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="w-full bg-slate-100 rounded-xl p-1 inline-flex justify-start items-center gap-1 overflow-x-auto">
          {[
            { key: 'role_permission', label: 'Manajemen Role & Permission', icon: 'admin_panel_settings' },
            { key: 'akun_pengguna', label: 'Daftar Akun Pengguna', icon: 'vpn_key' },
            { key: 'akses_sementara', label: 'Akses Sementara', icon: 'timelapse' },
          ].map((tab) => (
            <div key={tab.key} onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex-1 h-10 px-4 rounded-lg flex justify-center items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-white shadow-sm border border-slate-200' : 'hover:bg-slate-200/50 text-slate-500'}`}>
              <span className={`material-icons-round text-[18px] ${activeTab === tab.key ? 'text-violet-600' : ''}`}>{tab.icon}</span>
              <span className={`text-sm font-bold font-['Inter'] leading-5 ${activeTab === tab.key ? 'text-slate-800' : ''}`}>{tab.label}</span>
            </div>
          ))}
        </div>

        {/* Tab 1: Manajemen Role & Permission */}
        {activeTab === 'role_permission' && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span className="material-icons-round text-violet-500">list_alt</span> Daftar Role Sistem</h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 font-semibold text-slate-800 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 border-b border-slate-200">Nama Role</th>
                    <th className="px-6 py-4 border-b border-slate-200">Status</th>
                    <th className="px-6 py-4 border-b border-slate-200 text-center">Jml Pengguna</th>
                    <th className="px-6 py-4 border-b border-slate-200 w-32">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {dataRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                      <td className="px-6 py-4 align-top"><div className="font-bold text-slate-900">{role.nama_role}</div><div className="text-xs text-slate-500 mt-1 max-w-xs">{role.deskripsi || '-'}</div></td>
                      <td className="px-6 py-4 align-top"><span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider w-fit flex items-center">{role.is_active ? 'AKTIF' : 'NONAKTIF'}</span></td>
                      <td className="px-6 py-4 align-top text-center"><div className="inline-flex items-center justify-center bg-violet-50 text-violet-700 font-bold px-3 py-1 rounded-full text-xs">{role.jumlah_pengguna} User</div></td>
                      <td className="px-6 py-4 align-top">
                        <button onClick={() => handleEditRoleAccess(role)} className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm w-full justify-center">
                          <span className="material-icons-round text-[16px]">edit_note</span> Matrix
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dataRoles.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Tidak ada data Role</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Daftar Akun Pengguna */}
        {activeTab === 'akun_pengguna' && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span className="material-icons-round text-violet-500">people</span> Daftar Akun Pengguna</h2>
              <button onClick={() => setIsAddUserModalOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-md">
                <span className="material-icons-round text-[18px]">person_add</span> Tambah Akun Baru
              </button>
            </div>

            {/* Filter Options for Users */}
            <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
              <div className="flex-1 min-w-[250px] relative flex items-center">
                <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
                <input type="text" placeholder="Cari nama pengguna atau email..." 
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-['Public_Sans']"
                  value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} />
              </div>
              <div className="relative min-w-[150px]">
                <select className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer" 
                  value={filterUserRole} onChange={e => setFilterUserRole(e.target.value)}>
                  <option value="">Semua Role</option>
                  {dataRoles.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.nama_role}</option>)}
                </select>
                <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
              </div>
              <div className="relative min-w-[150px]">
                <select className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer" 
                  value={filterUserSatelit} onChange={e => setFilterUserSatelit(e.target.value)}>
                  <option value="">Semua Satelit</option>
                  {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                </select>
                <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
              </div>
              <div className="relative min-w-[150px]">
                <select className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer" 
                  value={filterUserStatus} onChange={e => setFilterUserStatus(e.target.value)}>
                  <option value="Semua">Semua Status</option>
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Suspended</option>
                </select>
                <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 font-semibold text-slate-800 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 border-b border-slate-200">Kredensial Login</th>
                    <th className="px-6 py-4 border-b border-slate-200">Akses Sistem &amp; Lokasi</th>
                    <th className="px-6 py-4 border-b border-slate-200">Last Login</th>
                    <th className="px-6 py-4 border-b border-slate-200 w-20 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user, idx) => {
                    const isLastRows = filteredUsers.length > 2 && idx >= filteredUsers.length - 2;
                    return (
                      <tr key={user.id} className={`hover:bg-slate-50 transition-colors relative ${openMenuId === user.id ? 'z-50' : 'z-10'}`}>
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold text-slate-900">{user.nama_lengkap}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div>
                          {!user.is_active && <span className="mt-2 inline-block px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded">SUSPENDED</span>}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            {user.roles && user.roles.map((r: any, i: number) => (
                              <div key={i} className="flex flex-col border border-slate-200 rounded-lg p-2 bg-slate-50/50 w-fit">
                                <span className="font-bold text-violet-700 text-xs flex items-center gap-1"><span className="material-icons-round text-[12px]">admin_panel_settings</span> {r.role_name}</span>
                                <span className="text-[11px] text-slate-500 mt-0.5">@ {r.satelit_name}</span>
                                {r.tanggal_mulai && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 mt-1 rounded w-fit italic">Panitia: {new Date(r.tanggal_mulai).toLocaleDateString('id-ID')} s/d {new Date(r.tanggal_selesai).toLocaleDateString('id-ID')}</span>}
                              </div>
                            ))}
                            {(!user.roles || user.roles.length === 0) && <span className="text-slate-400 italic text-xs">Akses belum di-assign</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-xs text-slate-500">
                          {user.last_login_at ? new Date(user.last_login_at).toLocaleString('id-ID') : 'Belum pernah login'}
                        </td>
                        {/* Action Column - pola "..." persis seperti Data Jemaat */}
                        <td className="px-6 py-4 align-top">
                          <div className="flex justify-end text-slate-400 relative">
                            <button onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)} className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors">
                              <span className="material-icons-round text-[24px]">more_horiz</span>
                            </button>
                            {openMenuId === user.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                                <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-52 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1`}>
                                  <button onClick={() => openEditModal(user)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-['Public_Sans']">
                                    <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit Akun &amp; Role
                                  </button>
                                  <div className="w-full h-px bg-slate-100 my-1"></div>
                                  {user.is_active ? (
                                    <button onClick={() => handleToggleStatus(user.id, user.is_active)} className="w-full text-left px-4 py-2.5 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-3 text-sm text-amber-600 font-['Public_Sans']">
                                      <span className="material-icons-round text-[18px] text-amber-400">person_off</span> Nonaktifkan
                                    </button>
                                  ) : (
                                    <button onClick={() => handleToggleStatus(user.id, user.is_active)} className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-3 text-sm text-emerald-600 font-['Public_Sans']">
                                      <span className="material-icons-round text-[18px] text-emerald-400">how_to_reg</span> Aktifkan Kembali
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Pencarian tidak menemukan akun pengguna.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Akses Sementara */}
        {activeTab === 'akses_sementara' && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span className="material-icons-round text-amber-500">timelapse</span> Akses Panitia Sementara</h2>
                <p className="text-sm text-slate-500 mt-1">Delegasi hak akses yang akan hangus otomatis melewati batas tanggal selesai.</p>
              </div>
              <button onClick={() => setIsAddTempModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-md">
                <span className="material-icons-round text-[18px]">add_task</span> Assign Akses Sementara
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 font-semibold text-slate-800 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 border-b border-slate-200">Kredensial Login</th>
                    <th className="px-6 py-4 border-b border-slate-200">Akses Kepanitiaan &amp; Lokasi</th>
                    <th className="px-6 py-4 border-b border-slate-200">Masa Berlaku</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataUsers.filter(u => u.roles?.some((r: any) => r.tanggal_selesai)).map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 align-top"><div className="font-bold text-slate-900">{user.nama_lengkap}</div><div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div></td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          {user.roles.filter((r: any) => r.tanggal_selesai).map((r: any, i: number) => {
                            const sisaHari = Math.ceil((new Date(r.tanggal_selesai).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                            return (
                              <div key={i} className="flex flex-col border border-slate-200 rounded-lg p-2 bg-slate-50/50 w-fit">
                                <span className="font-bold text-violet-700 text-xs flex items-center gap-1"><span className="material-icons-round text-[12px]">admin_panel_settings</span> {r.role_name}</span>
                                <span className="text-[11px] text-slate-500 mt-0.5">@ {r.satelit_name}</span>
                                {sisaHari > 0 ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1 mt-1 rounded w-fit font-bold">Aktif sisa {sisaHari} hr</span> : <span className="text-[10px] bg-rose-100 text-rose-700 px-1 mt-1 rounded w-fit font-bold">KADALUARSA</span>}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        {user.roles.filter((r: any) => r.tanggal_selesai).map((r: any, i: number) => (
                          <div key={i} className="text-xs text-slate-700 mb-2">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{new Date(r.tanggal_mulai).toLocaleDateString('id-ID')}</span> <span className="mx-1">s/d</span> <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{new Date(r.tanggal_selesai).toLocaleDateString('id-ID')}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {dataUsers.filter(u => u.roles?.some((r: any) => r.tanggal_selesai)).length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-400">Belum ada daftar kepanitiaan yang menggunakan akses sementara.</td></tr>}
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
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><span className="material-icons-round text-violet-500">admin_panel_settings</span> Matrix Edit Hak Akses</h3>
                  <div className="text-sm font-medium text-slate-500">Menyesuaikan wewenang untuk role: <span className="font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{selectedRole?.nama_role}</span></div>
                </div>
                <button onClick={() => setIsRoleModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"><span className="material-icons-round text-[20px]">close</span></button>
              </div>
              <div className="p-8 overflow-y-auto bg-slate-50/50">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 uppercase text-[11px] font-bold text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-6 py-4 border-b border-slate-200 w-1/4">Modul Sistem</th>
                        <th className="px-6 py-4 border-b border-slate-200 text-center text-sky-600"><div className="flex flex-col items-center gap-1"><span className="material-icons-round">visibility</span> Lihat (View)</div></th>
                        <th className="px-6 py-4 border-b border-slate-200 text-center text-emerald-600"><div className="flex flex-col items-center gap-1"><span className="material-icons-round">add_circle</span> Tambah (Create)</div></th>
                        <th className="px-6 py-4 border-b border-slate-200 text-center text-amber-600"><div className="flex flex-col items-center gap-1"><span className="material-icons-round">edit</span> Ubah (Edit)</div></th>
                        <th className="px-6 py-4 border-b border-slate-200 text-center text-rose-600"><div className="flex flex-col items-center gap-1"><span className="material-icons-round">gavel</span> Khusus (Manage)</div></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modulesLayout.map((mod, idx) => {
                        const viewId   = getPermId(mod.prefix, 'view');
                        const createId = mod.customPrefix ? null : getPermId(mod.prefix, 'create');
                        const editId   = mod.customPrefix ? null : getPermId(mod.prefix, 'edit');
                        const manageId = mod.customPrefix ? getPermId(mod.manageSuffix!, '') : (mod.manageSuffix ? getPermId(mod.prefix, mod.manageSuffix) : null);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-700">{mod.label}</td>
                            <td className="px-6 py-4 text-center">{mod.hasView && viewId ? <input type="checkbox" className="w-5 h-5 accent-sky-500 cursor-pointer" checked={rolePermissions.includes(viewId)} onChange={() => togglePermission(viewId)} /> : <span className="text-slate-300">-</span>}</td>
                            <td className="px-6 py-4 text-center">{mod.hasCreate && createId ? <input type="checkbox" className="w-5 h-5 accent-emerald-500 cursor-pointer" checked={rolePermissions.includes(createId)} onChange={() => togglePermission(createId)} /> : <span className="text-slate-300">-</span>}</td>
                            <td className="px-6 py-4 text-center">{mod.hasEdit && editId ? <input type="checkbox" className="w-5 h-5 accent-amber-500 cursor-pointer" checked={rolePermissions.includes(editId)} onChange={() => togglePermission(editId)} /> : <span className="text-slate-300">-</span>}</td>
                            <td className="px-6 py-4 text-center">{manageId ? <input type="checkbox" className="w-5 h-5 accent-rose-500 cursor-pointer" checked={rolePermissions.includes(manageId)} onChange={() => togglePermission(manageId)} /> : <span className="text-slate-300">-</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0">
                <button onClick={() => setIsRoleModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Batal</button>
                <button onClick={saveRolePermissions} className="px-8 py-2 rounded-lg text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-md flex items-center gap-2">
                  <span className="material-icons-round text-[18px]">done_all</span> Simpan Hak Akses
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah Akun Pengguna */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="h-2 w-full bg-gradient-to-r from-violet-500 to-sky-500 rounded-t-2xl flex-shrink-0"></div>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800"><span className="material-icons-round text-violet-500">person_add</span> Buat Akun Sistem</h3>
              <button onClick={() => setIsAddUserModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex justify-center items-center"><span className="material-icons-round text-[20px] text-slate-500">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-5 bg-slate-50/50 overflow-y-auto">
              <div className="relative">
                <JemaatAutocomplete label="Beri Akses Kepada: (Cari Jemaat)" valueName={newUserSearchQuery} placeholder="Ketik nama jemaat terdaftar..."
                  onSelect={(j, str) => { setNewUserSelectedJemaat(j); setNewUserSearchQuery(str); setNewUserForm(p => ({ ...p, email: j?.email || p.email })); }} />
                {newUserSelectedJemaat && <div className="mt-2 p-2 bg-emerald-50 text-emerald-700 text-xs font-bold font-mono border border-emerald-100 rounded flex gap-2 w-fit"><span className="material-icons-round text-[16px]">check_circle</span> {newUserSelectedJemaat.jemaat_id} - Terverifikasi</div>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Email Login</label>
                  <input type="email" placeholder="contoh@gsja.id" className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" value={newUserForm.email} onChange={e => setNewUserForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Password</label>
                  <input type="text" placeholder="Default Password" className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" value={newUserForm.password} onChange={e => setNewUserForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4 bg-violet-50 border border-violet-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="text-violet-800 font-bold text-sm flex items-center gap-1"><span className="material-icons-round text-[16px]">how_to_reg</span> Assign Role Inti</div>
                  <button type="button" onClick={() => addRoleRow(setRoleAssignments)} className="text-xs font-bold text-violet-600 bg-white border border-violet-200 hover:bg-violet-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"><span className="material-icons-round text-[14px]">add</span> Tambah Role</button>
                </div>
                <div className="flex flex-col gap-2">
                  {roleAssignments.map((assignment, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white rounded-lg p-2.5 border border-violet-100">
                      <select className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-semibold text-slate-800" value={assignment.role_id} onChange={e => updateRoleRow(setRoleAssignments, idx, 'role_id', e.target.value)}>
                        <option value="">-- Role --</option>
                        {dataRoles.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.nama_role}</option>)}
                      </select>
                      <select className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-semibold text-slate-800" value={assignment.satelit_id} onChange={e => updateRoleRow(setRoleAssignments, idx, 'satelit_id', e.target.value)}>
                        <option value="">-- Satelit --</option>
                        {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                      </select>
                      {roleAssignments.length > 1 && <button type="button" onClick={() => removeRoleRow(setRoleAssignments, idx)} className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-500 flex-shrink-0"><span className="material-icons-round text-[16px]">close</span></button>}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-violet-600 italic">💡 Satu pengguna bisa memegang beberapa role di satelit berbeda.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-2xl flex-shrink-0">
              <button onClick={() => setIsAddUserModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
              <button onClick={handleCreateUser} className="px-8 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow flex items-center gap-2"><span className="material-icons-round text-[18px]">vpn_key</span> Buat Akses Sekarang</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Akun Pengguna */}
      {isEditUserModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="h-2 w-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-t-2xl flex-shrink-0"></div>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800"><span className="material-icons-round text-amber-500">manage_accounts</span> Edit Akun Pengguna</h3>
                <div className="text-sm text-slate-500 mt-0.5 font-mono">{editingUser.nama_lengkap}</div>
              </div>
              <button onClick={() => setIsEditUserModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex justify-center items-center"><span className="material-icons-round text-[20px] text-slate-500">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-5 bg-slate-50/50 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Email Login</label>
                  <input type="email" className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Password Baru <span className="text-slate-400 normal-case font-normal">(kosongkan jika tidak diubah)</span></label>
                  <input type="text" placeholder="Password baru..." className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="text-amber-800 font-bold text-sm flex items-center gap-1"><span className="material-icons-round text-[16px]">admin_panel_settings</span> Role &amp; Akses Permanen</div>
                  <button type="button" onClick={() => addRoleRow(setEditRoleAssignments)} className="text-xs font-bold text-amber-700 bg-white border border-amber-200 hover:bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"><span className="material-icons-round text-[14px]">add</span> Tambah Role</button>
                </div>
                <div className="flex flex-col gap-2">
                  {editRoleAssignments.map((assignment, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white rounded-lg p-2.5 border border-amber-100">
                      <select className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm font-semibold text-slate-800" value={assignment.role_id} onChange={e => updateRoleRow(setEditRoleAssignments, idx, 'role_id', e.target.value)}>
                        <option value="">-- Role --</option>
                        {dataRoles.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.nama_role}</option>)}
                      </select>
                      <select className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm font-semibold text-slate-800" value={assignment.satelit_id} onChange={e => updateRoleRow(setEditRoleAssignments, idx, 'satelit_id', e.target.value)}>
                        <option value="">-- Satelit --</option>
                        {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                      </select>
                      {editRoleAssignments.length > 1 && <button type="button" onClick={() => removeRoleRow(setEditRoleAssignments, idx)} className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-500 flex-shrink-0"><span className="material-icons-round text-[16px]">close</span></button>}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-amber-600 italic">⚠️ Perubahan ini hanya mengubah role PERMANEN. Role panitia sementara tidak terpengaruh.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-2xl flex-shrink-0">
              <button onClick={() => setIsEditUserModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
              <button onClick={handleUpdateUser} className="px-8 py-2 rounded-lg text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 shadow flex items-center gap-2"><span className="material-icons-round text-[18px]">save</span> Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
