'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Helper component for Async Search (Server-side search)
const AsyncAutocomplete = ({ 
  label, 
  onSelect,
  placeholder = "Ketik minimal 3 huruf..." 
}: { 
  label: string, 
  onSelect: (id: string, name: string) => void,
  placeholder?: string 
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
      const res = await fetch(`/api/options?type=jemaat_search&query=${encodeURIComponent(searchTerm)}`);
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

export default function DetailKegiatanPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [activeTab, setActiveTab] = useState<'info'|'jemaat'|'pelayan'>('info');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pelayan State
  const [pelayanList, setPelayanList] = useState<any[]>([]);
  const [isLoadingPelayan, setIsLoadingPelayan] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal Form State
  const [formPelayan, setFormPelayan] = useState({
    jemaat_id: '',
    role_kehadiran: 'WL'
  });
  const [isSavingPelayan, setIsSavingPelayan] = useState(false);

  useEffect(() => {
    fetchDetail();
    fetchPelayan();
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

  const handleSimpanPelayan = async () => {
    if (!formPelayan.jemaat_id) {
      alert('Pilih jemaat terlebih dahulu!');
      return;
    }
    
    setIsSavingPelayan(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/pelayan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPelayan)
      });
      const json = await res.json();
      
      if (json.success) {
        setIsModalOpen(false);
        setFormPelayan({ jemaat_id: '', role_kehadiran: 'WL' });
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

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div></div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-slate-500">Kegiatan tidak ditemukan</div>;
  }

  // Format Dates
  const startDate = new Date(data.tanggal_mulai).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
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
          <Link href="/dashboard/kegiatan" className="text-slate-500 hover:text-blue-600">Daftar Kegiatan</Link>
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
                  data.status_kegiatan === 'Akan Datang' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  data.status_kegiatan === 'Ongoing' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  data.status_kegiatan === 'Menunggu LPJ' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                  data.status_kegiatan === 'Selesai' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                  'bg-red-100 text-red-700 border-red-200'
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
              </div>
            </div>
            
            <div className="flex gap-3">
               <button className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 transition flex items-center gap-2 text-sm shadow-sm">
                 <span className="material-icons-round text-[18px]">edit</span> Edit Kegiatan
               </button>
            </div>
          </div>
          
          {/* Quick Highlight Bar */}
          <div className="w-full flex items-center gap-8 bg-slate-50 border border-slate-100 rounded-lg p-4 mt-2 z-10">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                 <span className="material-icons-round">calendar_today</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-xs text-slate-500 font-bold uppercase">Pelaksanaan</span>
                 <span className="text-sm font-semibold text-slate-900">{startDate}</span>
               </div>
             </div>
             
             <div className="w-px h-10 bg-slate-200"></div>

             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                 <span className="material-icons-round">schedule</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-xs text-slate-500 font-bold uppercase">Waktu</span>
                 <span className="text-sm font-semibold text-slate-900">
                    {data.waktu_mulai.slice(0,5)} {data.waktu_selesai ? `- ${data.waktu_selesai.slice(0,5)}` : ''} WIB
                 </span>
               </div>
             </div>

             <div className="w-px h-10 bg-slate-200"></div>

             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                 <span className="material-icons-round">place</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-xs text-slate-500 font-bold uppercase">Lokasi</span>
                 <span className="text-sm font-semibold text-slate-900">{data.lokasi_kegiatan || '-'}</span>
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
              <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px]">{pelayanList.length}</span>
            </button>
            <button 
              onClick={() => setActiveTab('jemaat')}
              className={`pb-4 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 flex gap-2 items-center ${activeTab === 'jemaat' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              <div className="flex items-center gap-2"><span className="material-icons-round text-[18px]">how_to_reg</span> Pendaftaran / Tiket</div>
              {data.berbayar && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
            </button>
          </div>
        </div>

        {/* TAB 1: INFORMASI UMUM */}
        {activeTab === 'info' && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-5">
                <h3 className="text-slate-800 font-bold uppercase tracking-wide border-b border-slate-100 pb-3 flex items-center gap-2">
                   <span className="material-icons-round text-blue-500">business</span> Entitas Penyelenggara
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400 font-bold uppercase">Organisasi Struktural</span>
                    <span className="text-sm font-semibold text-slate-900 border border-slate-100 bg-slate-50 p-3 rounded-lg flex items-center gap-2">
                       {data.nama_satelit || data.nama_departemen || data.nama_komisi || 'Pusat Gereja (Master)'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400 font-bold uppercase">Person In Charge (PIC)</span>
                    <span className="text-sm font-semibold text-slate-900 border border-slate-100 bg-slate-50 p-3 rounded-lg flex items-center gap-2">
                       <span className="material-icons-round text-slate-400 text-[18px]">person</span>
                       {data.pic_name || 'Belum diatur'}
                    </span>
                  </div>
                </div>
             </div>

             {/* Dynamic Khotbah Info */}
             {data.nama_jenis_kegiatan?.toLowerCase().includes('kebaktian') && (
               <div className="p-6 bg-blue-50/50 rounded-xl shadow-sm border border-blue-100 flex flex-col gap-5 relative overflow-hidden">
                  <div className="absolute right-0 top-0 opacity-[0.03] pointer-events-none">
                     <span className="material-icons-round text-[150px] text-blue-900">auto_stories</span>
                  </div>
                  <h3 className="text-blue-900 font-bold uppercase tracking-wide border-b border-blue-100 pb-3 flex items-center gap-2 z-10">
                     <span className="material-icons-round text-blue-600">church</span> Modul Ekstra Ibadah
                  </h3>
                  <div className="flex flex-col gap-4 z-10">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-blue-800 font-bold uppercase">Tema Khotbah</span>
                      <span className="text-sm font-semibold text-slate-900 bg-white border border-blue-100 p-3 rounded-lg italic">
                         &quot;{data.tema_khotbah || 'Belum ada tema mingguan'}&quot;
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-xs text-blue-800 font-bold uppercase">Pengkhotbah Utama</span>
                        <span className="text-sm font-semibold text-slate-900 bg-white border border-blue-100 p-3 rounded-lg flex items-center gap-2">
                           <span className="material-icons-round text-blue-400 text-[18px]">interpreter_mode</span>
                           {data.nama_pengkhotbah_1 || '-'}
                        </span>
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-xs text-blue-800 font-bold uppercase">Pendamping</span>
                        <span className="text-sm font-semibold text-slate-900 bg-white border border-blue-100 p-3 rounded-lg flex items-center gap-2">
                           <span className="material-icons-round text-slate-300 text-[18px]">person</span>
                           {data.nama_pengkhotbah_2 || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
               </div>
             )}
          </div>
        )}

        {/* TAB 3: PELAYAN (CREATE THEN MANAGE CORE) */}
        {activeTab === 'pelayan' && (
          <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 animate-in fade-in flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
               <div className="flex flex-col">
                 <h2 className="text-lg font-black text-slate-900">Roster Tim Pelayan Acara</h2>
                 <p className="text-xs text-slate-500 mt-1">Kelola peranan teknis (WL, singer, usher, dsb) untuk mengawal eksekusi jadwal.</p>
               </div>
               <button 
                 onClick={() => setIsModalOpen(true)}
                 className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-2 text-sm transition-all"
               >
                 <span className="material-icons-round text-[18px]">person_add</span> Tambah Pelayan Baru
               </button>
            </div>

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
                <div className="w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-4 px-6 font-semibold w-12">No</th>
                        <th className="py-4 px-6 font-semibold">Nama Individu</th>
                        <th className="py-4 px-6 font-semibold">Tugas / Peran Eksklusif</th>
                        <th className="py-4 px-6 font-semibold">Status Konfirmasi</th>
                        <th className="py-4 px-6 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pelayanList.map((p, index) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-4 px-6 text-sm text-slate-500">{index + 1}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {p.foto_url ? (
                                <img src={p.foto_url} alt="" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                  {p.nama_lengkap.charAt(0)}
                                </div>
                              )}
                              <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{p.nama_lengkap}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                             <div className={`px-3 py-1 text-xs font-bold rounded uppercase tracking-wide inline-flex border ${getRoleColor(p.role_kehadiran)}`}>
                               {p.role_kehadiran}
                             </div>
                          </td>
                          <td className="py-4 px-6">
                             <div className="flex items-center gap-1.5 opacity-60">
                               <span className="w-2 h-2 rounded-full border border-slate-400"></span>
                               <span className="text-xs font-medium text-slate-500">Menunggu Absensi (H-Hari)</span>
                             </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                             <button className="w-8 h-8 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 inline-flex items-center justify-center transition-colors">
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

        {/* TAB 2: JEMAAT (CAMP) */}
        {activeTab === 'jemaat' && (
           <div className="p-16 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center animate-in fade-in text-center">
             <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-500">
               <span className="material-icons-round text-[40px]">confirmation_number</span>
             </div>
             {data.berbayar ? (
                <>
                  <h3 className="text-slate-800 font-bold text-lg mb-1">Tiket Sistem Aktif</h3>
                  <p className="text-slate-500 text-sm max-w-sm">Data pendaftaran jemaat yang membeli retret/camp akan mengalir ke tabel ini ketika dibuka publik.</p>
                </>
             ) : (
                <>
                  <h3 className="text-slate-800 font-bold text-lg mb-1">Acara Umum (Gratis)</h3>
                  <p className="text-slate-500 text-sm max-w-sm">Acara ini terbuka luas tanpa registrasi pembayaran tiket masuk.</p>
                </>
             )}
           </div>
        )}

      </div>

      {/* POPUP MODAL TAMBAH PELAYAN TAMU/LOKAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSavingPelayan && setIsModalOpen(false)}></div>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-slate-900 font-black text-lg flex items-center gap-2">
                <span className="material-icons-round text-blue-600">person_add</span> Susun Individu Pelayan
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">
                <span className="material-icons-round text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
               
               <AsyncAutocomplete 
                 label="1. Relasikan Data Jemaat/Pengurus" 
                 onSelect={(id, name) => setFormPelayan(prev => ({ ...prev, jemaat_id: id }))}
                 placeholder="Ketik minimal 3 huruf nama jemaat..."
               />

               <div className="w-full flex flex-col gap-1.5">
                 <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">2. Tugaskan Role <span className="text-red-500">*</span></label>
                 <select 
                   value={formPelayan.role_kehadiran} 
                   onChange={(e) => setFormPelayan(prev => ({ ...prev, role_kehadiran: e.target.value }))}
                   className="px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm w-full font-semibold text-slate-700"
                 >
                   <optgroup label="Mimbar Utama">
                     <option value="WL">Worship Leader (WL)</option>
                     <option value="Singer">Singer / Vokal</option>
                   </optgroup>
                   <optgroup label="Instrumen Musik">
                     <option value="Pemusik Keyboard">Pemusik - Keyboard</option>
                     <option value="Pemusik Gitar">Pemusik - Gitar / Bass</option>
                     <option value="Pemusik Drum">Pemusik - Drum / Perkusi</option>
                   </optgroup>
                   <optgroup label="Ibadah Teknis">
                     <option value="Usher">Usher / Penyambut</option>
                     <option value="Kolektan">Kolektan / Persembahan</option>
                     <option value="Multimedia">Kru Multimedia (LCD/Kamera)</option>
                   </optgroup>
                 </select>
               </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button onClick={() => setIsModalOpen(false)} disabled={isSavingPelayan} className="px-5 py-2.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-200 text-sm">
                 Batal
               </button>
               <button onClick={handleSimpanPelayan} disabled={isSavingPelayan || !formPelayan.jemaat_id} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm disabled:opacity-50 transition-all">
                 {isSavingPelayan ? <span className="material-icons-round animate-spin text-[18px]">refresh</span> : <span className="material-icons-round text-[18px]">add_circle</span>}
                 Simpan & Ikat Peran
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
