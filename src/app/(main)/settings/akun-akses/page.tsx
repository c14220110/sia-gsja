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
      <label className="text-slate-500 text-xs font-bold font-sans uppercase leading-4">{label}</label>
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
                <span className="text-[11px] text-slate-500 font-sans">{j.jemaat_id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

type TabKey = 'role_permission' | 'akun_pengguna' | 'akses_sementara' | 'bulk_generate';
interface RoleAssignment { role_id: string; satelit_id: string; komisi_id?: string; departemen_id?: string; }

export default function AkunAksesPage() {
  const { showLoader, hideLoader } = useLoader();
  const [activeTab, setActiveTab] = useState<TabKey>('role_permission');
  const [dataRoles, setDataRoles] = useState<any[]>([]);
  const [dataUsers, setDataUsers] = useState<any[]>([]);
  
  // Auth & Permissions State
  const [userData, setUserData] = useState<any>(null);
  const [canManageUserAccess, setCanManageUserAccess] = useState(false);
  const [canManageTempAccess, setCanManageTempAccess] = useState(false);

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
  const [komisiOptionsByRow, setKomisiOptionsByRow] = useState<Record<string, any[]>>({}); // key: `${modalKey}-${idx}`
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
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

  // Bulk Generate State
  const [dataBulk, setDataBulk] = useState<any[]>([]);
  const [filterBulkStatus, setFilterBulkStatus] = useState<string>('no_account'); // 'all' | 'no_account'
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [selectedBulkIds, setSelectedBulkIds] = useState<number[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkPage, setBulkPage] = useState(1);

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

  const fetchBulkData = async (filter: string = 'no_account') => {
    try {
      setIsBulkLoading(true);
      const res = await fetch(`/api/settings/akun-akses/bulk-generate?filter=${filter}`);
      const json = await res.json();
      if (json.success) { setDataBulk(json.data); setSelectedBulkIds([]); setBulkPage(1); }
    } catch(e) { console.error(e); } finally { setIsBulkLoading(false); }
  };

  useEffect(() => {
    const fetchAuthParams = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const u = await res.json();
          setUserData(u);
          const hasUserAcc = u.is_super_admin || u.permissions?.includes('user_access_manage');
          const hasTempAcc = u.is_super_admin || u.permissions?.includes('akses_sementara_manage');
          setCanManageUserAccess(hasUserAcc);
          setCanManageTempAccess(hasTempAcc);
          
          if (!hasUserAcc && hasTempAcc) {
            setActiveTab('akses_sementara');
          }
        }
      } catch (err) {
        console.error('Failed fetching auth data', err);
      }
    };
    fetchAuthParams();
  }, []);

  useEffect(() => {
    if (activeTab === 'role_permission' && canManageUserAccess) fetchRolesData();
    else if (activeTab === 'akun_pengguna' && canManageUserAccess) { fetchUsersData(); fetchRolesData(true); }
    else if (activeTab === 'akses_sementara' && canManageTempAccess) { fetchUsersData(); fetchRolesData(true); }
    else if (activeTab === 'bulk_generate' && canManageUserAccess) { fetchBulkData(filterBulkStatus); }
  }, [activeTab, canManageUserAccess, canManageTempAccess]);

  useEffect(() => {
    if (activeTab === 'bulk_generate') {
      fetchBulkData(filterBulkStatus);
    }
  }, [filterBulkStatus]);

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

  const getPermIdExact = (permName: string) => {
    const p = permissionsMaster.find(x => x.nama_permission === permName);
    return p ? p.id : null;
  };

  const permissionGroups = [
    {
      title: 'Data Jemaat', icon: 'people', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100', ring: 'focus:ring-sky-500', 
      checkedBg: 'checked:bg-sky-500', checkBorder: 'peer-checked:border-sky-500', activeBg: 'bg-sky-100',
      keys: ['jemaat_view', 'jemaat_create', 'jemaat_edit', 'jemaat_delete']
    },
    {
      title: 'Data Pelayan & Pengurus', icon: 'badge', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', ring: 'focus:ring-indigo-500', 
      checkedBg: 'checked:bg-indigo-500', checkBorder: 'peer-checked:border-indigo-500', activeBg: 'bg-indigo-100',
      keys: ['pelayan_view', 'pelayan_manage', 'pengurus_view', 'pengurus_manage']
    },
    {
      title: 'Kegiatan & Pelayanan', icon: 'event', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', ring: 'focus:ring-amber-500', 
      checkedBg: 'checked:bg-amber-500', checkBorder: 'peer-checked:border-amber-500', activeBg: 'bg-amber-100',
      keys: ['kegiatan_view', 'kegiatan_create', 'kegiatan_manage', 'kegiatan_absensi', 'kegiatan_lpj', 'kegiatan_pastoral_view', 'kegiatan_pastoral_manage']
    },
    {
      title: 'Keuangan & Anggaran', icon: 'account_balance_wallet', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', ring: 'focus:ring-emerald-500', 
      checkedBg: 'checked:bg-emerald-500', checkBorder: 'peer-checked:border-emerald-500', activeBg: 'bg-emerald-100',
      keys: ['anggaran_view', 'anggaran_create', 'anggaran_review', 'buku_besar_view', 'buku_besar_manage']
    },
    {
      title: 'HRD & Penggajian', icon: 'work', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', ring: 'focus:ring-rose-500', 
      checkedBg: 'checked:bg-rose-500', checkBorder: 'peer-checked:border-rose-500', activeBg: 'bg-rose-100',
      keys: ['pegawai_view', 'pegawai_create', 'pegawai_edit', 'pegawai_approval', 'penggajian_manage']
    },
    {
      title: 'Sistem & Keamanan', icon: 'admin_panel_settings', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200', ring: 'focus:ring-slate-500', 
      checkedBg: 'checked:bg-slate-700', checkBorder: 'peer-checked:border-slate-700', activeBg: 'bg-slate-200',
      keys: ['master_data_manage', 'user_access_manage', 'akses_sementara_manage', 'audit_log_view', 'multi_satelit_view']
    }
  ];

  // Multi-role helpers
  const addRoleRow = (setter: React.Dispatch<React.SetStateAction<RoleAssignment[]>>) => setter(prev => [...prev, { role_id: '', satelit_id: '', komisi_id: '', departemen_id: '' }]);
  const removeRoleRow = (setter: React.Dispatch<React.SetStateAction<RoleAssignment[]>>, idx: number) => setter(prev => prev.filter((_, i) => i !== idx));
  const updateRoleRow = (setter: React.Dispatch<React.SetStateAction<RoleAssignment[]>>, idx: number, field: keyof RoleAssignment, value: string) => setter(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  // Fetch komisi options when satelit+role changes (called from role row onChange)
  const fetchKomisiForRow = async (rowKey: string, satelitId: string) => {
    if (!satelitId) { setKomisiOptionsByRow(p => ({ ...p, [rowKey]: [] })); return; }
    try {
      const res = await fetch(`/api/options?type=komisi&satelit_id=${satelitId}`);
      const json = await res.json();
      setKomisiOptionsByRow(p => ({ ...p, [rowKey]: json.success ? json.data : [] }));
    } catch { setKomisiOptionsByRow(p => ({ ...p, [rowKey]: [] })); }
  };

  // Fetch departemen options (flat list, no satelit filter)
  const ensureDepartemenOptions = async () => {
    if (departemenOptions.length > 0) return;
    try {
      const res = await fetch('/api/options?type=departemen');
      const json = await res.json();
      if (json.success) setDepartemenOptions(json.data);
    } catch {}
  };

  // Helper: get role name string from role_id
  const getRoleName = (roleId: string) => dataRoles.find((r: any) => String(r.id) === roleId)?.nama_role || '';

  // Reusable role row renderer
  const renderRoleRow = (
    assignments: RoleAssignment[],
    setter: React.Dispatch<React.SetStateAction<RoleAssignment[]>>,
    modalKey: string,
    accentClass: string
  ) => assignments.map((assignment, idx) => {
    const rowKey = `${modalKey}-${idx}`;
    const roleName = getRoleName(assignment.role_id);
    const needsKomisi = roleName === 'KETUA_KOMISI';
    const needsDept = roleName === 'KETUA_DEPARTEMEN';
    return (
      <div key={idx} className="flex flex-col gap-2 bg-white rounded-lg p-2.5 border border-slate-100">
        <div className="flex items-center gap-2">
          <select
            className={`flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 ${accentClass} text-sm font-semibold text-slate-800`}
            value={assignment.role_id}
            onChange={e => {
              updateRoleRow(setter, idx, 'role_id', e.target.value);
              // Reset sub-fields when role changes
              setter(prev => prev.map((r, i) => i === idx ? { ...r, komisi_id: '', departemen_id: '' } : r));
              const newRoleName = dataRoles.find((r: any) => String(r.id) === e.target.value)?.nama_role || '';
              if (newRoleName === 'KETUA_DEPARTEMEN') ensureDepartemenOptions();
            }}
          >
            <option value="">-- Role --</option>
            {dataRoles.filter((r: any) => r.is_active && r.nama_role !== 'JEMAAT').map((r: any) => <option key={r.id} value={r.id}>{r.nama_role}</option>)}
          </select>
          <select
            className={`flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 ${accentClass} text-sm font-semibold text-slate-800`}
            value={assignment.satelit_id}
            onChange={e => {
              updateRoleRow(setter, idx, 'satelit_id', e.target.value);
              if (needsKomisi) fetchKomisiForRow(rowKey, e.target.value);
            }}
          >
            <option value="">-- Satelit --</option>
            {satelitOptions.map((s: any) => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
          </select>
          {assignments.length > 1 && <button type="button" onClick={() => removeRoleRow(setter, idx)} className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-500 flex-shrink-0"><span className="material-icons-round text-[16px]">close</span></button>}
        </div>
        {needsKomisi && (
          <div className="flex items-center gap-2 pl-1">
            <span className="material-icons-round text-[14px] text-violet-400">account_tree</span>
            <select
              className={`flex-1 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 ${accentClass} text-sm text-violet-800 font-semibold`}
              value={assignment.komisi_id || ''}
              onClick={() => { if (!komisiOptionsByRow[rowKey] && assignment.satelit_id) fetchKomisiForRow(rowKey, assignment.satelit_id); }}
              onChange={e => updateRoleRow(setter, idx, 'komisi_id', e.target.value)}
            >
              <option value="">-- Pilih Komisi (wajib untuk Ketua Komisi) --</option>
              {(komisiOptionsByRow[rowKey] || []).map((k: any) => <option key={k.id} value={k.id}>{k.nama_komisi}</option>)}
            </select>
          </div>
        )}
        {needsDept && (
          <div className="flex items-center gap-2 pl-1">
            <span className="material-icons-round text-[14px] text-emerald-500">business</span>
            <select
              className={`flex-1 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 ${accentClass} text-sm text-emerald-800 font-semibold`}
              value={assignment.departemen_id || ''}
              onChange={e => updateRoleRow(setter, idx, 'departemen_id', e.target.value)}
            >
              <option value="">-- Pilih Departemen (wajib untuk Ketua Departemen) --</option>
              {departemenOptions.map((d: any) => <option key={d.id} value={d.id}>{d.nama_departemen}</option>)}
            </select>
          </div>
        )}
      </div>
    );
  });

  const filteredBulk = dataBulk.filter(j => {
    if (bulkSearchQuery && !j.nama_lengkap?.toLowerCase().includes(bulkSearchQuery.toLowerCase())) return false;
    return true;
  });
  const bulkItemsPerPage = 50;
  const bulkTotalPages = Math.ceil(filteredBulk.length / bulkItemsPerPage);
  const currentBulkItems = filteredBulk.slice((bulkPage - 1) * bulkItemsPerPage, bulkPage * bulkItemsPerPage);

  const handleSelectAllBulk = () => {
    const selectable = currentBulkItems.filter(j => !j.has_account);
    const allSelectedInPage = selectable.every(j => selectedBulkIds.includes(j.id));
    if (allSelectedInPage) {
      // Remove all elements of current selectable from selectedBulkIds
      const selectableIds = selectable.map(j => j.id);
      setSelectedBulkIds(prev => prev.filter(id => !selectableIds.includes(id)));
    } else {
      // Add all elements of current selectable to selectedBulkIds
      const selectableIds = selectable.map(j => j.id);
      setSelectedBulkIds(prev => Array.from(new Set([...prev, ...selectableIds])));
    }
  };

  const handleToggleBulkItem = (id: number) => {
    setSelectedBulkIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkGenerate = async () => {
    if (selectedBulkIds.length === 0) return;
    setIsBulkLoading(true);
    try {
      const res = await fetch('/api/settings/akun-akses/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jemaat_ids: selectedBulkIds })
      });
      const json = await res.json();
      setSubmitState({ status: json.success ? 'success' : 'error', message: json.message });
      if (json.success) {
        setSelectedBulkIds([]);
        fetchBulkData(filterBulkStatus);
        fetchUsersData();
      }
    } catch(e) { setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem.' }); } 
    finally { setIsBulkLoading(false); }
  };

  const handleCreateUser = async () => {
    if (!newUserSelectedJemaat) { setSubmitState({ status: 'error', message: 'Pilih Jemaat yang akan diberikan akun!' }); return; }
    if (!newUserForm.email || !newUserForm.password) { setSubmitState({ status: 'error', message: 'Email dan Password wajib diisi!' }); return; }
    const hasIncomplete = roleAssignments.some(r => (r.role_id && !r.satelit_id) || (!r.role_id && r.satelit_id));
    if (hasIncomplete) { setSubmitState({ status: 'error', message: 'Pilihan Role dan Satelit harus berpasangan (tidak boleh ada yang kosong)!' }); return; }
    const missingKomisi = roleAssignments.some(r => getRoleName(r.role_id) === 'KETUA_KOMISI' && !r.komisi_id);
    if (missingKomisi) { setSubmitState({ status: 'error', message: 'Pilih Komisi untuk setiap role KETUA_KOMISI!' }); return; }
    const missingDept = roleAssignments.some(r => getRoleName(r.role_id) === 'KETUA_DEPARTEMEN' && !r.departemen_id);
    if (missingDept) { setSubmitState({ status: 'error', message: 'Pilih Departemen untuk setiap role KETUA_DEPARTEMEN!' }); return; }

    const validRoles = roleAssignments.filter(r => r.role_id && r.satelit_id);
    setIsAddUserModalOpen(false);
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch('/api/settings/akun-akses/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newUserForm.email, password: newUserForm.password, jemaat_id: newUserSelectedJemaat.id, roles: validRoles.map(r => ({ role_id: parseInt(r.role_id), satelit_id: parseInt(r.satelit_id), komisi_id: r.komisi_id ? parseInt(r.komisi_id) : null, departemen_id: r.departemen_id ? parseInt(r.departemen_id) : null })) }) });
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
    const existingRoles = (user.roles || [])
      .filter((r: any) => !r.tanggal_selesai && r.role_name !== 'JEMAAT')
      .map((r: any) => ({
        role_id: r.role_id ? String(r.role_id) : '',
        satelit_id: r.satelit_id ? String(r.satelit_id) : ''
      }));
    setEditRoleAssignments(existingRoles.length > 0 ? existingRoles : [{ role_id: '', satelit_id: '' }]);
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (!editForm.email) { setSubmitState({ status: 'error', message: 'Email tidak boleh kosong!' }); return; }
    const hasIncomplete = editRoleAssignments.some(r => (r.role_id && !r.satelit_id) || (!r.role_id && r.satelit_id));
    if (hasIncomplete) { setSubmitState({ status: 'error', message: 'Pilihan Role dan Satelit harus berpasangan (tidak boleh ada yang kosong)!' }); return; }
    const missingKomisi = editRoleAssignments.some(r => getRoleName(r.role_id) === 'KETUA_KOMISI' && !r.komisi_id);
    if (missingKomisi) { setSubmitState({ status: 'error', message: 'Pilih Komisi untuk setiap role KETUA_KOMISI!' }); return; }
    const missingDept = editRoleAssignments.some(r => getRoleName(r.role_id) === 'KETUA_DEPARTEMEN' && !r.departemen_id);
    if (missingDept) { setSubmitState({ status: 'error', message: 'Pilih Departemen untuk setiap role KETUA_DEPARTEMEN!' }); return; }

    const validRoles = editRoleAssignments.filter(r => r.role_id && r.satelit_id);
    setIsEditUserModalOpen(false);
    setSubmitState({ status: 'loading', message: '' });
    try {
      const res = await fetch('/api/settings/akun-akses/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: editingUser.id, email: editForm.email, ...(editForm.password ? { password: editForm.password } : {}), roles: validRoles.map(r => ({ role_id: parseInt(r.role_id), satelit_id: parseInt(r.satelit_id), komisi_id: r.komisi_id ? parseInt(r.komisi_id) : null, departemen_id: r.departemen_id ? parseInt(r.departemen_id) : null })) }) });
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

  const handleCreateTempAccess = async () => {
    if (!tempUserForm.user_id && !newUserSelectedJemaat) { setSubmitState({ status: 'error', message: 'Silakan pilih Jemaat yang akan diberikan akses kepanitiaan!' }); return; }
    if (!tempUserForm.role_id || !tempUserForm.satelit_id) { setSubmitState({ status: 'error', message: 'Role Panitia dan Satelit wajib dipilih!' }); return; }
    if (!tempUserForm.tanggal_mulai || !tempUserForm.tanggal_selesai) { setSubmitState({ status: 'error', message: 'Durasi awal dan akhir kepanitiaan wajib diisi!' }); return; }
    if (new Date(tempUserForm.tanggal_selesai) < new Date(tempUserForm.tanggal_mulai)) { setSubmitState({ status: 'error', message: 'Tanggal selesai tidak boleh mendahului tanggal mulai!' }); return; }
    
    setIsAddTempModalOpen(false);
    setSubmitState({ status: 'loading', message: '' });
    try {
      const payload = {
        jemaat_id: newUserSelectedJemaat?.id || parseInt(tempUserForm.user_id),
        email: newUserForm.email,
        password: newUserForm.password,
        role_id: parseInt(tempUserForm.role_id),
        satelit_id: parseInt(tempUserForm.satelit_id),
        tanggal_mulai: tempUserForm.tanggal_mulai,
        tanggal_selesai: tempUserForm.tanggal_selesai
      };
      
      const res = await fetch('/api/settings/akun-akses/users/temp-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: 'Akses Panitia Sementara berhasil dibuat!' });
        setTempUserForm({ user_id: '', role_id: '', satelit_id: '', tanggal_mulai: '', tanggal_selesai: '' });
        setNewUserSelectedJemaat(null);
        setNewUserSearchQuery('');
        setNewUserForm({ email: '', password: '' });
        fetchUsersData();
      } else setSubmitState({ status: 'error', message: json.message || 'Gagal memberikan akses sementara.' });
    } catch(e) { setSubmitState({ status: 'error', message: 'Terjadi kesalahan server saat menyimpan akses panitia.' }); }
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
          <div className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Akun &amp; Hak Akses</div>
          <div className="text-slate-500 text-base font-medium font-sans leading-6 max-w-xl">
            Kelola Role Sistem (<strong>matriks akses/permissions</strong>) dan berikan kunci gembok (<strong>akun login</strong>) kepada jemaat yang berhak.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="w-full bg-slate-100 rounded-xl p-1 inline-flex justify-start items-center gap-1 overflow-x-auto">
          {[
            { key: 'role_permission', label: 'Manajemen Role & Permission', icon: 'admin_panel_settings', show: canManageUserAccess },
            { key: 'akun_pengguna', label: 'Daftar Akun Pengguna', icon: 'vpn_key', show: canManageUserAccess },
            { key: 'akses_sementara', label: 'Akses Sementara', icon: 'timelapse', show: canManageTempAccess },
            { key: 'bulk_generate', label: 'Generate Akun Massal', icon: 'group_add', show: canManageUserAccess },
          ]
          .filter(tab => tab.show)
          .map((tab) => (
            <div key={tab.key} onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex-1 h-10 px-4 rounded-lg flex justify-center items-center gap-2 cursor-pointer transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-white shadow-sm border border-slate-200' : 'hover:bg-slate-200/50 text-slate-500'}`}>
              <span className={`material-icons-round text-[18px] ${activeTab === tab.key ? 'text-violet-600' : ''}`}>{tab.icon}</span>
              <span className={`text-sm font-bold font-sans leading-5 ${activeTab === tab.key ? 'text-slate-800' : ''}`}>{tab.label}</span>
            </div>
          ))}
        </div>

        {/* Tab 1: Manajemen Role & Permission */}
        {activeTab === 'role_permission' && canManageUserAccess && (
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
        {activeTab === 'akun_pengguna' && canManageUserAccess && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span className="material-icons-round text-violet-500">people</span> Daftar Akun Pengguna</h2>
              <button onClick={() => setIsAddUserModalOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-md">
                <span className="material-icons-round text-[18px]">person_add</span> Tambah Akun Baru
              </button>
            </div>

            <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
              <div className="flex-1 min-w-[300px] relative flex items-center">
                <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
                <input type="text" placeholder="Cari nama pengguna atau email..." 
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-sans"
                  value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} />
              </div>
              <div className="relative min-w-[200px]">
                <select className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 font-sans text-sm cursor-pointer" 
                  value={filterUserRole} onChange={e => setFilterUserRole(e.target.value)}>
                  <option value="">Semua Role</option>
                  {dataRoles.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.nama_role}</option>)}
                </select>
                <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
              </div>
              <div className="relative min-w-[200px]">
                <select className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 font-sans text-sm cursor-pointer" 
                  value={filterUserSatelit} onChange={e => setFilterUserSatelit(e.target.value)}>
                  <option value="">Semua Satelit</option>
                  {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                </select>
                <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
              </div>
              <div className="relative min-w-[200px]">
                <select className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 font-sans text-sm cursor-pointer" 
                  value={filterUserStatus} onChange={e => setFilterUserStatus(e.target.value)}>
                  <option value="Semua">Semua Status</option>
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Suspended</option>
                </select>
                <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl bg-white shadow-sm [&_thead_th:first-child]:rounded-tl-xl [&_thead_th:last-child]:rounded-tr-xl">
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
                          <div className="text-xs text-slate-500 font-sans mt-0.5">{user.email}</div>
                          {!user.is_active && <span className="mt-2 inline-block px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold font-sans uppercase rounded-full">SUSPENDED</span>}
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
                                  <button onClick={() => openEditModal(user)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans">
                                    <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit Akun &amp; Role
                                  </button>
                                  <div className="w-full h-px bg-slate-100 my-1"></div>
                                  {user.is_active ? (
                                    <button onClick={() => handleToggleStatus(user.id, user.is_active)} className="w-full text-left px-4 py-2.5 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-3 text-sm text-amber-600 font-sans">
                                      <span className="material-icons-round text-[18px] text-amber-400">person_off</span> Nonaktifkan
                                    </button>
                                  ) : (
                                    <button onClick={() => handleToggleStatus(user.id, user.is_active)} className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-3 text-sm text-emerald-600 font-sans">
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
        {activeTab === 'akses_sementara' && canManageTempAccess && (
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
                      <td className="px-6 py-4 align-top"><div className="font-bold text-slate-900">{user.nama_lengkap}</div><div className="text-xs text-slate-500 font-sans mt-0.5">{user.email}</div></td>
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
                            <span className="font-sans bg-slate-100 px-1.5 py-0.5 rounded">{new Date(r.tanggal_mulai).toLocaleDateString('id-ID')}</span> <span className="mx-1">s/d</span> <span className="font-sans bg-slate-100 px-1.5 py-0.5 rounded">{new Date(r.tanggal_selesai).toLocaleDateString('id-ID')}</span>
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

        {/* Tab 4: Generate Akun Massal */}
        {activeTab === 'bulk_generate' && canManageUserAccess && (
          <div className="w-full mt-4 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span className="material-icons-round text-emerald-500">group_add</span> Pembuatan Akun Massal</h2>
                <p className="text-sm text-slate-500 mt-1">Sistem otomatis membuatkan akun serta mengunci sandi dengan <strong>tanggal lahir (DD/MM/YYYY)</strong>. <br/>Jemaat <strong>wajib ganti password</strong> pada login perdana.</p>
              </div>
              <button 
                onClick={handleBulkGenerate} 
                disabled={isBulkLoading || selectedBulkIds.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 px-6 rounded-xl flex flex-shrink-0 items-center gap-2 transition-all shadow-md">
                <span className="material-icons-round text-[18px]">bolt</span> Generate {selectedBulkIds.length > 0 ? selectedBulkIds.length : ''} Akun
              </button>
            </div>

            <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
              <div className="flex-1 min-w-[250px] relative flex items-center">
                <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
                <input type="text" placeholder="Cari nama jemaat..." 
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-sans"
                  value={bulkSearchQuery} onChange={e => { setBulkSearchQuery(e.target.value); setBulkPage(1); }} />
              </div>
              <div className="relative min-w-[200px]">
                <select className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 font-sans text-sm cursor-pointer" 
                  value={filterBulkStatus} onChange={e => setFilterBulkStatus(e.target.value)}>
                  <option value="no_account">Hanya Belum Punya Akun</option>
                  <option value="all">Tampilkan Semua Status</option>
                </select>
                <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col relative">
              {isBulkLoading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                   <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                  <thead className="bg-slate-50 font-semibold text-slate-800 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-4 border-b border-slate-200 w-10 text-center">
                        <input type="checkbox" className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
                          checked={currentBulkItems.filter(j => !j.has_account).length > 0 && selectedBulkIds.length > 0 && currentBulkItems.filter(j => !j.has_account).every(j => selectedBulkIds.includes(j.id))}
                          onChange={handleSelectAllBulk}
                        />
                      </th>
                      <th className="px-4 py-4 border-b border-slate-200">ID Jemaat</th>
                      <th className="px-4 py-4 border-b border-slate-200 min-w-[200px]">Data Jemaat</th>
                      <th className="px-4 py-4 border-b border-slate-200">Tanggal Lahir</th>
                      <th className="px-4 py-4 border-b border-slate-200">Kontak (Email)</th>
                      <th className="px-4 py-4 border-b border-slate-200">Asal Satelit</th>
                      <th className="px-4 py-4 border-b border-slate-200">Status Akun</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentBulkItems.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
                            checked={selectedBulkIds.includes(j.id)}
                            onChange={() => handleToggleBulkItem(j.id)}
                            disabled={j.has_account}
                          />
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-500 text-xs">{j.jemaat_id}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{j.nama_lengkap}</td>
                        <td className="px-4 py-3">
                          {j.tanggal_lahir ? 
                            <span className="font-sans bg-slate-100 px-2 py-1 rounded text-slate-700 text-xs">{new Date(j.tanggal_lahir).toLocaleDateString('id-ID')}</span> : 
                            <span className="text-rose-500 text-[10px] font-bold italic border border-rose-200 bg-rose-50 px-2 py-0.5 rounded">TIDAK ADA TGL LAHIR</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {j.email ? <span className="text-slate-600 text-sm">{j.email}</span> : <span className="text-rose-500 text-[10px] font-bold italic border border-rose-200 bg-rose-50 px-2 py-0.5 rounded">TIDAK ADA EMAIL</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{j.nama_satelit || '-'}</td>
                        <td className="px-4 py-3">
                          {j.has_account ? 
                            <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-[10px] font-bold uppercase tracking-wider">SUDAH PUNYA</span> : 
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">BELUM PUNYA</span>
                          }
                        </td>
                      </tr>
                    ))}
                    {currentBulkItems.length === 0 && !isBulkLoading && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Tidak ada data jemaat yang sesuai pencarian.</td></tr>}
                  </tbody>
                </table>
              </div>
              
              {bulkTotalPages > 1 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    Menampilkan <span className="font-bold text-slate-700">{(bulkPage - 1) * bulkItemsPerPage + 1}</span> hingga <span className="font-bold text-slate-700">{Math.min(bulkPage * bulkItemsPerPage, filteredBulk.length)}</span> dari <span className="font-bold text-slate-700">{filteredBulk.length}</span> entri
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setBulkPage(p => Math.max(1, p - 1))} disabled={bulkPage === 1} className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:text-emerald-600 disabled:opacity-50 transition-colors">Prev</button>
                    <button onClick={() => setBulkPage(p => Math.min(bulkTotalPages, p + 1))} disabled={bulkPage === bulkTotalPages} className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:text-emerald-600 disabled:opacity-50 transition-colors">Next</button>
                  </div>
                </div>
              )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {permissionGroups.map((group, gIdx) => (
                    <div key={gIdx} className={`bg-white rounded-xl border ${group.border} overflow-hidden shadow-sm flex flex-col`}>
                      <div className={`px-4 py-3 ${group.bg} border-b ${group.border} flex items-center gap-2`}>
                        <span className={`material-icons-round ${group.color} text-[20px]`}>{group.icon}</span>
                        <h4 className={`font-bold ${group.color} text-sm uppercase tracking-wide`}>{group.title}</h4>
                      </div>
                      <div className="p-4 flex flex-col gap-3 flex-1">
                        {group.keys.map((permKey, pIdx) => {
                          const permData = permissionsMaster.find(p => p.nama_permission === permKey);
                          if (!permData) return null;
                          const isChecked = rolePermissions.includes(permData.id);
                          return (
                            <label key={pIdx} className="flex items-start gap-3 cursor-pointer group">
                              <div className="mt-0.5 relative flex items-center justify-center shrink-0">
                                <input type="checkbox" className={`peer appearance-none w-5 h-5 border-2 border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-offset-1 ${group.ring} checked:border-transparent ${group.checkedBg} transition-all`} checked={isChecked} onChange={() => togglePermission(permData.id)} />
                                <span className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none material-icons-round text-[16px] transition-opacity">check</span>
                                <div className={`absolute inset-0 rounded pointer-events-none opacity-0 peer-checked:opacity-20 ${group.activeBg} ${group.checkBorder}`}></div>
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold transition-colors ${isChecked ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'}`}>
                                  {permData.nama_permission.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </span>
                                <span className="text-xs text-slate-500 mt-0.5 leading-relaxed">{permData.deskripsi}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
                  onSelect={(j, str) => {
                    setNewUserSelectedJemaat(j);
                    setNewUserSearchQuery(str);
                    // Auto-fill email dari data jemaat
                    if (j?.email) setNewUserForm(p => ({ ...p, email: j.email }));
                    // Reset role assignment (JEMAAT tidak perlu di-assign manual)
                    setRoleAssignments([{ role_id: '', satelit_id: '' }]);
                  }} />
                {newUserSelectedJemaat && <div className="mt-2 p-2 bg-emerald-50 text-emerald-700 text-xs font-bold font-sans border border-emerald-100 rounded flex gap-2 w-fit"><span className="material-icons-round text-[16px]">check_circle</span> {newUserSelectedJemaat.jemaat_id} - Terverifikasi</div>}
              </div>
              {(() => {
                const existingUserForNew = newUserSelectedJemaat ? dataUsers.find(u => u.jemaat_id === newUserSelectedJemaat.id) : null;
                if (existingUserForNew) {
                  const maskedEmail = existingUserForNew.email ? existingUserForNew.email.replace(/^(..)(.*)(@.+)$/, (match: string, start: string, middle: string, end: string) => start + '*'.repeat(middle.length) + end) : '***';
                  return (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 shadow-inner mt-2">
                      <span className="material-icons-round text-rose-600 mt-0.5">error</span>
                      <div className="flex flex-col gap-1.5">
                        <p className="text-sm text-rose-800 font-bold leading-relaxed">Jemaat ini sudah memiliki akun sistem (<span className="underline">{maskedEmail}</span>)!</p>
                        <p className="text-sm text-rose-700 leading-relaxed">Untuk menambah atau memodifikasi jabatannya, mohon tutup kotak ini, cari nama jemaat tersebut di dalam tabel Daftar Akun Pengguna, lalu pilih opsi <span className="font-bold underline text-rose-900 bg-rose-100 px-1 rounded">Edit Akun &amp; Role</span>.</p>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <>
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
                          <div className="text-violet-800 font-bold text-sm flex items-center gap-1"><span className="material-icons-round text-[16px]">how_to_reg</span> Assign Role Inti <span className="text-[11px] font-normal text-slate-500 ml-2 italic">💡 Opsional. Kosongkan jika hanya untuk Jemaat biasa.</span></div>
                          <button type="button" onClick={() => addRoleRow(setRoleAssignments)} className="text-xs font-bold text-violet-600 bg-white border border-violet-200 hover:bg-violet-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"><span className="material-icons-round text-[14px]">add</span> Tambah Role</button>
                        </div>
                        <div className="flex flex-col gap-2">
                          {renderRoleRow(roleAssignments, setRoleAssignments, 'add', 'focus:ring-violet-500')}
                        </div>
                        <p className="text-[11px] text-violet-600 italic">💡 Satu pengguna bisa memegang beberapa role di satelit berbeda. Komisi/Departemen muncul otomatis jika dibutuhkan.</p>
                      </div>
                    </>
                  );
                }
              })()}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-2xl flex-shrink-0">
              <button onClick={() => setIsAddUserModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
              {!(newUserSelectedJemaat && dataUsers.find(u => u.jemaat_id === newUserSelectedJemaat.id)) && (
                <button onClick={handleCreateUser} className="px-8 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow flex items-center gap-2"><span className="material-icons-round text-[18px]">vpn_key</span> Buat Akses Sekarang</button>
              )}
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
                <div className="text-sm text-slate-500 mt-0.5 font-sans">{editingUser.nama_lengkap}</div>
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
                  <div className="text-amber-800 font-bold text-sm flex items-center gap-1"><span className="material-icons-round text-[16px]">admin_panel_settings</span> Role &amp; Akses Permanen <span className="text-[11px] font-normal text-slate-500 ml-2 italic">💡 Opsional. Kosongkan jika hanya untuk Jemaat biasa.</span></div>
                  <button type="button" onClick={() => addRoleRow(setEditRoleAssignments)} className="text-xs font-bold text-amber-700 bg-white border border-amber-200 hover:bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"><span className="material-icons-round text-[14px]">add</span> Tambah Role</button>
                </div>
                <div className="flex flex-col gap-2">
                  {renderRoleRow(editRoleAssignments, setEditRoleAssignments, 'edit', 'focus:ring-amber-400')}
                </div>
                <p className="text-[11px] text-amber-600 italic">⚠️ Perubahan ini hanya mengubah role PERMANEN. Role panitia sementara tidak terpengaruh. Komisi/Departemen muncul otomatis jika role memerlukannya.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-2xl flex-shrink-0">
              <button onClick={() => setIsEditUserModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
              <button onClick={handleUpdateUser} className="px-8 py-2 rounded-lg text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 shadow flex items-center gap-2"><span className="material-icons-round text-[18px]">save</span> Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Akses Sementara */}
      {isAddTempModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="h-2 w-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-t-2xl flex-shrink-0"></div>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800"><span className="material-icons-round text-amber-500">add_task</span> Assign Akses Sementara (Panitia)</h3>
              <button onClick={() => setIsAddTempModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex justify-center items-center"><span className="material-icons-round text-[20px] text-slate-500">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-5 bg-slate-50/50 overflow-y-auto">
              <div className="relative">
                <JemaatAutocomplete label="Cari Jemaat / Panitia:" valueName={newUserSearchQuery} placeholder="Ketik nama jemaat terdaftar..."
                  onSelect={(j, str) => {
                    setNewUserSelectedJemaat(j);
                    setNewUserSearchQuery(str);
                    // Auto-fill email dan satelit dari data jemaat
                    if (j?.email) setNewUserForm(p => ({ ...p, email: j.email }));
                    if (j?.satelit_id) {
                      setTempUserForm(p => ({ ...p, satelit_id: String(j.satelit_id) }));
                    }
                  }} />
                {newUserSelectedJemaat && <div className="mt-2 p-2 bg-emerald-50 text-emerald-700 text-xs font-bold font-sans border border-emerald-100 rounded flex gap-2 w-fit"><span className="material-icons-round text-[16px]">check_circle</span> {newUserSelectedJemaat.jemaat_id} - Terverifikasi</div>}
              </div>
              {(() => {
                const existingUserForTemp = newUserSelectedJemaat ? dataUsers.find(u => u.jemaat_id === newUserSelectedJemaat.id) : null;
                if (existingUserForTemp) {
                  const maskedEmail = existingUserForTemp.email ? existingUserForTemp.email.replace(/^(..)(.*)(@.+)$/, (match: string, start: string, middle: string, end: string) => start + '*'.repeat(middle.length) + end) : '***';
                  return (
                    <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3 shadow-inner">
                      <span className="material-icons-round text-sky-600 mt-0.5">info</span>
                      <p className="text-sm text-sky-800 leading-relaxed">Jemaat ini sudah memiliki akun sistem (<span className="font-bold underline text-sky-900">{maskedEmail}</span>). Hak akses Panitia akan otomatis ditambahkan ke akun tersebut saat ia login.</p>
                    </div>
                  );
                } else {
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Email Login</label>
                        <input type="email" placeholder="contoh@gsja.id" className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" value={newUserForm.email} onChange={e => setNewUserForm(p => ({ ...p, email: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-500 text-xs font-bold uppercase tracking-wider">Password</label>
                        <input type="text" placeholder="Default Password" className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" value={newUserForm.password} onChange={e => setNewUserForm(p => ({ ...p, password: e.target.value }))} />
                      </div>
                      <div className="col-span-2 text-[11px] text-amber-700 italic font-medium -mt-1 bg-amber-50 p-2 rounded-lg border border-amber-100 flex gap-2">
                        <span className="material-icons-round text-[16px] text-amber-500">lightbulb</span> 
                        Jika jemaat ini belum memiliki akun sama sekali, kredensial di atas akan digunakan untuk memberinya askes login.
                      </div>
                    </div>
                  );
                }
              })()}

              <div className="flex flex-col gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="text-amber-800 font-bold text-sm flex items-center gap-1"><span className="material-icons-round text-[16px]">how_to_reg</span> Role &amp; Lingkup</div>
                <div className="flex items-center gap-2">
                  <select className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold text-slate-800" value={tempUserForm.role_id} onChange={e => setTempUserForm(p => ({ ...p, role_id: e.target.value }))}>
                    <option value="">-- Role Panitia --</option>
                    {dataRoles.filter(r => r.is_active && r.nama_role.includes('PANITIA')).map(r => <option key={r.id} value={r.id}>{r.nama_role}</option>)}
                  </select>
                  <select className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold text-slate-800" value={tempUserForm.satelit_id} onChange={e => setTempUserForm(p => ({ ...p, satelit_id: e.target.value }))}>
                    <option value="">-- Lokasi Satelit --</option>
                    {satelitOptions.map(s => <option key={s.id} value={s.id}>{s.nama_satelit}</option>)}
                  </select>
                </div>

                <div className="text-amber-800 font-bold text-sm flex items-center gap-1 mt-2"><span className="material-icons-round text-[16px]">event</span> Masa Berlaku Kepanitiaan</div>
                <div className="flex items-center gap-2">
                  <input type="date" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold text-slate-800" value={tempUserForm.tanggal_mulai} onChange={e => setTempUserForm(p => ({ ...p, tanggal_mulai: e.target.value }))} />
                  <span className="text-slate-400 font-bold text-sm mx-1">s/d</span>
                  <input type="date" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold text-slate-800" value={tempUserForm.tanggal_selesai} onChange={e => setTempUserForm(p => ({ ...p, tanggal_selesai: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-2xl flex-shrink-0">
              <button onClick={() => setIsAddTempModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100">Batal</button>
              <button onClick={handleCreateTempAccess} className="px-8 py-2 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 shadow flex items-center gap-2"><span className="material-icons-round text-[18px]">bolt</span> Berikan Akses Sementara</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
