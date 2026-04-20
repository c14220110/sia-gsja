'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Helper component for Async Search (Server-side search)
const AsyncAutocomplete = ({ 
  label, 
  onSelect,
  placeholder = "Ketik minimal 3 huruf...",
  optionType,
  extraQuery = ""
}: { 
  label: string, 
  onSelect: (id: string, name: string) => void,
  placeholder?: string,
  optionType?: string,
  extraQuery?: string
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchResults = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/options?type=${optionType || 'jemaat_search'}&q=${encodeURIComponent(searchTerm)}${extraQuery}`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setResults(data.data);
        setIsOpen(true);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      fetchResults(val);
    }, 400); // Debounce
  };

  return (
    <div className="w-full flex-col gap-1 flex relative" ref={wrapperRef}>
      <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase leading-4">{label}</label>
      <div className="relative">
        <input 
          type="text" 
          value={query} 
          onChange={handleInputChange}
          placeholder={placeholder} 
          className="px-4 py-3 pr-10 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-['Inter'] w-full transition-all" 
        />
        {isLoading && (
          <div className="absolute right-3 top-3 w-4 h-4 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin"></div>
        )}
      </div>
      
      {isOpen && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-xl max-h-56 overflow-y-auto">
          {results.map((r, i) => (
            <div 
              key={i} 
              className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3"
              onClick={() => {
                onSelect(r.id.toString(), r.nama_lengkap);
                setQuery(r.nama_lengkap);
                setIsOpen(false);
              }}
            >
              {r.foto_url ? (
                <img src={r.foto_url} alt={r.nama_lengkap} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
                   {r.nama_lengkap.charAt(0)}
                </div>
              )}
              <div className="flex flex-col">
                 <div className="text-sm font-bold text-slate-900">{r.nama_lengkap}</div>
                 <div className="text-[10px] text-slate-500">{r.jemaat_id} - {r.nama_satelit || 'Gereja'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Smart picker: shows full role-filtered list on focus (no typing needed),
// falls back to type-to-search (min 3 chars) in bypass mode
const RoleAwareSelect = ({
  roleId,
  roleName,
  bypassMode,
  onSelect,
  kegiatanId = '',
}: {
  roleId: string;
  roleName: string;
  bypassMode: boolean;
  onSelect: (id: string, name: string) => void;
  kegiatanId?: string;
}) => {
  const [query, setQuery] = useState('');
  const [allRoleMembers, setAllRoleMembers] = useState<any[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset when role or bypass changes
  useEffect(() => {
    setQuery('');
    setAllRoleMembers([]);
    setFilteredMembers([]);
    setIsOpen(false);
    setHasLoaded(false);
  }, [roleId, bypassMode]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // On focus: load all pelayan for role immediately (non-bypass mode)
  const handleFocus = async () => {
    if (bypassMode) return;
    if (hasLoaded) {
      const filtered = allRoleMembers.filter(m => !query || m.nama_lengkap.toLowerCase().includes(query.toLowerCase()));
      setFilteredMembers(filtered);
      setIsOpen(allRoleMembers.length > 0);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/options?type=pelayan_search&q=&role_id=${roleId}&kegiatan_id=${kegiatanId}`);
      const data = await res.json();
      const members = data.success ? (data.data || []) : [];
      setAllRoleMembers(members);
      setFilteredMembers(members);
      setHasLoaded(true);
      if (members.length > 0) setIsOpen(true);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (bypassMode) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        if (val.length < 3) { setFilteredMembers([]); setIsOpen(false); return; }
        setIsLoading(true);
        try {
          const res = await fetch(`/api/options?type=pelayan_search&q=${encodeURIComponent(val)}&kegiatan_id=${kegiatanId}`);
          const data = await res.json();
          const members = data.success ? (data.data || []) : [];
          setFilteredMembers(members);
          setIsOpen(members.length > 0);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
      }, 400);
    } else {
      // Client-side filter on already-loaded list
      const filtered = allRoleMembers.filter(m => m.nama_lengkap.toLowerCase().includes(val.toLowerCase()));
      setFilteredMembers(filtered);
      setIsOpen(filtered.length > 0);
    }
  };

  const placeholder = bypassMode
    ? 'Ketik minimal 3 huruf nama pelayan...'
    : hasLoaded && allRoleMembers.length === 0
      ? `Tidak ada pelayan aktif dengan role ${roleName}`
      : `Klik untuk lihat daftar ${roleName}${hasLoaded ? ` · ${allRoleMembers.length} orang` : '...'}`;

  return (
    <div className="w-full" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="px-4 py-3 pr-10 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm w-full transition-all placeholder:text-slate-400 placeholder:italic"
        />
        {isLoading ? (
          <div className="absolute right-3 top-3.5 w-4 h-4 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
        ) : (
          <span className="absolute right-3 top-3 material-icons-round text-slate-300 text-[18px]">
            {isOpen ? 'expand_less' : 'expand_more'}
          </span>
        )}
      </div>
      {hasLoaded && allRoleMembers.length === 0 && !bypassMode && !isLoading && (
        <p className="text-[11px] text-amber-600 mt-1.5 ml-1 flex items-center gap-1">
          <span className="material-icons-round text-[13px]">warning_amber</span>
          Belum ada pelayan terdaftar di posisi ini. Centang opsi di bawah untuk memilih dari semua pelayan aktif.
        </p>
      )}
      {isOpen && filteredMembers.length > 0 && (
        <div className="mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {bypassMode ? `${filteredMembers.length} Pelayan Ditemukan` : `🎯 ${filteredMembers.length} Pelayan · ${roleName}`}
            </span>
          </div>
          {filteredMembers.map((r, i) => (
            <div
              key={i}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3 transition-colors group"
              onClick={() => {
                onSelect(r.id.toString(), r.nama_lengkap);
                setQuery(r.nama_lengkap);
                setIsOpen(false);
              }}
            >
              {r.foto_url ? (
                <img src={r.foto_url} alt={r.nama_lengkap} className="w-9 h-9 rounded-full object-cover border-2 border-slate-200 flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {r.nama_lengkap.charAt(0)}
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 truncate">{r.nama_lengkap}</div>
                {r.nama_kegiatan_bentrok ? (
                  <div className="text-[10px] font-bold text-red-500 flex items-center gap-0.5">
                    <span className="material-icons-round text-[11px]">warning</span>
                    Bentrok: {r.nama_kegiatan_bentrok}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    Pelayan Aktif
                    {r.jumlah_bulan_ini > 0 && (
                      <span className={`font-bold ${r.jumlah_bulan_ini >= 8 ? 'text-red-500' : r.jumlah_bulan_ini >= 4 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        &middot; {r.jumlah_bulan_ini}x bulan ini{r.jumlah_bulan_ini >= 8 ? ' 🔥' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <span className="material-icons-round text-slate-200 group-hover:text-blue-400 text-[16px] flex-shrink-0">chevron_right</span>
            </div>
          ))}
        </div>
      )}
      {isOpen && filteredMembers.length === 0 && !isLoading && (
        <div className="mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
          <span className="material-icons-round text-slate-300 text-[32px]">search_off</span>
          <p className="text-sm text-slate-500 mt-1">Tidak ada pelayan yang cocok.</p>
        </div>
      )}
    </div>
  );
};


export default function DetailKegiatanPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const searchParamsHook = useSearchParams();

  // Tab state — primed from ?tab= URL param for deep-link support
  const [activeTab, setActiveTab] = useState<'info' | 'pelayan' | 'registrasi' | 'pasien' | 'kehadiran'>(
    (searchParamsHook.get('tab') as any) || 'info'
  );
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pelayan State
  const [pelayanList, setPelayanList] = useState<any[]>([]);
  const [isLoadingPelayan, setIsLoadingPelayan] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Registrasi State
  const [registrasiList, setRegistrasiList] = useState<any[]>([]);
  const [isLoadingRegistrasi, setIsLoadingRegistrasi] = useState(false);
  const [isModalRegistrasiOpen, setIsModalRegistrasiOpen] = useState(false);

  // Kehadiran Logs State
  const [absensiLogs, setAbsensiLogs] = useState<any[]>([]);
  const [absensiStats, setAbsensiStats] = useState<any>({ total_hadir: 0, total_jemaat: 0, total_tamu: 0, total_pelayan: 0 });
  const [isLoadingAbsensi, setIsLoadingAbsensi] = useState(false);
  const [kehadiranSearch, setKehadiranSearch] = useState('');
  const [kehadiranFilterRole, setKehadiranFilterRole] = useState('Jemaat');
  
  // Modal Form State (Pelayan)
  const [rolePelayanOptions, setRolePelayanOptions] = useState<any[]>([]);
  const [bypassRoleFilter, setBypassRoleFilter] = useState(false);
  const [formPelayan, setFormPelayan] = useState({
    pelayan_id: '',
    role_id: '',
    role_kehadiran: ''
  });

  // Roster multi-select state (untuk absensi massal)
  const [selectedRosterIds, setSelectedRosterIds] = useState<Set<number>>(new Set());
  const [isBulkMarking, setIsBulkMarking] = useState(false);
  
  // Modal Form State (Registrasi)
  const [formRegistrasi, setFormRegistrasi] = useState({
    jemaat_id: '',
    catatan_khusus: '',
    total_biaya: 0,
    metode_pembayaran: ''
  });

  // Pasien State (Specific for Pemeriksaan Kesehatan)
  const [pasienList, setPasienList] = useState<any[]>([]);
  const [isLoadingPasien, setIsLoadingPasien] = useState(false);
  const [isModalPasienOpen, setIsModalPasienOpen] = useState(false);
  const [formPasien, setFormPasien] = useState({
    is_pasien_luar: false,
    jemaat_id: '',
    nama_pasien_luar: '',
    no_hp_pasien_luar: '',
    is_pelayan_luar: false,
    pelayan_medis_id: '',
    nama_pelayan_luar: '',
    keluhan_simptom: '',
    diagnosa: '',
    tindakan_obat: '',
    tensi_darah: '',
    gula_darah: '',
    asam_urat: '',
    kolesterol: ''
  });
  const [isSavingPasien, setIsSavingPasien] = useState(false);

  const [isSavingPelayan, setIsSavingPelayan] = useState(false);
  const [isSavingRegistrasi, setIsSavingRegistrasi] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isManagerMode, setIsManagerMode] = useState(false);

  useEffect(() => {
    fetchDetail();
    fetchPelayan();
    fetchRegistrasi();
    fetchPasien();
    fetchAbsensiList();
    fetchRolePelayanOptions();
    
    if (typeof window !== 'undefined') {
       const uParams = new URLSearchParams(window.location.search);
       if (uParams.get('mode') === 'manage') {
           setIsManagerMode(true);
       }
    }
  }, [id]);

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/kegiatan/${id}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPelayan = async () => {
    setIsLoadingPelayan(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/pelayan`);
      const json = await res.json();
      if (json.success) setPelayanList(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPelayan(false);
    }
  };

  const fetchAbsensiList = async () => {
    setIsLoadingAbsensi(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/absensi?limit=all`);
      const json = await res.json();
      if (json.success) {
         setAbsensiLogs(json.data.recent_logs);
         setAbsensiStats(json.data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAbsensi(false);
    }
  };

  const fetchRegistrasi = async () => {
    setIsLoadingRegistrasi(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/registrasi`);
      const json = await res.json();
      if (json.success) setRegistrasiList(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingRegistrasi(false);
    }
  };

  const fetchPasien = async () => {
    setIsLoadingPasien(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/pasien`);
      const json = await res.json();
      if (json.success) setPasienList(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPasien(false);
    }
  };

  const fetchRolePelayanOptions = async () => {
    try {
      const res = await fetch('/api/options?type=role_pelayan');
      const json = await res.json();
      if (json.success) setRolePelayanOptions(json.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimpanPelayan = async (forceDouble = false) => {
    if (!formPelayan.pelayan_id || !formPelayan.role_kehadiran) {
      alert('Pilih pelayan dan peran/tugas terlebih dahulu!');
      return;
    }

    // Soft Warning: deteksi tugas ganda sebelum kirim ke server
    if (!forceDouble) {
      const existingRoles = pelayanList
        .filter((p: any) => p.pelayan_id?.toString() === formPelayan.pelayan_id)
        .map((p: any) => p.role_kehadiran);

      if (existingRoles.length > 0) {
        const existingRoleText = existingRoles.join(', ');
        const selectedNama = pelayanList.find((p: any) =>
          p.pelayan_id?.toString() === formPelayan.pelayan_id
        )?.nama_lengkap || 'Pelayan ini';
        const confirmed = window.confirm(
          `⚠️ Tugas Ganda Terdeteksi!\n\n` +
          `${selectedNama} sudah dijadwalkan sebagai [${existingRoleText}] di kegiatan ini.\n\n` +
          `Apakah Anda yakin ingin menambahkan tugas tambahan sebagai [${formPelayan.role_kehadiran}]?`
        );
        if (!confirmed) return;
      }
    }

    setIsSavingPelayan(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/pelayan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pelayan_id: formPelayan.pelayan_id, role_id: formPelayan.role_id, role_kehadiran: formPelayan.role_kehadiran })
      });
      const json = await res.json();
      
      if (json.success) {
        setIsModalOpen(false);
        setFormPelayan({ pelayan_id: '', role_id: '', role_kehadiran: '' });
        setBypassRoleFilter(false);
        fetchPelayan(); // refresh list
      } else {
        alert(json.message || 'Gagal menyimpan pelayan');
      }
    } catch(err) {
      console.error(err);
      alert('Terjadi kesalahan server');
    } finally {
      setIsSavingPelayan(false);
    }
  };

  const handleSimpanRegistrasi = async () => {
    if (!formRegistrasi.jemaat_id) {
      alert('Pilih jemaat yang akan didaftarkan!');
      return;
    }
    
    setIsSavingRegistrasi(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/registrasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formRegistrasi)
      });
      const json = await res.json();
      
      if (json.success) {
        setIsModalRegistrasiOpen(false);
        setFormRegistrasi({ jemaat_id: '', catatan_khusus: '', total_biaya: data?.harga_tiket_rp || 0, metode_pembayaran: '' });
        fetchRegistrasi(); // refresh list
      } else {
        alert(json.message || 'Gagal mendaftar jemaat');
      }
    } catch(err) {
      console.error(err);
      alert('Terjadi kesalahan server');
    } finally {
      setIsSavingRegistrasi(false);
    }
  };

  const handleSimpanPasien = async () => {
    if (!formPasien.is_pasien_luar && !formPasien.jemaat_id) {
      alert('Pilih jemaat (pasien) terlebih dahulu!');
      return;
    }
    if (formPasien.is_pasien_luar && !formPasien.nama_pasien_luar) {
      alert('Nama pasien luar wajib diisi!');
      return;
    }
    
    setIsSavingPasien(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/pasien`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPasien)
      });
      const json = await res.json();
      
      if (json.success) {
        setIsModalPasienOpen(false);
        setFormPasien({ is_pasien_luar: false, jemaat_id: '', nama_pasien_luar: '', no_hp_pasien_luar: '', is_pelayan_luar: false, pelayan_medis_id: '', nama_pelayan_luar: '', keluhan_simptom: '', diagnosa: '', tindakan_obat: '', tensi_darah: '', gula_darah: '', asam_urat: '', kolesterol: '' });
        fetchPasien(); // refresh list
      } else {
        alert(json.message || 'Gagal menyimpan pasien');
      }
    } catch(err) {
      console.error(err);
      alert('Terjadi kesalahan server');
    } finally {
      setIsSavingPasien(false);
    }
  };

  const handleActionRegistrasi = async (action: string, registrasi_ids: string[]) => {
    try {
      const res = await fetch(`/api/kegiatan/${id}/registrasi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, registrasi_ids })
      });
      const json = await res.json();
      if (json.success) {
        fetchRegistrasi();
      } else {
        alert(json.message || 'Gagal memproses aksi');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi saat memproses pendaftaran.');
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran maksimal file banner 10MB');
      return;
    }

    setIsUploadingBanner(true);
    try {
      const fileData = new FormData();
      fileData.append('file', file);
      fileData.append('bucket', 'poster-kegiatan');
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: fileData
      });
      const uploadJson = await uploadRes.json();
      
      if (uploadJson.success) {
        // Update URL ke database
        const patchRes = await fetch(`/api/kegiatan/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url_banner: uploadJson.url })
        });
        const patchJson = await patchRes.json();
        
        if (patchJson.success) {
          setData((prev: any) => ({ ...prev, url_banner: uploadJson.url }));
        } else {
          alert('Gagal memperbarui database dengan URL banner: ' + patchJson.message);
        }
      } else {
        alert('Gagal mengupload banner ke server: ' + uploadJson.message);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan saat mengunggah foto.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div></div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-slate-500">Kegiatan tidak ditemukan</div>;
  }

  // Format Dates
  const startDate = new Date(data.tanggal_mulai).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isEditable = ['Draft', 'Menunggu Persetujuan', 'Ditolak'].includes(data.status_kegiatan);
  const isPelayanManager = isEditable || isManagerMode;
  
  const getRoleColor = (role: string) => {
    if(role === 'WL' || role === 'Singer') return 'bg-purple-100 text-purple-700 border-purple-200';
    if(role.includes('Pemusik')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if(role === 'Usher' || role === 'Kolektan') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="w-full flex justify-center items-start pb-20">
      <div className="w-full max-w-[1200px] flex flex-col gap-6">
        
        {/* Breadcrumb */}
        <div className="w-full inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
          <span className="text-slate-500">Modul Kegiatan</span>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/kegiatan" className="text-slate-500 hover:text-blue-600">Daftar Kegiatan</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Detail Acara</span>
        </div>

        {/* Header Title Card */}
        <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-bl-full opacity-50 pointer-events-none"></div>
          
          <div className="flex justify-between items-start z-10 w-full">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase tracking-wide border border-blue-200">
                  {data.kode_kegiatan}
                </span>
                <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wide border ${
                  data.status_kegiatan === 'Draft' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                  data.status_kegiatan === 'Menunggu Persetujuan' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                  data.status_kegiatan === 'Ditolak' || data.status_kegiatan === 'Dibatalkan' ? 'bg-red-100 text-red-700 border-red-200' :
                  data.status_kegiatan === 'Akan Datang' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                  data.status_kegiatan === 'Ongoing' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                  data.status_kegiatan === 'Menunggu LPJ' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  data.status_kegiatan === 'Selesai' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {data.status_kegiatan}
                </span>
              </div>
              <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mt-1">
                {data.nama_kegiatan}
              </h1>
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mt-1">
                 <span className="material-icons-round text-[18px]">category</span> 
                 {data.nama_jenis_kegiatan} &bull; {data.frekuensi_kegiatan}
                 {data.kuota_peserta && (
                   <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-bold rounded-md ml-2 border border-amber-200 uppercase tracking-widest">
                     Maks {data.kuota_peserta}
                   </span>
                 )}
                 {Number(data.harga_tiket_rp) > 0 && (
                   <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-md ml-1 border border-emerald-200 uppercase tracking-widest flex items-center gap-1">
                     <span className="material-icons-round text-[12px]">sell</span> Rp {(Number(data.harga_tiket_rp)).toLocaleString('id-ID')}
                   </span>
                 )}
              </div>
            </div>
            
            <div className="flex gap-3">
               {isEditable && (
                 <Link href={`/kegiatan/${id}/edit`} className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 transition flex items-center gap-2 text-sm shadow-sm">
                   <span className="material-icons-round text-[18px]">edit</span> Edit Kegiatan
                 </Link>
               )}
            </div>
          </div>
          
          {/* Quick Highlight Bar */}
          <div className="w-full flex justify-between items-center px-4 md:px-12 py-5 bg-slate-50 border border-slate-100 rounded-xl mt-2 z-10 shadow-sm">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                 <span className="material-icons-round text-[22px]">calendar_today</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-0.5">Pelaksanaan</span>
                 <span className="text-[15px] font-bold text-slate-900">{startDate}</span>
               </div>
             </div>
             
             <div className="w-px h-12 bg-slate-200/80 hidden md:block"></div>

             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                 <span className="material-icons-round text-[22px]">schedule</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-0.5">Waktu</span>
                 <span className="text-[15px] font-bold text-slate-900">
                    {data.waktu_mulai.slice(0,5)} {data.waktu_selesai ? `- ${data.waktu_selesai.slice(0,5)}` : ''} WIB
                 </span>
               </div>
             </div>

             <div className="w-px h-12 bg-slate-200/80 hidden md:block"></div>

             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                 <span className="material-icons-round text-[22px]">place</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-0.5">Lokasi</span>
                 <span className="text-[15px] font-bold text-slate-900 line-clamp-1 max-w-[200px] hover:max-w-none hover:whitespace-normal transition-all">{data.lokasi_kegiatan || '-'}</span>
               </div>
             </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="w-full border-b border-slate-200 mt-2">
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveTab('info')}
              className={`pb-4 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              <div className="flex items-center gap-2"><span className="material-icons-round text-[18px]">info</span> Ringkasan Umum</div>
            </button>
            <button 
              onClick={() => setActiveTab('pelayan')}
              className={`pb-4 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 flex gap-2 items-center ${activeTab === 'pelayan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              <div className="flex items-center gap-2"><span className="material-icons-round text-[18px]">groups</span> Susunan Tim Pelayan</div>
              <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px]">{new Set(pelayanList.map((p: any) => p.pelayan_id)).size}</span>
            </button>
            <button 
              onClick={() => setActiveTab('registrasi')}
              className={`pb-4 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 flex gap-2 items-center ${activeTab === 'registrasi' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              <div className="flex items-center gap-2"><span className="material-icons-round text-[18px]">how_to_reg</span> Akses & Pendaftaran</div>
              {data.berbayar && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
            </button>
            {['Ongoing', 'Menunggu LPJ', 'Selesai'].includes(data.status_kegiatan) && (
              <button 
                onClick={() => setActiveTab('kehadiran')}
                className={`pb-4 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 flex gap-2 items-center ${activeTab === 'kehadiran' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
              >
                <div className="flex items-center gap-2"><span className="material-icons-round text-[18px]">assessment</span> Laporan Kehadiran</div>
              </button>
            )}
            {data.nama_jenis_kegiatan === 'Pemeriksaan Kesehatan' && (
              <button 
                onClick={() => setActiveTab('pasien')}
                className={`pb-4 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 flex gap-2 items-center ${activeTab === 'pasien' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
              >
                <div className="flex items-center gap-2"><span className="material-icons-round text-[18px]">medical_services</span> Data Pasien Medis</div>
                <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px]">{pasienList.length}</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: INFORMASI UMUM */}
        {activeTab === 'info' && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
             
             {/* KOLOM KIRI */}
             <div className="flex flex-col gap-8">
               <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6">
                  <h3 className="text-slate-800 font-bold uppercase tracking-wide border-b border-slate-100 pb-3 flex items-center gap-2">
                     <span className="material-icons-round text-blue-500">business</span> Entitas Penyelenggara
                  </h3>
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-slate-400 font-bold uppercase">Organisasi Struktural</span>
                      <span className="text-sm font-semibold text-slate-900 border border-slate-100 bg-slate-50 p-3.5 rounded-lg flex items-center gap-2">
                         {data.nama_satelit || data.nama_departemen || data.nama_komisi || 'Pusat Gereja (Master)'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-slate-400 font-bold uppercase">Person In Charge (PIC)</span>
                      <span className="text-sm font-semibold text-slate-900 border border-slate-100 bg-slate-50 p-3.5 rounded-lg flex items-center gap-2">
                         <span className="material-icons-round text-slate-400 text-[18px]">person</span>
                         {data.pic_name || 'Belum diatur'}
                      </span>
                    </div>
                    {data.keterangan && (
                      <div className="flex flex-col gap-1 mt-1">
                        <span className="text-xs text-slate-400 font-bold uppercase">Catatan / Instruksi Khusus</span>
                        <div className="text-sm font-medium text-slate-700 border border-amber-100 bg-amber-50/50 p-4 rounded-lg leading-relaxed whitespace-pre-wrap">
                           {data.keterangan}
                        </div>
                      </div>
                    )}
                  </div>
               </div>

               {/* Dynamic Khotbah Info */}
               {data.nama_jenis_kegiatan?.toLowerCase().includes('kebaktian') && (
                 <div className="p-6 bg-blue-50/50 rounded-xl shadow-sm border border-blue-100 flex flex-col gap-6 relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-[0.03] pointer-events-none">
                       <span className="material-icons-round text-[150px] text-blue-900">auto_stories</span>
                    </div>
                    <h3 className="text-blue-900 font-bold uppercase tracking-wide border-b border-blue-100 pb-3 flex items-center gap-2 z-10">
                       <span className="material-icons-round text-blue-600">church</span> Modul Ekstra Ibadah
                    </h3>
                    <div className="flex flex-col gap-5 z-10">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-blue-800 font-bold uppercase">Tema Khotbah</span>
                        <span className="text-sm font-semibold text-slate-900 bg-white border border-blue-100 p-3.5 rounded-lg italic">
                           &quot;{data.tema_khotbah || 'Belum ada tema mingguan'}&quot;
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1 flex flex-col gap-1">
                          <span className="text-xs text-blue-800 font-bold uppercase">Pengkhotbah Utama</span>
                          <span className="text-sm font-semibold text-slate-900 bg-white border border-blue-100 p-3.5 rounded-lg flex items-center gap-2">
                             <span className="material-icons-round text-blue-400 text-[18px]">interpreter_mode</span>
                             {data.nama_pengkhotbah_1 || '-'}
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <span className="text-xs text-blue-800 font-bold uppercase">Pendamping</span>
                          <span className="text-sm font-semibold text-slate-900 bg-white border border-blue-100 p-3.5 rounded-lg flex items-center gap-2">
                             <span className="material-icons-round text-slate-300 text-[18px]">person</span>
                             {data.nama_pengkhotbah_2 || '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                 </div>
               )}
             </div>

             {/* KOLOM KANAN */}
             <div className="flex flex-col gap-8 h-full">
               <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-5 h-full min-h-[400px]">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-slate-800 font-bold uppercase tracking-wide flex items-center gap-2">
                       <span className="material-icons-round text-amber-500">image</span> Poster / Banner
                    </h3>
                    
                    {isEditable && (
                      <label className={`text-xs font-bold transition-all flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-lg ${isUploadingBanner ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:text-blue-800 hover:bg-blue-100'}`}>
                        {isUploadingBanner ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></span> : <span className="material-icons-round text-[14px]">upload</span>}
                        {isUploadingBanner ? 'Mengunggah...' : (data.url_banner ? 'Ubah Poster' : 'Unggah Poster')}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden"
                          onChange={handleBannerUpload}
                          disabled={isUploadingBanner}
                        />
                      </label>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center justify-center p-2">
                    {data.url_banner && !isUploadingBanner ? (
                       <img src={data.url_banner} alt="Banner Acara" onClick={() => setIsLightboxOpen(true)} className="w-full max-h-[450px] object-cover rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:opacity-95 transition-opacity" />
                    ) : isUploadingBanner ? (
                       <div className="w-full h-64 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center text-slate-400 gap-3">
                          <span className="material-icons-round text-[48px] animate-pulse">cloud_upload</span>
                          <span className="text-sm font-semibold">Memproses Poster...</span>
                       </div>
                    ) : (
                       <div className="w-full h-64 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                          <span className="material-icons-round text-[48px] text-slate-300 mb-2">insert_photo</span>
                          <span className="text-sm font-semibold text-slate-500">Belum ada poster tersedia</span>
                          <span className="text-xs mt-1 px-8 text-center leading-relaxed">Format JPG/PNG. Rasio lanskap disarankan (16:9). Beban berlebih maksimal 10MB.</span>
                       </div>
                    )}
                  </div>
               </div>
             </div>
          </div>
        )}

        {/* TAB 3: PELAYAN (CREATE THEN MANAGE CORE) */}
        {activeTab === 'pelayan' && (() => {
          // GROUPING LOGIC OPSI A: 1 Orang = 1 Baris
          const groupedPelayan = Array.from(
            pelayanList.reduce((map, p) => {
               if (!map.has(p.pelayan_id)) {
                  // Salin data utuh sebagai "Master", tambahkan daftar roles eksklusif
                  map.set(p.pelayan_id, {
                     ...p,
                     roles: [{ id: p.id, role_id: p.role_id, role_kehadiran: p.role_kehadiran, status_konfirmasi: p.status_konfirmasi }]
                  });
               } else {
                  // Orang eksis, cukup inject peran barunya ke dalam array roles di master
                  const existing = map.get(p.pelayan_id);
                  existing.roles.push({ id: p.id, role_id: p.role_id, role_kehadiran: p.role_kehadiran, status_konfirmasi: p.status_konfirmasi });
                  
                  // Heuristik Status Konfirmasi: Jika ada satu saja yg Hadir/Bersedia, prioritaskan master status tersebut
                  if (p.status_konfirmasi === 'Hadir' || p.status_konfirmasi === 'Bersedia') {
                     existing.status_konfirmasi = p.status_konfirmasi;
                  }
               }
               return map;
            }, new Map()).values()
          );

          const uniqueSelectedCount = new Set(
             pelayanList.filter((p: any) => selectedRosterIds.has(p.id)).map((p: any) => p.pelayan_id)
          ).size;

          return (
          <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 animate-in fade-in flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
               <div className="flex flex-col">
                 <h2 className="text-lg font-black text-slate-900">Roster Tim Pelayan Acara</h2>
                 <p className="text-xs text-slate-500 mt-1">Kelola peranan teknis (WL, singer, usher, dsb) untuk mengawal eksekusi jadwal.</p>
               </div>
               {isPelayanManager && (
                 <button 
                   onClick={() => setIsModalOpen(true)}
                   className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-2 text-sm transition-all"
                 >
                   <span className="material-icons-round text-[18px]">person_add</span> Tambah Pelayan Baru
                 </button>
               )}
            </div>


            {/* BULK ACTION BAR — hanya muncul saat Ongoing dan ada yang dipilih */}
            {data.status_kegiatan === 'Ongoing' && isPelayanManager && selectedRosterIds.size > 0 && (
              <div className="mx-6 my-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2 fade-in">
                <span className="text-sm font-bold text-blue-800">
                  {uniqueSelectedCount} pelayan dipilih
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedRosterIds(new Set())}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Batal Pilih
                  </button>
                  <button
                    disabled={isBulkMarking}
                    onClick={async () => {
                      setIsBulkMarking(true);
                      try {
                        await fetch(`/api/kegiatan/${id}/pelayan`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            roster_ids: Array.from(selectedRosterIds),
                            status_konfirmasi: 'Hadir'
                          })
                        });
                        setSelectedRosterIds(new Set());
                        fetchPelayan();
                      } catch (e) { console.error(e); } finally {
                        setIsBulkMarking(false);
                      }
                    }}
                    className="px-4 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isBulkMarking
                      ? <span className="material-icons-round text-[14px] animate-spin">refresh</span>
                      : <span className="material-icons-round text-[14px]">done_all</span>}
                    Tandai {uniqueSelectedCount} Pelayan Hadir
                  </button>
                </div>
              </div>
            )}
            <div className="p-0 flex flex-col">
              {isLoadingPelayan ? (
                <div className="p-12 flex justify-center items-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div></div>
              ) : pelayanList.length === 0 ? (
                <div className="p-16 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <span className="material-icons-round text-[40px] text-slate-300">front_hand</span>
                  </div>
                  <h3 className="text-slate-700 font-bold text-lg mb-1">Belum Ada Pelayan Disusun</h3>
                  <p className="text-slate-500 text-sm max-w-[300px]">Tim ibadah/acara masih kosong. Mari mulai dengan melantik Worship Leader (WL) atau Koordinator pertama.</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                        {/* Checkbox all — hanya tampil saat Ongoing */}
                        {data.status_kegiatan === 'Ongoing' && isPelayanManager && (
                          <th className="py-4 pl-6 pr-2 w-8">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                              checked={selectedRosterIds.size === pelayanList.filter((p: any) => p.status_konfirmasi !== 'Hadir').length && pelayanList.filter((p: any) => p.status_konfirmasi !== 'Hadir').length > 0}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedRosterIds(new Set(pelayanList.filter((p: any) => p.status_konfirmasi !== 'Hadir').map((p: any) => p.id)));
                                } else {
                                  setSelectedRosterIds(new Set());
                                }
                              }}
                              title="Pilih semua yang belum hadir"
                            />
                          </th>
                        )}
                        <th className="py-4 px-4 font-semibold w-10">No</th>
                        <th className="py-4 px-4 font-semibold">Nama Individu</th>
                        <th className="py-4 px-4 font-semibold">Tugas / Peran Eksklusif</th>
                        <th className="py-4 px-4 font-semibold">Status Konfirmasi</th>
                        <th className="py-4 px-4 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedPelayan.map((p: any, index) => {
                        const allRoleIds = p.roles.map((r: any) => r.id);
                        const isAllSelected = allRoleIds.every((rid: number) => selectedRosterIds.has(rid));

                        return (
                        <tr key={p.pelayan_id} className={`hover:bg-slate-50/50 transition-colors group ${isAllSelected ? 'bg-blue-50/40' : ''}`}>
                          {/* Checkbox column — hanya saat Ongoing dan belum hadir */}
                          {data.status_kegiatan === 'Ongoing' && isPelayanManager && (
                            <td className="py-4 pl-6 pr-2">
                              {p.status_konfirmasi !== 'Hadir' ? (
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                  checked={isAllSelected}
                                  onChange={e => {
                                    const next = new Set(selectedRosterIds);
                                    if (e.target.checked) allRoleIds.forEach((rid: number) => next.add(rid));
                                    else allRoleIds.forEach((rid: number) => next.delete(rid));
                                    setSelectedRosterIds(next);
                                  }}
                                />
                              ) : (
                                <span className="material-icons-round text-emerald-500 text-[18px]">check_circle</span>
                              )}
                            </td>
                          )}
                          <td className="py-4 px-4 text-sm text-slate-500">{index + 1}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {p.foto_url ? (
                                <img src={p.foto_url} alt="" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                  {p.nama_lengkap.charAt(0)}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{p.nama_lengkap}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 flex flex-wrap gap-2">
                             {p.roles.map((r: any) => (
                               <div key={r.id} className={`pl-3 pr-1 py-1 flex items-center gap-2 text-xs font-bold rounded uppercase tracking-wide border ${getRoleColor(r.role_kehadiran)}`}>
                                 {r.role_kehadiran}
                                 {isPelayanManager && (
                                   <button 
                                     onClick={async () => {
                                        if (!confirm(`Hapus peran ${r.role_kehadiran} untuk ${p.nama_lengkap}?`)) return;
                                        try {
                                          await fetch(`/api/kegiatan/${id}/pelayan?roster_id=${r.id}`, { method: 'DELETE' });
                                          fetchPelayan();
                                        } catch (e) { console.error(e); }
                                     }}
                                     className="w-5 h-5 rounded hover:bg-slate-900/10 flex items-center justify-center transition-colors"
                                     title="Hapus peran ini"
                                   >
                                     <span className="material-icons-round text-[12px]">close</span>
                                   </button>
                                 )}
                               </div>
                             ))}
                          </td>
                          <td className="py-4 px-6">
                              {/* ── FASE 2: HARI H (Ongoing/pasca) ── */}
                              {['Ongoing','Menunggu LPJ','Selesai'].includes(data.status_kegiatan) ? (
                                p.status_konfirmasi === 'Hadir' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="text-xs font-bold text-emerald-700">Hadir ✓</span>
                                  </div>
                                ) : p.status_konfirmasi === 'Tidak Hadir' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    <span className="text-xs font-bold text-red-600">Tidak Hadir</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 opacity-60">
                                    <span className="w-2 h-2 rounded-full border border-slate-400"></span>
                                    <span className="text-xs font-medium text-slate-500">Menunggu Absensi</span>
                                  </div>
                                )
                              ) : (
                                /* ── FASE 1: PRA-ACARA (RSVP) ── */
                                p.status_konfirmasi === 'Bersedia' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="text-xs font-bold text-emerald-700">✅ Bersedia</span>
                                  </div>
                                ) : p.status_konfirmasi === 'Berhalangan' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                    <span className="text-xs font-bold text-red-600">❌ Berhalangan</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                    <span className="text-xs font-medium text-amber-700">⏳ Menunggu Konfirmasi</span>
                                  </div>
                                )
                              )}
                           </td>
                           <td className="py-4 px-6 text-right">
                               {isPelayanManager && (
                                 <div className="flex items-center justify-end gap-1">

                                   {/* Fase 1: Pra-Acara — tombol Ganti Pelayan jika Berhalangan */}
                                   {!['Ongoing','Menunggu LPJ','Selesai'].includes(data.status_kegiatan) && p.status_konfirmasi === 'Berhalangan' && (
                                     <button
                                       onClick={() => {
                                         setFormPelayan({ pelayan_id: '', role_id: String(p.role_id), role_kehadiran: p.role_kehadiran });
                                         setIsModalOpen(true);
                                       }}
                                       className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-black transition-colors border border-orange-200 flex items-center gap-1"
                                       title="Cari pengganti untuk peran ini"
                                     >
                                       <span className="material-icons-round text-[14px]">swap_horiz</span>
                                       Ganti Pelayan
                                     </button>
                                   )}

                                   {/* Fase 2: Hari H — tombol Tandai Hadir manual */}
                                   {p.status_konfirmasi !== 'Hadir' && data.status_kegiatan === 'Ongoing' && (
                                     <button
                                       onClick={async () => {
                                         try {
                                           await fetch(`/api/kegiatan/${id}/pelayan`, {
                                             method: 'PATCH',
                                             headers: { 'Content-Type': 'application/json' },
                                             body: JSON.stringify({ roster_id: p.id, status_konfirmasi: 'Hadir' })
                                           });
                                           fetchPelayan();
                                         } catch (e) { console.error(e); }
                                       }}
                                       className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 text-[11px] font-bold transition-colors border border-slate-200 hover:border-emerald-200 flex items-center gap-1"
                                       title="Tandai Hadir Manual"
                                     >
                                       <span className="material-icons-round text-[14px]">how_to_reg</span>
                                       Tandai Hadir
                                     </button>
                                   )}

                                   <button
                                     onClick={async () => {
                                       if (!confirm(`Hapus orang ini sepenuhnya (${p.nama_lengkap}) dari semua jadwal?`)) return;
                                       try {
                                         for (const role of p.roles) {
                                           await fetch(`/api/kegiatan/${id}/pelayan?roster_id=${role.id}`, { method: 'DELETE' });
                                         }
                                         fetchPelayan();
                                       } catch (e) { console.error(e); }
                                     }}
                                     className="w-8 h-8 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 inline-flex items-center justify-center transition-colors shadow-sm bg-white border border-slate-200 hover:border-red-200"
                                     title="Hapus Orang (Semua Peran)"
                                   >
                                      <span className="material-icons-round text-[18px]">delete_outline</span>
                                   </button>
                                 </div>
                               )}
                           </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
        })()}

        {/* TAB 2: AKSES, PENDAFTARAN & TIKET */}
        {activeTab === 'registrasi' && (
           <div className="w-full flex flex-col gap-6 animate-in fade-in">
             {/* If Go-Show */}
             {!data.butuh_registrasi && (
               <div className="p-12 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center text-center gap-4">
                 <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                   <span className="material-icons-round text-[40px]">sensor_door</span>
                 </div>
                 <div>
                   <h3 className="text-slate-800 font-black text-xl mb-2">Kegiatan Terbuka (Go-Show)</h3>
                   <p className="text-slate-500 text-sm max-w-md mx-auto">
                     Acara ini tidak mewajibkan jemaat untuk mendaftar secara online di awal. Rekap kehadiran dilakukan manual pada saat acara (Absensi On-The-Spot).
                   </p>
                 </div>
                 {/* Still show the publish & pricing info */}
                 <div className="flex gap-4 mt-4">
                   <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2">
                     <span className={`material-icons-round text-[18px] ${data.is_published ? 'text-blue-500' : 'text-slate-400'}`}>{data.is_published ? 'public' : 'visibility_off'}</span>
                     <span className="text-xs font-bold text-slate-600">{data.is_published ? 'Terpublikasi' : 'Internal'}</span>
                   </div>
                   <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-2">
                     <span className={`material-icons-round text-[18px] ${data.berbayar ? 'text-emerald-500' : 'text-slate-400'}`}>{data.berbayar ? 'confirmation_number' : 'money_off'}</span>
                     <span className="text-xs font-bold text-slate-600">{data.berbayar ? 'Berbayar' : 'Gratis'}</span>
                   </div>
                 </div>
               </div>
             )}

             {/* If Registration Needed */}
             {data.butuh_registrasi && (
               <>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm justify-center items-center flex flex-col gap-1">
                     <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Mendaftar</h4>
                     <p className="text-3xl font-black text-blue-700">{registrasiList.length}</p>
                   </div>
                   <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm justify-center items-center flex flex-col gap-1">
                     <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Target Kuota</h4>
                     <p className="text-3xl font-black text-slate-700">{data.kuota_peserta || '∞'}</p>
                   </div>
                   <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm justify-center items-center flex flex-col gap-1">
                     <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest text-center">Verified Paid</h4>
                     <p className="text-3xl font-black text-emerald-600">{registrasiList.filter(r => r.status_pembayaran === 'Paid').length}</p>
                   </div>
                   <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm justify-center items-center flex flex-col gap-1">
                     <h4 className="text-[10px] font-bold text-purple-600 uppercase tracking-widest text-center">Total Hadir</h4>
                     <p className="text-3xl font-black text-purple-600">{registrasiList.filter(r => r.is_checked_in).length}</p>
                   </div>
                 </div>

                 <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                       <h3 className="font-bold text-slate-800">Daftar Peserta Kegiatan</h3>
                       <button onClick={() => setIsModalRegistrasiOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition flex items-center gap-2">
                         <span className="material-icons-round text-[16px]">add</span> Tambah Manual
                       </button>
                    </div>
                    {isLoadingRegistrasi ? (
                       <div className="p-12 flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div></div>
                    ) : registrasiList.length === 0 ? (
                       <div className="p-12 text-center flex flex-col items-center">
                         <span className="material-icons-round text-slate-300 text-[48px] mb-2">how_to_reg</span>
                         <h4 className="text-slate-800 font-bold mb-1">Belum Ada Pendaftar</h4>
                         <p className="text-slate-500 font-medium text-sm">Jemaat dapat mendaftar mandiri via aplikasi, atau tambahkan manual di sini.</p>
                       </div>
                    ) : (
                       <div className="w-full overflow-x-auto">
                         <table className="w-full text-left text-sm whitespace-nowrap">
                           <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                             <tr>
                               <th className="py-3 px-5">Peserta</th>
                               <th className="py-3 px-5">Waktu Mendaftar</th>
                               {data.berbayar && <th className="py-3 px-5">Status Bayar</th>}
                               <th className="py-3 px-5">Kehadiran</th>
                               <th className="py-3 px-5 text-right w-20">Aksi</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 text-slate-700">
                             {registrasiList.map(reg => (
                               <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                                 <td className="py-3 px-5">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800">{reg.nama_peserta}</span>
                                      <span className="text-[11px] text-slate-400">{reg.no_hp || '-'} &bull; {reg.asal_satelit || 'Gereja Pusat'}</span>
                                    </div>
                                 </td>
                                 <td className="py-3 px-5 text-xs font-medium text-slate-500">
                                   {new Date(reg.tanggal_daftar).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                                 </td>
                                 {data.berbayar && (
                                   <td className="py-3 px-5">
                                      <div className="flex flex-col gap-1 items-start">
                                        <span className={`px-2.5 py-1 text-[10px] uppercase w-fit font-bold rounded-md border ${reg.status_pembayaran === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                          {reg.status_pembayaran}
                                        </span>
                                        {reg.url_bukti_bayar && (
                                          <a href={reg.url_bukti_bayar} target="_blank" className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded flex items-center gap-1 border border-blue-100/50 hover:bg-blue-100 transition-colors mt-1">
                                            <span className="material-icons-round text-[12px]">receipt_long</span> Bukti
                                          </a>
                                        )}
                                      </div>
                                   </td>
                                 )}
                                 <td className="py-3 px-5">
                                    <span className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-md border ${reg.is_checked_in ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                      {reg.is_checked_in ? 'Checked In' : 'Belum Hadir'}
                                    </span>
                                 </td>
                                 <td className="py-3 px-5 text-right flex items-center justify-end gap-1">
                                    {data.berbayar && reg.status_pembayaran !== 'Paid' && (
                                      <button onClick={() => {
                                        if(confirm('Verifikasi pembayaran tiket ini?')) handleActionRegistrasi('VERIFY_PAYMENT', [reg.id]);
                                      }} className="w-8 h-8 rounded-full hover:bg-emerald-50 inline-flex items-center justify-center text-emerald-400 hover:text-emerald-600 transition-colors" title="Verifikasi Pembayaran">
                                        <span className="material-icons-round text-[18px]">price_check</span>
                                      </button>
                                    )}
                                    {!reg.is_checked_in && (
                                      <button onClick={() => {
                                        if(confirm('Lakukan Check-In untuk peserta ini?')) handleActionRegistrasi('CHECK_IN', [reg.id]);
                                      }} className="w-8 h-8 rounded-full hover:bg-purple-50 inline-flex items-center justify-center text-purple-400 hover:text-purple-600 transition-colors" title="Check-In Manual">
                                        <span className="material-icons-round text-[18px]">how_to_reg</span>
                                      </button>
                                    )}
                                    <button onClick={() => {
                                      if(confirm('Batalkan dan hapus pendaftaran ini?')) handleActionRegistrasi('CANCEL', [reg.id]);
                                    }} className="w-8 h-8 rounded-full hover:bg-red-50 inline-flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors" title="Hapus Registrasi">
                                      <span className="material-icons-round text-[18px]">delete</span>
                                    </button>
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                    )}
                 </div>
               </>
             )}
           </div>
        )}

        {/* TAB EXTRA: LAPORAN KEHADIRAN */}
        {activeTab === 'kehadiran' && ['Ongoing', 'Menunggu LPJ', 'Selesai'].includes(data.status_kegiatan) && (
          <div className="w-full flex flex-col gap-6 animate-in fade-in">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm justify-center items-center flex flex-col gap-1">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Total Hadir</h4>
                 <p className="text-3xl font-black text-slate-900">{absensiStats?.total_hadir || 0}</p>
               </div>
               <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm justify-center items-center flex flex-col gap-1">
                 <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest text-center">Jemaat Umum</h4>
                 <p className="text-3xl font-black text-blue-600">{absensiStats?.total_jemaat || 0}</p>
               </div>
               <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm justify-center items-center flex flex-col gap-1">
                 <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest text-center">Tamu Baru</h4>
                 <p className="text-3xl font-black text-emerald-600">{absensiStats?.total_tamu || 0}</p>
               </div>
               <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm justify-center items-center flex flex-col gap-1">
                 <h4 className="text-[10px] font-bold text-purple-600 uppercase tracking-widest text-center">Tim Pelayan</h4>
                 <p className="text-3xl font-black text-purple-600">{absensiStats?.total_pelayan || 0}</p>
               </div>
             </div>

             <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <h3 className="font-bold text-slate-800">Log Riwayat Kehadiran</h3>
                   <button onClick={() => fetchAbsensiList()} className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 text-slate-500 transition-colors" title="Segarkan Data">
                     <span className={`material-icons-round text-[16px] ${isLoadingAbsensi ? 'animate-spin text-blue-600' : ''}`}>refresh</span>
                   </button>
                </div>
                
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 bg-white">
                   <div className="relative flex-[1.5]">
                      <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                      <input 
                        type="text" 
                        placeholder="Cari nama jemaat..." 
                        value={kehadiranSearch} 
                        onChange={e => setKehadiranSearch(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                      />
                   </div>
                   <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 overflow-x-auto scrollbar-hide flex-1">
                      {['Semua', 'Jemaat', 'Tamu', 'Pelayan'].map(f => (
                         <button 
                           key={f} 
                           onClick={() => setKehadiranFilterRole(f)} 
                           className={`flex-1 px-4 py-1.5 text-[11px] uppercase tracking-wide font-black rounded-md transition-all whitespace-nowrap ${kehadiranFilterRole === f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
                         >
                           {f}
                         </button>
                      ))}
                   </div>
                </div>

                {isLoadingAbsensi ? (
                   <div className="p-12 flex justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div></div>
                ) : absensiLogs.length === 0 ? (
                   <div className="p-12 text-center flex flex-col items-center">
                     <span className="material-icons-round text-slate-300 text-[48px] mb-2">event_busy</span>
                     <h4 className="text-slate-800 font-bold mb-1">Belum Ada Kehadiran</h4>
                     <p className="text-slate-500 font-medium text-sm">Tidak ada yang melakukan absen pada acara ini.</p>
                   </div>
                ) : (() => {
                  const filteredAbsensi = absensiLogs.filter(log => {
                    const matchSearch = kehadiranSearch === '' || log.nama.toLowerCase().includes(kehadiranSearch.toLowerCase());
                    const matchRole = kehadiranFilterRole === 'Semua' || (
                       kehadiranFilterRole === 'Pelayan' ? !['Jemaat', 'Tamu'].includes(log.jenis) : log.jenis === kehadiranFilterRole
                    );
                    return matchSearch && matchRole;
                  });
                  
                  if (filteredAbsensi.length === 0) {
                     return (
                       <div className="p-12 text-center flex flex-col items-center">
                         <span className="material-icons-round text-slate-300 text-[48px] mb-2">search_off</span>
                         <h4 className="text-slate-800 font-bold mb-1">Pencarian Tidak Ditemukan</h4>
                         <p className="text-slate-500 font-medium text-sm">Tidak ada yang sesuai dengan filter atau kata kunci di atas.</p>
                       </div>
                     );
                  }

                  return (
                   <div className="w-full overflow-x-auto">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                       <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                         <tr>
                           <th className="py-3 px-5">Nama Orang</th>
                           <th className="py-3 px-5">Peran & Jenis</th>
                           <th className="py-3 px-5">Metode Scan</th>
                           <th className="py-3 px-5 text-right">Waktu (Lokal)</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 text-slate-700">
                         {filteredAbsensi.map(log => {
                           // Parse timezone as Local exactly like how the kiosk page was fixed!
                           const dateStr = log.waktu_hadir;
                           const ds = (!dateStr.endsWith('Z') && !dateStr.includes('+')) ? dateStr + 'Z' : dateStr;
                           const d = new Date(ds);
                           
                           return (
                             <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                               <td className="py-3 px-5">
                                 <span className="font-bold text-slate-800">{log.nama}</span>
                               </td>
                               <td className="py-3 px-5">
                                 <span className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-md border ${log.jenis === 'Jemaat' ? 'bg-blue-50 text-blue-700 border-blue-200' : log.jenis === 'Tamu' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                                   {log.jenis}
                                 </span>
                               </td>
                               <td className="py-3 px-5">
                                 <div className="flex items-center gap-1">
                                   <span className={`material-icons-round text-[14px] ${log.metode === 'QR Code' ? 'text-emerald-500' : 'text-slate-400'}`}>
                                      {log.metode === 'QR Code' ? 'qr_code_2' : 'keyboard'}
                                   </span>
                                   <span className="text-[11px] font-bold text-slate-500">{log.metode}</span>
                                 </div>
                               </td>
                               <td className="py-3 px-5 text-right font-['Liberation_Mono'] text-xs font-bold text-slate-600">
                                 {d.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })} WIB
                               </td>
                             </tr>
                           )
                         })}
                       </tbody>
                     </table>
                   </div>
                  )
                })()}
             </div>
          </div>
        )}

        {/* TAB 4: PASIEN MEDIS (KHUSUS PEMERIKSAAN KESEHATAN) */}
        {activeTab === 'pasien' && data.nama_jenis_kegiatan === 'Pemeriksaan Kesehatan' && (
          <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 animate-in fade-in flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
               <div className="flex flex-col">
                 <h2 className="text-lg font-black text-slate-900">Rekam Medis Pasien</h2>
                 <p className="text-xs text-slate-500 mt-1">Kelola data pemeriksaan, keluhan, diagnosa, dan tindakan medis untuk jemaat/pasien yang diperiksa.</p>
               </div>
               {isPelayanManager && (
                 <button 
                   onClick={() => setIsModalPasienOpen(true)}
                   className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-2 text-sm transition-all"
                 >
                   <span className="material-icons-round text-[18px]">add_circle</span> Tambah Pasien
                 </button>
               )}
            </div>

            <div className="p-0 flex flex-col">
              {isLoadingPasien ? (
                <div className="p-12 flex justify-center items-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div></div>
              ) : pasienList.length === 0 ? (
                <div className="p-16 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <span className="material-icons-round text-[40px] text-slate-300">healing</span>
                  </div>
                  <h3 className="text-slate-700 font-bold text-lg mb-1">Daftar Pasien Kosong</h3>
                  <p className="text-slate-500 text-sm max-w-[300px]">Belum ada tindakan medis yang dicatat. Klik 'Tambah Pasien' untuk mencatat keluhan dan diagnosa medis.</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-4 px-6 font-semibold w-12">No</th>
                        <th className="py-4 px-6 font-semibold">Nama Pasien</th>
                        <th className="py-4 px-6 font-semibold">Keluhan & Diagnosa</th>
                        <th className="py-4 px-6 font-semibold">Tindakan / Obat</th>
                        <th className="py-4 px-6 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pasienList.map((p, index) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-4 px-6 text-sm text-slate-500 align-top">{index + 1}</td>
                          <td className="py-4 px-6 align-top">
                            <div className="flex items-start gap-3">
                              {p.foto_pasien ? (
                                <img src={p.foto_pasien} alt="" className="w-8 h-8 rounded-full border border-slate-200 object-cover mt-0.5" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase shrink-0 mt-0.5">
                                  {p.nama_pasien?.charAt(0) || '?'}
                                </div>
                              )}
                              <div className="flex flex-col gap-0.5">
                                 <div className="flex items-center gap-1.5">
                                   <span className="text-sm font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{p.nama_pasien}</span>
                                   {!p.jemaat_id && <span className="bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">Luar</span>}
                                 </div>
                                 <span className="text-[10px] text-slate-400 font-medium">Dietangani: {p.nama_dokter || '-'} {!p.pelayan_medis_id && p.nama_pelayan_luar && '(Luar)'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 align-top">
                             <div className="flex flex-col gap-1 max-w-[200px]">
                               <p className="text-xs text-slate-700 line-clamp-2" title={p.keluhan_simptom}><span className="font-semibold text-slate-500">K:</span> {p.keluhan_simptom || 'Tidak ada'}</p>
                               <p className="text-xs text-blue-700 bg-blue-50/50 p-1.5 rounded line-clamp-2 border border-blue-100" title={p.diagnosa}><span className="font-semibold text-blue-800">Dx:</span> {p.diagnosa || '-'}</p>
                             </div>
                          </td>
                          <td className="py-4 px-6 align-top">
                             <div className="flex flex-col gap-1.5">
                               <div className="text-xs text-slate-700 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100 max-w-[200px]" title={p.tindakan_obat}>
                                 {p.tindakan_obat || '-'}
                               </div>
                               <div className="flex flex-wrap gap-1 mt-0.5 max-w-[200px]">
                                 {p.tensi_darah && <span className="px-1 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-bold border border-rose-100" title="Tensi Darah">BP: {p.tensi_darah}</span>}
                                 {p.gula_darah && <span className="px-1 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold border border-blue-100" title="Gula Darah">GL: {p.gula_darah}</span>}
                                 {p.asam_urat && <span className="px-1 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] font-bold border border-purple-100" title="Asam Urat">AU: {p.asam_urat}</span>}
                                 {p.kolesterol && <span className="px-1 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-bold border border-amber-100" title="Kolesterol">KL: {p.kolesterol}</span>}
                               </div>
                             </div>
                          </td>
                          <td className="py-4 px-6 text-right align-top">
                             <button className="w-8 h-8 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 inline-flex items-center justify-center transition-colors">
                                <span className="material-icons-round text-[18px]">delete_outline</span>
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* POPUP MODAL TAMBAH PELAYAN TAMU/LOKAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSavingPelayan && setIsModalOpen(false)}></div>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-slate-900 font-black text-lg flex items-center gap-2">
                <span className="material-icons-round text-blue-600">person_add</span> Susun Individu Pelayan
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">
                <span className="material-icons-round text-[20px]">close</span>
              </button>
            </div>
                       <div className="p-6 flex flex-col gap-6 overflow-y-auto scrollbar-hide flex-1">
                
               <div className="w-full flex flex-col gap-1.5 border border-blue-100 bg-blue-50/50 p-4 rounded-xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
                   <span className="material-icons-round text-6xl text-blue-500">assignment_ind</span>
                 </div>
                 <label className="text-blue-900 text-xs font-bold font-['Inter'] uppercase flex items-center gap-2">
                   1. Tentukan Role/Tugas <span className="text-red-500">*</span>
                 </label>
                 <select 
                   value={formPelayan.role_id} 
                   onChange={(e) => {
                     const selectedId = e.target.value;
                     const roleObj = rolePelayanOptions.find((r: any) => r.id.toString() === selectedId);
                     setFormPelayan(prev => ({ 
                       ...prev, 
                       role_id: selectedId, 
                       role_kehadiran: roleObj ? roleObj.nama_role : '',
                       pelayan_id: '' // Reset pelayan if role changes
                     }));
                   }}
                   className="px-4 py-3 bg-white rounded-lg border border-blue-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full font-semibold text-slate-800 relative z-10 shadow-sm mt-1 cursor-pointer"
                 >
                   <option value="">-- Pilih Peran / Role Tersedia --</option>
                   {rolePelayanOptions.map(r => (
                     <option key={r.id} value={r.id}>{r.nama_role}</option>
                   ))}
                 </select>
               </div>

               <div className="w-full flex flex-col gap-2">
                 <label className={`text-xs font-bold font-['Inter'] uppercase transition-colors ${!formPelayan.role_id ? 'text-slate-400' : 'text-slate-500'}`}>
                   2. Cari Pelayan Aktif <span className="text-red-500">*</span>
                 </label>
                 
                 {!formPelayan.role_id ? (
                    <div className="w-full px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 border-dashed text-sm text-slate-400 font-medium italic flex items-center gap-2">
                       <span className="material-icons-round text-[16px]">lock</span>
                       Pilih role/tugas terlebih dahulu
                    </div>
                 ) : (
                    <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                      <RoleAwareSelect
                        roleId={formPelayan.role_id}
                        roleName={formPelayan.role_kehadiran}
                        bypassMode={bypassRoleFilter}
                        kegiatanId={id}
                        onSelect={(id, name) => setFormPelayan(prev => ({ ...prev, pelayan_id: id }))}
                      />
                    </div>
                 )}

                 {formPelayan.role_id && (
                   <label className="flex items-center gap-1.5 cursor-pointer mt-1 self-start ml-1 group w-fit">
                     <input 
                       type="checkbox" 
                       checked={bypassRoleFilter} 
                       onChange={(e) => {
                         setBypassRoleFilter(e.target.checked);
                         setFormPelayan(prev => ({...prev, jemaat_id: ''})); // reset selection 
                       }} 
                       className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500 cursor-pointer" />
                     <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide group-hover:text-slate-700 transition">
                       Lihat semua pelayan aktif (tidak terbatas posisi)
                     </span>
                   </label>
                 )}
               </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button onClick={() => setIsModalOpen(false)} disabled={isSavingPelayan} className="px-5 py-2.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-200 text-sm">
                 Batal
               </button>
               <button onClick={() => handleSimpanPelayan()} disabled={isSavingPelayan || !formPelayan.pelayan_id || !formPelayan.role_kehadiran} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm disabled:opacity-50 transition-all">
                 {isSavingPelayan ? <span className="material-icons-round animate-spin text-[18px]">refresh</span> : <span className="material-icons-round text-[18px]">add_circle</span>}
                 Simpan & Ikat Peran
               </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL TAMBAH REGISTRASI MANUAL */}
      {isModalRegistrasiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <span className="material-icons-round text-blue-600">person_add</span> Form Tiket / Pendaftaran
               </h3>
               <button onClick={() => setIsModalRegistrasiOpen(false)} className="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition">
                 <span className="material-icons-round text-[20px]">close</span>
               </button>
            </div>
            
            <div className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Jemaat <span className="text-red-500">*</span></label>
                <AsyncAutocomplete 
                  label=""
                  onSelect={(id, name) => setFormRegistrasi(prev => ({...prev, jemaat_id: id}))}
                  placeholder="Ketik minimal 3 huruf nama jemaat..."
                />
              </div>

              {data?.berbayar && (
                <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Pembayaran (Opsional jika Cash H-Hari)</label>
                  <select 
                    value={formRegistrasi.metode_pembayaran} 
                    onChange={(e) => setFormRegistrasi(prev => ({...prev, metode_pembayaran: e.target.value}))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Belum Membayar</option>
                    <option value="Bayar Lunas (Manual/OTS)">Bayar Lunas (Manual/Langsung)</option>
                  </select>
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Catatan Khusus (Opsional)</label>
                <textarea 
                  value={formRegistrasi.catatan_khusus} 
                  onChange={(e) => setFormRegistrasi(prev => ({...prev, catatan_khusus: e.target.value}))}
                  placeholder="Contoh: Alergi makanan udang / tiket dibayarkan oleh Bapak X"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[80px]"
                ></textarea>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button onClick={() => setIsModalRegistrasiOpen(false)} className="px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-200 transition">Batal</button>
               <button 
                 onClick={handleSimpanRegistrasi} 
                 disabled={isSavingRegistrasi || !formRegistrasi.jemaat_id}
                 className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
               >
                 {isSavingRegistrasi ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'Daftarkan Peserta'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL TAMBAH PASIEN MEDIS */}
      {isModalPasienOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSavingPasien && setIsModalPasienOpen(false)}></div>
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <h3 className="text-slate-900 font-black text-lg flex items-center gap-2">
                <span className="material-icons-round text-blue-600">medical_services</span> Rekam Tindakan Medis Pasien
              </h3>
              <button onClick={() => setIsModalPasienOpen(false)} className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">
                <span className="material-icons-round text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-5 overflow-y-auto w-full">
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5 z-20">
                 <div className="flex flex-col gap-2 w-full relative z-20">
                   <div className="flex justify-between items-center">
                     <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">Data Pasien <span className="text-red-500">*</span></label>
                     <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-0.5 rounded transition">
                       <input type="checkbox" checked={formPasien.is_pasien_luar} onChange={(e) => setFormPasien(prev => ({...prev, is_pasien_luar: e.target.checked, jemaat_id: '', nama_pasien_luar: '', no_hp_pasien_luar: ''}))} className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300" />
                       <span className="text-[10px] font-bold text-slate-500 uppercase">Pasien Eksternal (Umum)</span>
                     </label>
                   </div>
                   {!formPasien.is_pasien_luar ? (
                     <AsyncAutocomplete 
                       label="" 
                       onSelect={(id, name) => setFormPasien(prev => ({ ...prev, jemaat_id: id }))}
                       placeholder="Cari pasien (Jemaat)..."
                     />
                   ) : (
                     <div className="flex flex-col gap-2">
                       <input type="text" value={formPasien.nama_pasien_luar} onChange={(e) => setFormPasien(prev => ({...prev, nama_pasien_luar: e.target.value}))} placeholder="Ketik nama lengkap pasien umum..." className="px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                       <input type="text" value={formPasien.no_hp_pasien_luar} onChange={(e) => setFormPasien(prev => ({...prev, no_hp_pasien_luar: e.target.value}))} placeholder="No. HP / WhatsApp (opsional)..." className="px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                     </div>
                   )}
                 </div>
                 <div className="flex flex-col gap-2 w-full relative z-10">
                   <div className="flex justify-between items-center">
                     <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">Dokter / Petugas</label>
                     <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-0.5 rounded transition">
                       <input type="checkbox" checked={formPasien.is_pelayan_luar} onChange={(e) => setFormPasien(prev => ({...prev, is_pelayan_luar: e.target.checked, pelayan_medis_id: '', nama_pelayan_luar: ''}))} className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300" />
                       <span className="text-[10px] font-bold text-slate-500 uppercase">Petugas Luar</span>
                     </label>
                   </div>
                   {!formPasien.is_pelayan_luar ? (
                     <AsyncAutocomplete 
                       label="" 
                       onSelect={(id, name) => setFormPasien(prev => ({ ...prev, pelayan_medis_id: id }))}
                       placeholder="Cari dokter / suster bertugas..."
                     />
                   ) : (
                     <input type="text" value={formPasien.nama_pelayan_luar} onChange={(e) => setFormPasien(prev => ({...prev, nama_pelayan_luar: e.target.value}))} placeholder="Ketik nama petugas medis..." className="px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" />
                   )}
                 </div>
               </div>

               <div className="w-full h-px bg-slate-100 my-1"></div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div className="flex flex-col gap-4">
                   <div className="w-full grid grid-cols-2 gap-3 mb-2">
                     <div className="flex flex-col gap-1.5">
                       <label className="text-slate-500 text-[10px] font-bold uppercase">Tensi Darah</label>
                       <input type="text" value={formPasien.tensi_darah} onChange={(e) => setFormPasien(prev => ({...prev, tensi_darah: e.target.value}))} placeholder="120/80" className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                       <label className="text-slate-500 text-[10px] font-bold uppercase">Gula Darah (mg/dL)</label>
                       <input type="number" value={formPasien.gula_darah} onChange={(e) => setFormPasien(prev => ({...prev, gula_darah: e.target.value}))} placeholder="110" className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                       <label className="text-slate-500 text-[10px] font-bold uppercase">Asam Urat (mg/dL)</label>
                       <input type="number" step="0.1" value={formPasien.asam_urat} onChange={(e) => setFormPasien(prev => ({...prev, asam_urat: e.target.value}))} placeholder="5.5" className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                       <label className="text-slate-500 text-[10px] font-bold uppercase">Kolesterol (mg/dL)</label>
                       <input type="number" value={formPasien.kolesterol} onChange={(e) => setFormPasien(prev => ({...prev, kolesterol: e.target.value}))} placeholder="180" className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                     </div>
                   </div>
                   
                   <div className="w-full flex flex-col gap-1.5">
                     <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase flex items-center gap-1.5"><span className="material-icons-round text-[14px]">sick</span> Keluhan / Simptom</label>
                     <textarea 
                       value={formPasien.keluhan_simptom} 
                       onChange={(e) => setFormPasien(prev => ({ ...prev, keluhan_simptom: e.target.value }))}
                       placeholder="Sakit kepala, demam..."
                       className="px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full transition-all min-h-[70px]"
                     ></textarea>
                   </div>
                   <div className="w-full flex flex-col gap-1.5">
                     <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase flex items-center gap-1.5"><span className="material-icons-round text-[14px] text-blue-500">biotech</span> Diagnosa Utama</label>
                     <textarea 
                       value={formPasien.diagnosa} 
                       onChange={(e) => setFormPasien(prev => ({ ...prev, diagnosa: e.target.value }))}
                       placeholder="Misal: Hipertensi, ISPA"
                       className="px-4 py-3 bg-white rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full transition-all min-h-[70px]"
                     ></textarea>
                   </div>
                 </div>

                 <div className="flex flex-col gap-4">
                   <div className="w-full flex flex-col gap-1.5">
                     <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase flex items-center gap-1.5"><span className="material-icons-round text-[14px] text-emerald-500">medication</span> Tindakan & Obat</label>
                     <textarea 
                       value={formPasien.tindakan_obat} 
                       onChange={(e) => setFormPasien(prev => ({ ...prev, tindakan_obat: e.target.value }))}
                       placeholder="Amlodipine 5mg, Paracetamol 500mg, dsb"
                       className="px-4 py-3 bg-white rounded-lg border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm w-full transition-all flex-1 min-h-[140px]"
                     ></textarea>
                   </div>
                 </div>
               </div>

            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
               <button onClick={() => setIsModalPasienOpen(false)} disabled={isSavingPasien} className="px-5 py-2.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-200 text-sm">
                 Batal
               </button>
               <button onClick={handleSimpanPasien} disabled={isSavingPasien || (!formPasien.is_pasien_luar && !formPasien.jemaat_id)} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm disabled:opacity-50 transition-all">
                 {isSavingPasien ? <span className="material-icons-round animate-spin text-[18px]">refresh</span> : <span className="material-icons-round text-[18px]">check_circle</span>}
                 Simpan Rekam Medis
               </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX MODAL */}
      {isLightboxOpen && data?.url_banner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200" onClick={() => setIsLightboxOpen(false)}>
           <span className="absolute top-6 right-8 text-white material-icons-round text-[32px] cursor-pointer hover:scale-110 transition-transform">close</span>
           <img src={data.url_banner} alt="Banner Full" className="max-w-full max-h-full object-contain cursor-default rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

    </div>
  );
}
