'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

type COA = {
  id: number;
  kode_akun: string;
  nama_akun: string;
  induk_akun_id: number | null;
  grup_laporan: string;
  tipe_akun: string;
  saldo_normal: string;
  is_active: boolean;
  children?: COA[];
};

export default function COAPage() {
  const [coaList, setCoaList] = useState<COA[]>([]);
  const [treeData, setTreeData] = useState<COA[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  
  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [formData, setFormData] = useState({
    id: 0,
    induk_akun_id: '',
    tipe_akun: 'Detail',
    kode_akun: '',
    nama_akun: '',
    grup_laporan: 'Neraca',
    saldo_normal: 'Debit',
    is_active: true
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, item: COA | null}>({isOpen: false, item: null});

  const fetchCOA = async () => {
    try {
      const res = await fetch('/api/buku-besar/coa');
      const json = await res.json();
      if (json.success) {
        setCoaList(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch COA', err);
    }
  };

  useEffect(() => {
    fetchCOA();
  }, []);

  // Compute Tree and Search Filter
  useEffect(() => {
    let flatData = [...coaList];
    const map = new Map<number, COA>();
    const roots: COA[] = [];

    // Filter by search query first if exists
    let matchedIds = new Set<number>();
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      // Find matches
      flatData.forEach(item => {
        if (item.nama_akun.toLowerCase().includes(query) || item.kode_akun.toLowerCase().includes(query)) {
          matchedIds.add(item.id);
          // Also trace up to add parents so tree doesn't break
          let curr = item;
          while (curr.induk_akun_id) {
            const parent = flatData.find(p => p.id === curr.induk_akun_id);
            if (parent) {
              matchedIds.add(parent.id);
              curr = parent;
            } else {
              break;
            }
          }
        }
      });
      // Filter the flat data
      flatData = flatData.filter(item => matchedIds.has(item.id));
      
      // Auto expand all when searching
      const allExpanded: Record<number, boolean> = {};
      flatData.forEach(i => { allExpanded[i.id] = true; });
      setExpandedNodes(allExpanded);
    }

    // Build Tree
    flatData.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    flatData.forEach(item => {
      const node = map.get(item.id);
      if (node) {
        if (item.induk_akun_id) {
          const parent = map.get(item.induk_akun_id);
          if (parent) {
             parent.children!.push(node);
          } else {
             roots.push(node); // Orphan fallback
          }
        } else {
          roots.push(node);
        }
      }
    });

    // Sort tree recursively so active nodes are on top
    const sortNodes = (nodes: COA[]) => {
      nodes.sort((a, b) => {
        // active first
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return -1 * -1; // return 1
        // then by kode_akun
        return a.kode_akun.localeCompare(b.kode_akun);
      });
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          sortNodes(n.children);
        }
      });
    };

    sortNodes(roots);
    setTreeData(roots);
  }, [coaList, searchQuery]);

  const toggleExpand = (id: number) => {
    setExpandedNodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleOpenDrawer = (parentItem?: COA) => {
    setErrorMsg('');
    setIsEditMode(false);
    
    // Auto fill parent logic
    if (parentItem) {
      setFormData({
        id: 0,
        induk_akun_id: parentItem.id.toString(),
        tipe_akun: 'Detail',
        kode_akun: '',
        nama_akun: '',
        grup_laporan: parentItem.grup_laporan,
        saldo_normal: parentItem.saldo_normal,
        is_active: true
      });
    } else {
      setFormData({
        id: 0,
        induk_akun_id: '',
        tipe_akun: 'Detail',
        kode_akun: '',
        nama_akun: '',
        grup_laporan: 'Neraca',
        saldo_normal: 'Debit',
        is_active: true
      });
    }
    setIsDrawerOpen(true);
  };

  const handleEditDrawer = (item: COA) => {
    setErrorMsg('');
    setIsEditMode(true);
    setFormData({
      id: item.id,
      induk_akun_id: item.induk_akun_id ? item.induk_akun_id.toString() : '',
      tipe_akun: item.tipe_akun,
      kode_akun: item.kode_akun,
      nama_akun: item.nama_akun,
      grup_laporan: item.grup_laporan,
      saldo_normal: item.saldo_normal,
      is_active: item.is_active
    });
    setIsDrawerOpen(true);
  };

  const handleToggleActive = (item: COA) => {
    setConfirmModal({ isOpen: true, item });
  };

  const executeToggleActive = async (item: COA) => {
    setConfirmModal({ isOpen: false, item: null });
    try {
      setSubmitState({ status: 'loading', message: 'Memproses pembaruan status akun...' });
      const payload = { ...item, is_active: !item.is_active };
      const res = await fetch('/api/buku-besar/coa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: 'Status akun berhasil diperbarui!' });
        setTimeout(() => {
          setSubmitState({ status: 'idle', message: '' });
          fetchCOA();
        }, 1500);
      } else {
        setSubmitState({ status: 'error', message: json.message || 'Gagal update status' });
      }
    } catch (err: any) {
      setSubmitState({ status: 'error', message: 'Kesalahan jaringan: ' + err.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitState({ status: 'loading', message: 'Menyimpan data akun...' });
    try {
      const payload = {
        ...formData,
        induk_akun_id: formData.induk_akun_id ? parseInt(formData.induk_akun_id) : null
      };

      const res = await fetch('/api/buku-besar/coa', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setSubmitState({ status: 'success', message: 'Data akun berhasil disimpan!' });
        setTimeout(() => {
          setSubmitState({ status: 'idle', message: '' });
          setIsDrawerOpen(false);
          fetchCOA();
        }, 1500);
      } else {
        const errorText = json.message + (json.error ? `: ${json.error}` : '');
        setSubmitState({ status: 'error', message: errorText });
      }
    } catch (err: any) {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan jaringan: ' + err.message });
    }
  };

  const renderTreeRows = (nodes: COA[], depth = 0): React.ReactNode[] => {
    let rows: React.ReactNode[] = [];
    nodes.forEach(node => {
      const isExpanded = !!expandedNodes[node.id];
      const hasChildren = node.children && node.children.length > 0;
      const isHeader = node.tipe_akun === 'Header';
      const isInactive = !node.is_active;

      rows.push(
        <tr key={node.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isInactive ? 'bg-slate-50/50' : ''}`}>
          <td className="p-4 text-sm font-medium">
            <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
              {isHeader ? (
                 <button 
                   onClick={() => toggleExpand(node.id)}
                   className={`w-6 h-6 mr-1 flex items-center justify-center outline-none ${isInactive ? 'text-slate-300 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   <span className="material-icons-round text-lg">
                     {isExpanded ? 'expand_more' : 'chevron_right'}
                   </span>
                 </button>
              ) : (
                <div className="w-6 mr-1" />
              )}
              <span className={isInactive ? 'text-gray-400' : 'text-slate-800'}>
                {node.kode_akun}
              </span>
            </div>
          </td>
          <td className="p-4 text-sm">
            <span className={`${isHeader && !isInactive ? 'font-bold text-slate-800' : isHeader && isInactive ? 'font-bold text-gray-400' : isInactive ? 'text-gray-400' : 'text-slate-700'} ${isInactive ? 'line-through' : ''}`}>
               {node.nama_akun}
            </span>
            {isInactive && <span className="ml-2 text-[10px] font-semibold bg-red-100 text-red-500 border border-red-200 px-1.5 py-0.5 rounded">Non-Aktif</span>}
          </td>
          <td className={`p-4 text-sm ${isInactive ? 'text-gray-400' : 'text-slate-600'}`}>{node.grup_laporan}</td>
          <td className="p-4 text-sm">
            <span className={`px-2 py-1 rounded text-xs font-medium ${isInactive ? 'bg-gray-100 text-gray-400' : isHeader ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
              {node.tipe_akun}
            </span>
          </td>
          <td className={`p-4 text-sm ${isInactive ? 'text-gray-400' : 'text-slate-600'}`}>{node.saldo_normal}</td>
          <td className="p-4 text-center">
             <div className="flex justify-center items-center">
                <div className="relative">
                  <button 
                    onClick={() => setOpenMenuId(openMenuId === node.id ? null : node.id)}
                    className="w-8 h-8 rounded-full flex justify-center items-center hover:bg-slate-200 text-slate-500 transition-colors"
                  >
                    <span className="material-icons-round text-[20px]">more_vert</span>
                  </button>

                  {openMenuId === node.id && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50">
                      
                      {isHeader && (
                        <>
                          <button onClick={() => { setOpenMenuId(null); handleOpenDrawer(node); }} className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-indigo-700 text-sm flex items-center gap-2 font-medium">
                            <span className="material-icons-round text-[18px] text-indigo-500">add</span>Tambah Sub-Akun
                          </button>
                          <div className="w-full h-px bg-slate-100 my-1"></div>
                        </>
                      )}

                      <button onClick={() => { setOpenMenuId(null); handleEditDrawer(node); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                        <span className="material-icons-round text-[18px] text-slate-400">edit</span>Edit Akun
                      </button>

                      <button onClick={() => { setOpenMenuId(null); handleToggleActive(node); }} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${node.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                        <span className={`material-icons-round text-[18px] ${node.is_active ? 'text-red-400' : 'text-green-400'}`}>{node.is_active ? 'block' : 'check_circle'}</span>
                        {node.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                      </button>
                    </div>
                  )}
                </div>
             </div>
          </td>
        </tr>
      );

      if (isExpanded && hasChildren) {
        rows = rows.concat(renderTreeRows(node.children!, depth + 1));
      }
    });
    return rows;
  };

  // Compute logic for locking fields
  const isParentSelected = formData.induk_akun_id !== '';
  
  // Check if the current account has any children
  const hasChildren = useMemo(() => {
    if (!isEditMode) return false;
    return coaList.some(coa => coa.induk_akun_id === formData.id);
  }, [coaList, formData.id, isEditMode]);

  // React to parent change
  useEffect(() => {
    if (formData.induk_akun_id) {
      const parent = coaList.find(p => p.id.toString() === formData.induk_akun_id);
      if (parent) {
        setFormData(prev => ({
          ...prev,
          grup_laporan: parent.grup_laporan,
          saldo_normal: parent.saldo_normal
        }));
      }
    }
  }, [formData.induk_akun_id, coaList]);

  const headerOptions = coaList.filter(a => a.tipe_akun === 'Header' && a.is_active);

  return (
    <div className="w-full flex flex-col gap-6 relative overflow-hidden">
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        onClose={() => setSubmitState({ status: 'idle', message: '' })} 
      />

      <AlertModal 
        isOpen={confirmModal.isOpen}
        title={
          confirmModal.item?.is_active && confirmModal.item?.tipe_akun === 'Header' && confirmModal.item?.children && confirmModal.item?.children.length > 0 
            ? "Peringatan: Menonaktifkan Akun Header" 
            : "Konfirmasi Perubahan Status"
        }
        message={
          confirmModal.item?.is_active && confirmModal.item?.tipe_akun === 'Header' && confirmModal.item?.children && confirmModal.item?.children.length > 0 ? (
            <>
              Akun ini memiliki <b>{confirmModal.item?.children?.length}</b> sub-akun di bawahnya. 
              <br/><br/>
              Jika Anda menonaktifkan akun ini, seluruh sub-akun juga akan otomatis dinonaktifkan dan tidak bisa lagi digunakan dalam penjurnalan. Apakah Anda yakin?
            </>
          ) : (
            `Apakah Anda yakin ingin ${confirmModal.item?.is_active ? 'menonaktifkan' : 'mengaktifkan'} akun ${confirmModal.item?.kode_akun} - ${confirmModal.item?.nama_akun}?`
          )
        }
        confirmText={confirmModal.item?.is_active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
        cancelText="Batal"
        onConfirm={() => confirmModal.item && executeToggleActive(confirmModal.item)}
        onCancel={() => setConfirmModal({ isOpen: false, item: null })}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Akun Perkiraan (COA)</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola bagan akun untuk transaksi buku besar dan laporan keuangan.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
            <span className="material-icons-round absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
            <input 
              type="text" 
              placeholder="Cari akun..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
          <button 
            onClick={() => handleOpenDrawer()}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shrink-0"
          >
            <span className="material-icons-round text-[18px]">add</span>
            Tambah Akun
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm relative z-0 flex flex-col h-[calc(100vh-200px)]">
        <div className="w-full overflow-auto flex-1 pb-32">
          <table className="w-full text-left border-collapse min-w-[800px] relative">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-sm">
              <tr>
                <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">Kode Akun</th>
                <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">Nama Akun</th>
                <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">Grup Laporan</th>
                <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">Tipe</th>
                <th className="p-4 font-semibold text-slate-600 text-sm whitespace-nowrap">Saldo Normal</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-center w-32 whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {treeData.length > 0 ? (
                renderTreeRows(treeData)
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    {searchQuery ? 'Akun tidak ditemukan' : 'Belum ada data COA'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Drawer */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          ></div>
          
          {/* Drawer Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 translate-x-0">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{isEditMode ? 'Edit Akun' : 'Tambah Akun Baru'}</h2>
                <p className="text-xs text-slate-500 mt-1">Isi formulir dengan teliti sesuai kaidah akuntansi.</p>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white shadow-sm p-1.5 rounded-full border border-slate-200">
                <span className="material-icons-round text-[20px]">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex gap-2 items-start">
                    <span className="material-icons-round text-[18px]">error_outline</span>
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* 1. Tipe Akun (Paling atas sesuai instruksi UX) */}
                <div className="flex flex-col gap-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <label className="text-sm font-bold text-indigo-900">1. Tipe Akun <span className="text-red-500">*</span></label>
                  <p className="text-xs text-indigo-700/70 mb-1">Menentukan apakah akun ini grup/folder atau tempat transaksi.</p>
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="tipe_akun" value="Header" checked={formData.tipe_akun === 'Header'} onChange={(e) => setFormData({...formData, tipe_akun: e.target.value})} className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm text-slate-800 font-semibold">Header (Grup/Folder)</span>
                    </label>
                    <label className={`flex items-center gap-2 ${hasChildren ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input type="radio" name="tipe_akun" value="Detail" checked={formData.tipe_akun === 'Detail'} onChange={(e) => setFormData({...formData, tipe_akun: e.target.value})} className="w-4 h-4 text-indigo-600" disabled={hasChildren} />
                      <span className="text-sm text-slate-800 font-semibold">Detail (Akun Transaksi)</span>
                    </label>
                  </div>
                  {hasChildren && <p className="text-xs text-amber-600 mt-2 font-medium bg-amber-50 p-1.5 rounded">ⓘ Akun ini tidak dapat diubah menjadi Detail karena memiliki sub-akun (anak).</p>}
                </div>

                {/* 2. Akun Induk */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700">2. Induk Akun (Parent)</label>
                  <select 
                    value={formData.induk_akun_id}
                    onChange={(e) => setFormData({...formData, induk_akun_id: e.target.value})}
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm shadow-sm"
                  >
                    <option value="">-- Tidak Ada (Root) --</option>
                    {headerOptions.filter(opt => opt.id !== formData.id).map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.kode_akun} - {opt.nama_akun}</option>
                    ))}
                  </select>
                </div>

                {/* 3 & 4. Kode dan Nama */}
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-700">3. Kode Akun <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={formData.kode_akun}
                      onChange={(e) => setFormData({...formData, kode_akun: e.target.value})}
                      className="w-full h-11 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono shadow-sm"
                      placeholder="Misal: 110001"
                    />
                    {formData.induk_akun_id && (
                       <p className="text-xs text-slate-500">
                         ⓘ Saran kode berawalan: <span className="font-mono font-semibold bg-slate-100 px-1 py-0.5 rounded">{coaList.find(a => a.id.toString() === formData.induk_akun_id)?.kode_akun}</span>
                       </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-700">4. Nama Akun <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={formData.nama_akun}
                      onChange={(e) => setFormData({...formData, nama_akun: e.target.value})}
                      className="w-full h-11 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm"
                      placeholder="Misal: Kas Satelit Elim"
                    />
                  </div>
                </div>

                {/* 5 & 6. Grup & Saldo (Auto-locked if parent selected) */}
                <div className={`grid grid-cols-2 gap-4 p-4 rounded-xl border ${isParentSelected ? 'bg-slate-100 border-slate-200 border-dashed' : 'border-slate-200'}`}>
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-semibold text-slate-700">Grup Laporan</label>
                    <div className="flex flex-col gap-3">
                      <label className={`flex items-center gap-2 ${isParentSelected ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="radio" name="grup_laporan" value="Neraca" checked={formData.grup_laporan === 'Neraca'} onChange={(e) => setFormData({...formData, grup_laporan: e.target.value})} className="w-4 h-4 text-indigo-600" disabled={isParentSelected} />
                        <span className="text-sm text-slate-700">Neraca</span>
                      </label>
                      <label className={`flex items-center gap-2 ${isParentSelected ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="radio" name="grup_laporan" value="Laba Rugi" checked={formData.grup_laporan === 'Laba Rugi'} onChange={(e) => setFormData({...formData, grup_laporan: e.target.value})} className="w-4 h-4 text-indigo-600" disabled={isParentSelected} />
                        <span className="text-sm text-slate-700">Laba Rugi</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-semibold text-slate-700">Saldo Normal</label>
                    <div className="flex flex-col gap-3">
                      <label className={`flex items-center gap-2 ${isParentSelected ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="radio" name="saldo_normal" value="Debit" checked={formData.saldo_normal === 'Debit'} onChange={(e) => setFormData({...formData, saldo_normal: e.target.value})} className="w-4 h-4 text-indigo-600" disabled={isParentSelected} />
                        <span className="text-sm text-slate-700">Debit</span>
                      </label>
                      <label className={`flex items-center gap-2 ${isParentSelected ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="radio" name="saldo_normal" value="Kredit" checked={formData.saldo_normal === 'Kredit'} onChange={(e) => setFormData({...formData, saldo_normal: e.target.value})} className="w-4 h-4 text-indigo-600" disabled={isParentSelected} />
                        <span className="text-sm text-slate-700">Kredit</span>
                      </label>
                    </div>
                  </div>
                  
                  {isParentSelected && (
                    <div className="col-span-2 mt-2 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                       <span className="material-icons-round text-[16px]">lock</span>
                       <span>Grup Laporan & Saldo Normal otomatis dikunci mengikuti Induk Akun untuk menjaga validitas hierarki.</span>
                    </div>
                  )}
                </div>

                {/* Status Aktif */}
                {isEditMode && (
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl mt-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Status Akun</h4>
                      <p className="text-xs text-slate-500">Non-aktifkan jika akun tidak dipakai lagi.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({...formData, is_active: e.target.checked})} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                )}

              </div>
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)] flex-shrink-0">
                <button type="button" onClick={() => setIsDrawerOpen(false)} className="px-5 py-2.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-sm">Batal</button>
                <button type="submit" className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-sm transition-colors text-sm flex items-center gap-2">
                  <span className="material-icons-round text-[18px]">save</span>
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
