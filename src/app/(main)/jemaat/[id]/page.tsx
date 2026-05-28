'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { buildGraph } from '@/app/(main)/family-tree/FlowCanvas';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

const FlowCanvas = dynamic(() => import('@/app/(main)/family-tree/FlowCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  ),
});

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

export default function EditJemaatPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const jemaatId = typeof params.id === 'string' ? params.id : '';
  const isReadOnly = searchParams.get('mode') === 'view';
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'data_jemaat' | 'family_tree'>(
    searchParams.get('tab') === 'family_tree' ? 'family_tree' : 'data_jemaat'
  );

  // Family tree state
  const [treeNodes, setTreeNodes]     = useState<any[]>([]);
  const [treeEdges, setTreeEdges]     = useState<any[]>([]);
  const [treeBranches, setTreeBranches] = useState<any[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError]     = useState('');
  const [treeKey, setTreeKey]         = useState(0);

  // User Auth State
  const [userData, setUserData] = useState<any>(null);
  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };
  
  // Options State
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
  const [pekerjaanOptions, setPekerjaanOptions] = useState<any[]>([]);

  // Form State mapped to exact Schema
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    jenis_kelamin: 'Laki-laki',
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
    pekerjaan_id: '',
    departemen_ids: [] as string[],
    
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
    anak: [] as { anak_jemaat_id: string, anak_jemaat_id_text?: string, nama_anak: string, gereja_asal_anak: string }[],
    ayah_jemaat_id: '',
    ibu_jemaat_id: '',
    pasangan_jemaat_id: '',
    jemaat_id: '',
    // Saudara
    saudara: [] as { saudara_jemaat_id: string, saudara_jemaat_kode?: string, nama_saudara: string, gereja_asal_saudara: string }[],
  });

  const [inputPekerjaanManual, setInputPekerjaanManual] = useState(false);

  useEffect(() => {
    const fetchInitData = async () => {
      setIsLoadingData(true);
      try {
        const [resSatelit, resKomisi, resDepartemen, resPekerjaan] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=komisi'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=pekerjaan')
        ]);
        const satelitData = await resSatelit.json();
        const komisiData = await resKomisi.json();
        const deptData = await resDepartemen.json();
        const pekrData = await resPekerjaan.json();

        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (komisiData.success) setKomisiOptions(komisiData.data);
        if (deptData.success) setDepartemenOptions(deptData.data);
        if (pekrData.success) setPekerjaanOptions(pekrData.data);

        // Fetch User Data for Permissions
        try {
          const resUser = await fetch('/api/auth/me');
          if (resUser.ok) {
            const authData = await resUser.json();
            setUserData(authData);
            
            // Force read-only mode if user doesn't have edit permission
            const canEdit = authData?.is_super_admin || authData?.permissions?.includes('jemaat_edit');
            if (!canEdit && searchParams.get('mode') === 'edit') {
              router.replace(`/jemaat/${jemaatId}?mode=view`);
            }
          }
        } catch (e) {
          console.error('Failed to fetch user permissions', e);
        }

        // Fetch Detail Data
        if (jemaatId) {
          const detailRes = await fetch(`/api/members/${jemaatId}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (detailData.success) {
              const d = detailData.data;
              setFormData({
                nama_lengkap: d.nama_lengkap || '',
                jenis_kelamin: d.jenis_kelamin || 'Laki-laki',
                tempat_lahir: d.tempat_lahir || '',
                tanggal_lahir: d.tanggal_lahir ? new Date(d.tanggal_lahir).toISOString().split('T')[0] : '',
                alamat: d.alamat || '',
                kota: d.kota || 'Surabaya',
                kecamatan: d.kecamatan || '',
                kelurahan: d.kelurahan || '',
                kode_pos: d.kode_pos || '',
                no_hp: d.no_hp || '',
                email: d.email || '',
                pekerjaan: d.pekerjaan || '',
                pekerjaan_id: d.pekerjaan_id ? d.pekerjaan_id.toString() : '',
                satelit_id: d.satelit_id ? d.satelit_id.toString() : '',
                komisi_ids: d.komisi_ids || [],
                departemen_ids: d.departemen_ids || [],
                status_baptis: d.status_baptis ? 'Sudah' : 'Belum',
                tanggal_baptis: d.tanggal_baptis ? new Date(d.tanggal_baptis).toISOString().split('T')[0] : '',
                status_pernikahan: d.status_pernikahan || 'Lajang',
                status_jemaat: d.status_jemaat || 'Aktif',
                foto_url: d.foto_url || '',
                
                // Family
                ayah_id: d.ayah_id ? d.ayah_id.toString() : '',
                ayah_jemaat_id: d.ayah_jemaat_id || '',
                ayah_nama: d.ayah_nama || '',
                gereja_asal_ayah: d.gereja_asal_ayah || '',
                ibu_id: d.ibu_id ? d.ibu_id.toString() : '',
                ibu_jemaat_id: d.ibu_jemaat_id || '',
                ibu_nama: d.ibu_nama || '',
                gereja_asal_ibu: d.gereja_asal_ibu || '',
                pasangan_id: d.pasangan_id ? d.pasangan_id.toString() : '',
                pasangan_jemaat_id: d.pasangan_jemaat_id || '',
                pasangan_nama: d.pasangan_nama || '',
                gereja_asal_pasangan: d.gereja_asal_pasangan || '',
                anak: d.anak || [],
                jemaat_id: d.jemaat_id || '',
                saudara: (d.saudara || []).map((s: any) => ({
                  saudara_jemaat_id:    s.saudara_jemaat_id || '',
                  saudara_jemaat_kode:  s.saudara_jemaat_kode || '',
                  nama_saudara:         s.nama_saudara || '',
                  gereja_asal_saudara:  '',
                })),
              });
              
              if (d.pekerjaan && !d.pekerjaan_id) {
                setInputPekerjaanManual(true);
              }

              if (d.foto_url) {
                setImagePreview(d.foto_url);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchInitData();
  }, [jemaatId]);

  // Load family tree when switching to family_tree tab
  useEffect(() => {
    if (activeTab !== 'family_tree' || !jemaatId || treeNodes.length > 0) return;
    const loadTree = async () => {
      setTreeLoading(true);
      setTreeError('');
      try {
        const res = await fetch(`/api/family-tree/${jemaatId}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        const { nodes, edges, branches } = buildGraph(json.data);
        setTreeNodes(nodes);
        setTreeEdges(edges);
        setTreeBranches(branches);
        setTreeKey(k => k + 1);
      } catch (e: any) {
        setTreeError(e.message || 'Gagal memuat pohon keluarga');
      } finally {
        setTreeLoading(false);
      }
    };
    loadTree();
  }, [activeTab, jemaatId]);

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
      setFormData(prev => ({ ...prev, pekerjaan_id: val, pekerjaan: '' }));
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
    // Validasi frontend (hanya untuk mode edit)
    if (!isReadOnly) {
      if (!formData.tanggal_lahir) {
        setSubmitState({ status: 'error', message: 'Tanggal lahir wajib diisi.' });
        return;
      }
      if (!formData.no_hp && !formData.email) {
        setSubmitState({ status: 'error', message: 'Harap isi minimal No. Telepon atau Alamat Email.' });
        return;
      }
    }
    try {
      setIsSubmitting(true);
      setSubmitState({ status: 'loading', message: '' });
      
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
           setSubmitState({ status: 'error', message: 'Gagal mengupload foto: ' + uploadJson.message });
           setIsSubmitting(false);
           return;
        }
      }

      const payload = { ...formData, foto_url: finalFotoUrl || null };

      const res = await fetch(`/api/members/${jemaatId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Data jemaat berhasil diupdate!' });
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal menyimpan data', errors: data.errors });
      }
    } catch(err) {
      console.error(err);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan pada server saat menyimpan data.' });
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
            <Link href="/jemaat" className="text-slate-500 hover:text-blue-600">Jemaat</Link>
            <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
            <span className="text-slate-700 font-bold">{isReadOnly ? 'Detail Jemaat' : 'Edit Jemaat'}</span>
          </div>
          <div className="self-stretch inline-flex justify-between items-end">
            <div className="inline-flex flex-col justify-start items-start">
              <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">{isReadOnly ? 'Detail Data Jemaat' : 'Edit Data Jemaat'}</h1>
              <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 flex gap-1">
                <span>Jemaat ID:</span>
                <span className="text-slate-700 font-bold">{formData.jemaat_id || '-'}</span>
              </div>
            </div>
          </div>
        </div>

      {/* Tabs */}
      <div className="w-full border-b border-slate-200 inline-flex justify-start items-start gap-8">
          <div 
            onClick={() => setActiveTab('data_jemaat')}
            className={`px-2 py-3 border-b-2 inline-flex flex-col justify-center items-center cursor-pointer transition-colors ${activeTab === 'data_jemaat' ? 'border-slate-700' : 'border-transparent'}`}
          >
            <span className={`text-sm font-bold font-['Inter'] leading-5 ${activeTab === 'data_jemaat' ? 'text-slate-700' : 'text-slate-400'}`}>Data Jemaat</span>
          </div>
          <div 
            onClick={() => setActiveTab('family_tree')}
            className={`px-2 py-3 border-b-2 inline-flex flex-col justify-center items-center cursor-pointer transition-colors ${activeTab === 'family_tree' ? 'border-slate-700' : 'border-transparent'}`}
          >
            <span className={`text-sm font-bold font-['Inter'] leading-5 ${activeTab === 'family_tree' ? 'text-slate-700' : 'text-slate-400'}`}>Family Tree</span>
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
                {!isReadOnly && (
                <label className="w-8 h-8 absolute right-[-10px] bottom-[-10px] bg-slate-700 rounded-full border-2 border-white cursor-pointer inline-flex justify-center items-center hover:bg-slate-800 transition-colors shadow-lg z-10">
                  <span className="material-icons-round text-white text-[16px]">add_a_photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                )}
              </div>
              <div className="inline-flex flex-col justify-start items-start w-full">
                <input 
                  type="text"
                  name="nama_lengkap"
                  value={formData.nama_lengkap}
                  onChange={handleInputChange}
                  disabled={isReadOnly}
                  placeholder="Ketik nama lengkap di sini..."
                  className="w-full bg-transparent focus:outline-none focus:border-blue-500 border-b border-transparent text-slate-900 text-2xl font-bold font-['Inter'] leading-8 mb-1 disabled:bg-transparent" 
                />
                <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 mb-3">
                  {isReadOnly ? 'Arsip detail informasi registrasi jemaat.' : 'Silakan perbarui data jemaat yang relevan.'}
                </div>
                <div className="self-stretch pt-2 inline-flex justify-start items-start gap-2">
                    <div className="px-3 py-1 bg-slate-100 rounded-full inline-flex flex-col justify-start items-start">
                        <div className="text-slate-700 text-[10px] font-bold font-['Inter'] uppercase leading-4 tracking-wide">{isReadOnly ? 'Mode Lihat Data' : 'Mode Edit Data'}</div>
                    </div>
                </div>
              </div>
            </div>

            {/* Family Tree Tab Content */}
            {activeTab === 'family_tree' && (
              <div className="w-full flex flex-col gap-3">
                {/* Legend */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { color: '#14b8a6', label: 'Pusat' },
                    { color: '#f43f8e', label: 'Pasangan' },
                    { color: '#3b82f6', label: 'Ayah / Kakek' },
                    { color: '#ec4899', label: 'Ibu / Nenek' },
                    { color: '#8b5cf6', label: 'Anak' },
                    { color: '#f59e0b', label: 'Saudara' },
                  ].map(l => (
                    <span key={l.label} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                      <span style={{ background: l.color }} className="w-2 h-2 rounded-full inline-block" />
                      {l.label}
                    </span>
                  ))}
                </div>

                {/* Canvas */}
                <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" style={{ height: 520 }}>
                  {treeLoading && (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full" />
                        <span className="text-slate-400 text-sm">Memuat pohon keluarga...</span>
                      </div>
                    </div>
                  )}
                  {treeError && !treeLoading && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-8">
                        <span className="material-icons-round text-red-400 text-4xl">error_outline</span>
                        <p className="text-red-600 text-sm font-semibold mt-2">{treeError}</p>
                      </div>
                    </div>
                  )}
                  {!treeLoading && !treeError && treeNodes.length > 0 && (
                    <FlowCanvas
                      key={treeKey}
                      nodes={treeNodes}
                      edges={treeEdges}
                      branches={treeBranches}
                      onNodeClick={(id) => router.push(`/jemaat/${id}?mode=view&tab=family_tree`)}
                    />
                  )}
                  {!treeLoading && !treeError && treeNodes.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                      <span className="material-icons-round text-slate-300 text-5xl">account_tree</span>
                      <p className="text-slate-400 text-sm">Data keluarga belum tersedia</p>
                    </div>
                  )}
                </div>

                {/* Open full page link */}
                <div className="flex justify-end">
                  <a
                    href={`/family-tree?id=${jemaatId}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-teal-600 hover:text-teal-700 text-xs font-semibold"
                  >
                    <span className="material-icons-round text-base">open_in_new</span>
                    Buka di halaman penuh
                  </a>
                </div>
              </div>
            )}

      {/* Grid Form Sections (Data Jemaat Tab) */}
      <div className={activeTab === 'data_jemaat' ? 'block w-full' : 'hidden'}>

            {/* Grid Form Sections */}
            {isLoadingData ? (
              <div className="w-full py-20 flex justify-center items-center">
                <span className="material-icons-round animate-spin text-4xl text-slate-400">sync</span>
              </div>
            ) : (
            <fieldset disabled={isReadOnly} className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start opacity-100 disabled:opacity-95">
              
              {/* KOLOM KIRI */}
              <div className="flex flex-col gap-8">
                {/* Informasi Personal */}
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6">
                  <div className="w-full inline-flex justify-start items-center gap-2">
                    <span className="material-icons-round text-slate-700 text-[18px]">badge</span>
                    <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Informasi Personal</span>
                  </div>
                  
                  <div className="w-full flex-col gap-4 flex">
                    <div className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Jenis Kelamin</label>
                      <select name="jenis_kelamin" value={formData.jenis_kelamin} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all">
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    
                    <div className="w-full flex gap-4">
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kota Lahir</label>
                        <input type="text" name="tempat_lahir" value={formData.tempat_lahir} onChange={handleInputChange} placeholder="" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tanggal Lahir {!isReadOnly && <span className="text-red-500">*</span>}</label>
                        <input type="date" name="tanggal_lahir" value={formData.tanggal_lahir} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    </div>
                    
                    <div className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Pekerjaan</label>
                      {isReadOnly ? (
                        <div className="text-slate-900 text-sm font-semibold">{formData.pekerjaan || pekerjaanOptions.find(p => p.id.toString() === formData.pekerjaan_id)?.nama_pekerjaan || '-'}</div>
                      ) : (
                        <>
                          <select name="pekerjaan_id" value={formData.pekerjaan_id || (inputPekerjaanManual ? 'Other' : '')} onChange={handlePekerjaanChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all">
                            <option value="">-- Pilih Pekerjaan --</option>
                            {pekerjaanOptions.map((p) => (
                               <option key={p.id} value={p.id}>{p.nama_pekerjaan}</option>
                            ))}
                            <option value="Other">Lainnya (Ketik Manual)</option>
                          </select>
                          {inputPekerjaanManual && (
                             <input type="text" name="pekerjaan" value={formData.pekerjaan || ''} onChange={handleInputChange} placeholder="Ketik profesi/pekerjaan (Opsional)" className="mt-2 px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                          )}
                        </>
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
                    {!isReadOnly && (
                      <button type="button" onClick={handleAddAnak} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg flex items-center gap-1 transition-colors text-xs font-bold">
                        <span className="material-icons-round text-[16px]">add</span> Tambah Anak
                      </button>
                    )}
                  </div>
                  
                  {formData.anak.map((ank, idx) => (
                    <div key={idx} className={`w-full rounded-xl border p-4 flex flex-col gap-3 ${isReadOnly ? 'bg-slate-50 border-slate-100' : 'bg-slate-50 border-slate-100'}`}>
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Anak ke-{idx + 1}</span>
                        {!isReadOnly && (
                          <button type="button" onClick={() => handleRemoveAnak(idx)}
                            className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors">
                            <span className="material-icons-round" style={{fontSize: 14}}>close</span>
                          </button>
                        )}
                      </div>
                      {isReadOnly ? (
                        <div className="w-full flex flex-col gap-1">
                          <div className="text-slate-900 text-sm font-semibold">{ank.nama_anak || '-'}</div>
                          {!ank.anak_jemaat_id && ank.gereja_asal_anak && (
                            <div className="text-slate-500 text-xs">Gereja: {ank.gereja_asal_anak}</div>
                          )}
                          {ank.anak_jemaat_id_text && (
                            <div className="text-slate-400 text-xs">ID: {ank.anak_jemaat_id_text}</div>
                          )}
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  ))}
                  
                  {formData.anak.length === 0 && (
                    <div className="w-full py-4 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <span className="material-icons-round text-3xl opacity-50">child_care</span>
                      <span className="text-xs font-['Inter']">{isReadOnly ? "Belum merekam data anak." : "Belum ada data anak. Klik '+ Tambah Anak'."}</span>
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
                    {!isReadOnly && (
                      <button type="button" onClick={handleAddSaudara} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg flex items-center gap-1 transition-colors text-xs font-bold">
                        <span className="material-icons-round text-[16px]">add</span> Tambah Saudara
                      </button>
                    )}
                  </div>

                  {formData.saudara.map((sd, idx) => (
                    <div key={idx} className="w-full bg-amber-50/50 rounded-xl border border-amber-100 p-4 flex flex-col gap-3">
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">Saudara ke-{idx + 1}</span>
                        {!isReadOnly && (
                          <button type="button" onClick={() => handleRemoveSaudara(idx)}
                            className="w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors">
                            <span className="material-icons-round" style={{fontSize: 14}}>close</span>
                          </button>
                        )}
                      </div>
                      {isReadOnly ? (
                        <div className="w-full flex flex-col gap-1">
                          <div className="text-slate-900 text-sm font-semibold">{sd.nama_saudara || '-'}</div>
                          {sd.saudara_jemaat_kode && (
                            <div className="text-slate-500 text-xs">ID Jemaat: {sd.saudara_jemaat_kode}</div>
                          )}
                        </div>
                      ) : (
                        <>
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
                                value={sd.gereja_asal_saudara || ''}
                                onChange={(e) => handleSaudaraChange(idx, 'gereja_asal_saudara', e.target.value)}
                                placeholder="Isi jika dari gereja luar"
                                className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300/30 focus:border-amber-400 text-slate-900 text-sm font-['Inter'] w-full transition-all"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  {formData.saudara.length === 0 && (
                    <div className="w-full py-4 text-center text-slate-400 flex flex-col items-center gap-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <span className="material-icons-round text-3xl opacity-50">people_outline</span>
                      <span className="text-xs font-['Inter']">{isReadOnly ? "Belum merekam data saudara." : "Belum ada data saudara. Klik '+ Tambah Saudara'."}</span>
                    </div>
                  )}
                </div>

              </div> {/* END KOLOM KIRI */}

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
                        <input type="text" name="kecamatan" value={formData.kecamatan} onChange={handleInputChange} placeholder="" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kelurahan</label>
                        <input type="text" name="kelurahan" value={formData.kelurahan} onChange={handleInputChange} placeholder="" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    </div>

                    <div className="w-full flex gap-4">
                      <div className="flex-[2] flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kota</label>
                        <input type="text" name="kota" value={formData.kota} onChange={handleInputChange} placeholder="" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                      <div className="flex-1 flex-col gap-1 flex">
                        <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kode Pos</label>
                        <input type="text" name="kode_pos" value={formData.kode_pos} onChange={handleInputChange} placeholder="" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                      </div>
                    </div>
                    
                    {isReadOnly ? (
                      <div className="w-full flex gap-4">
                        <div className="flex-1 flex-col gap-1 flex">
                          <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">No Telepon / WA</label>
                          <div className="text-slate-900 text-sm font-semibold">{formData.no_hp || '-'}</div>
                        </div>
                        <div className="flex-1 flex-col gap-1 flex">
                          <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Alamat Email</label>
                          <div className="text-slate-900 text-sm font-semibold">{formData.email || '-'}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-blue-700 text-xs font-semibold font-['Inter'] mb-2">Kontak <span className="text-red-500">*</span> — Isi minimal salah satu</p>
                        <div className="w-full flex gap-4">
                          <div className="flex-1 flex-col gap-1 flex">
                            <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">No Telepon / WA</label>
                            <div className="relative w-full">
                              <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold font-['Inter']">+62</span>
                              <input type="text" name="no_hp" value={formData.no_hp} onChange={handleInputChange} placeholder="" className="pl-12 pr-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                            </div>
                          </div>
                          <div className="flex-1 flex-col gap-1 flex">
                            <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Alamat Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="" className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" />
                          </div>
                        </div>
                      </div>
                    )}
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
                      <select name="satelit_id" value={formData.satelit_id} onChange={handleInputChange} className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all">
                        <option value="">-- Pilih Satelit Utama --</option>
                        {satelitOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4 mb-2">Nama Komisi (Bisa Pilih Lebih dari 1)</label>
                      <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-slate-200">
                        {isReadOnly ? (
                          komisiOptions
                            .filter((k) => formData.komisi_ids.includes(k.id.toString()))
                            .map(k => (
                              <div key={k.id} className="text-slate-900 text-sm font-semibold flex items-center gap-2">
                                <span className="material-icons-round text-blue-500 text-[16px]">check_circle</span>
                                {k.nama_komisi}
                              </div>
                            ))
                        ) : (
                          <>
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
                          </>
                        )}
                        {isReadOnly && formData.komisi_ids.length === 0 && (
                           <span className="text-sm text-slate-400 italic">- Tidak Mengikuti Komisi -</span>
                        )}
                      </div>
                    </div>

                    <div className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4 mb-2">Nama Departemen (Bisa Pilih Lebih dari 1)</label>
                      <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-slate-200">
                        {isReadOnly ? (
                          departemenOptions
                            .filter((d) => formData.departemen_ids.includes(d.id.toString()))
                            .map(d => (
                              <div key={d.id} className="text-slate-900 text-sm font-semibold flex items-center gap-2">
                                <span className="material-icons-round text-purple-500 text-[16px]">check_circle</span>
                                {d.nama_departemen}
                              </div>
                            ))
                        ) : (
                          departemenOptions.length === 0 ? (
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
                          )
                        )}
                        {isReadOnly && formData.departemen_ids.length === 0 && (
                           <span className="text-sm text-slate-400 italic">- Tidak Mengikuti Departemen -</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </fieldset>
            )}
            
            {/* Actions */}
            <div className="w-full inline-flex justify-end items-center gap-4 mt-8">
              {isReadOnly ? (
                <>
                  <Link href="/jemaat" className="px-8 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex flex-col justify-center items-center transition-colors">
                    <span className="text-slate-700 text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Kembali</span>
                  </Link>
                  {hasPermission('jemaat_edit') && (
                    <Link href={`/jemaat/${jemaatId}?mode=edit`} className="px-10 py-2.5 bg-slate-700 hover:bg-slate-800 rounded-lg flex justify-start items-center gap-2 transition-all shadow-lg">
                      <span className="material-icons-round text-white text-[20px]">edit</span>
                      <span className="text-white text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Edit Data</span>
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link href={`/jemaat/${jemaatId}?mode=view`} className="px-8 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex flex-col justify-center items-center transition-colors">
                    <span className="text-slate-700 text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Batal</span>
                  </Link>
                  <button 
                    onClick={handleCreate} 
                    className={`px-10 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg flex justify-start items-center gap-2 transition-all shadow-lg ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}
                  >
                    {isSubmitting ? (
                      <span className="material-icons-round text-white animate-spin text-[20px]">sync</span>
                    ) : (
                      <span className="material-icons-round text-white text-[20px]">save</span>
                    )}
                    <span className="text-white text-sm font-bold font-['Inter'] uppercase leading-5 tracking-wide">Simpan Edit</span>
                  </button>
                </>
              )}
          </div>
        </div>
      </div>
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        errors={submitState.errors} 
        onClose={() => {
          if (submitState.status === 'success') {
            router.push(`/jemaat/${jemaatId}?mode=view`);
            setSubmitState({ status: 'idle', message: '' });
          } else {
            setSubmitState({ status: 'idle', message: '' });
          }
        }} 
      />
    </div>
  );
}
