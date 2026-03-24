'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function AbsensiSusulanPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const id = unwrappedParams.id;

  const [isLoadingHeader, setIsLoadingHeader] = useState(true);
  const [kegiatan, setKegiatan] = useState<any>(null);
  
  const [stats, setStats] = useState({ total_hadir: 0, total_jemaat: 0, total_tamu: 0, total_pelayan: 0 });
  const [logs, setLogs] = useState<any[]>([]);

  // Search & Form States
  const [manualSearch, setManualSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedJemaat, setSelectedJemaat] = useState<{ id: number, nama: string, satelit: string } | null>(null);
  const [roleManual, setRoleManual] = useState('Jemaat');

  const [formTamu, setFormTamu] = useState({ nama: '', hp: '', asal: '' });
  
  // Submit Overlay State
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  useEffect(() => {
    const initData = async () => {
      try {
        const [resKeg, resLog] = await Promise.all([
          fetch(`/api/kegiatan/${id}`),
          fetch(`/api/kegiatan/${id}/absensi?limit=all`)
        ]);
        
        if (resKeg.ok) {
           const dK = await resKeg.json();
           if (dK.success) setKegiatan(dK.data);
        }
        if (resLog.ok) {
           const dL = await resLog.json();
           if (dL.success) {
              setStats(dL.data.stats || { total_hadir: 0, total_jemaat: 0, total_tamu: 0, total_pelayan: 0 });
              setLogs(dL.data.recent_logs || []);
           }
        }
      } catch (e) {} finally {
        setIsLoadingHeader(false);
      }
    };
    initData();
  }, [id]);

  const refreshLogs = async () => {
    try {
      const resLog = await fetch(`/api/kegiatan/${id}/absensi?limit=all`);
      if (resLog.ok) {
         const dL = await resLog.json();
         if (dL.success) {
            setStats(dL.data.stats || { total_hadir: 0, total_jemaat: 0, total_tamu: 0, total_pelayan: 0 });
            setLogs(dL.data.recent_logs || []);
         }
      }
    } catch (e) {}
  };

  // Debounced Jemaat Search
  useEffect(() => {
    const searchManual = async () => {
      if (manualSearch.length < 3) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(manualSearch)}`);
        const data = await res.json();
        if (data.success) {
           // Exclude if already picked
           setSearchResults(data.data.filter((j: any) => j.id !== selectedJemaat?.id));
        }
      } catch (e) {} finally {
        setIsSearching(false);
      }
    };
    const timer = setTimeout(searchManual, 300);
    return () => clearTimeout(timer);
  }, [manualSearch, selectedJemaat]);

  const submitInternalJemaat = async () => {
     if (!selectedJemaat) return;
     setSubmitState({ status: 'loading', message: 'Merekam kehadiran internal...' });
     try {
       const res = await fetch(`/api/kegiatan/${id}/absensi`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ 
           action_type: 'manual_jemaat', 
           id_jemaat: selectedJemaat.id,
           role_kehadiran: roleManual
         })
       });
       const data = await res.json();
       if (data.success) {
         setSubmitState({ status: 'success', message: `Berhasil menambahkan kehadiran: ${data.nama_lengkap}` });
         setSelectedJemaat(null);
         setManualSearch('');
         setRoleManual('Jemaat');
         refreshLogs();
       } else {
         setSubmitState({ status: 'error', message: data.message });
       }
     } catch (e) {
       setSubmitState({ status: 'error', message: 'Koneksi ke server gagal.' });
     }
  };

  const submitTamuSekarang = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!formTamu.nama) return;
     setSubmitState({ status: 'loading', message: 'Menyimpan tamu eksternal...' });
     try {
       const res = await fetch(`/api/kegiatan/${id}/absensi`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ action_type: 'tamu', nama_tamu: formTamu.nama, no_hp: formTamu.hp, gereja_asal: formTamu.asal })
       });
       const data = await res.json();
       if (data.success) {
         setSubmitState({ status: 'success', message: `${data.message}` });
         setFormTamu({ nama: '', hp: '', asal: '' });
         refreshLogs();
       } else {
         setSubmitState({ status: 'error', message: data.message });
       }
     } catch(e) {
       setSubmitState({ status: 'error', message: 'Koneksi gagal.' });
     }
  };

  const formatWaktu = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (isLoadingHeader) return <div className="h-[70vh] flex items-center justify-center text-slate-800"><span className="material-icons-round text-5xl animate-spin text-blue-600">refresh</span></div>;

  return (
    <div className="w-full flex flex-col gap-6 pb-10 font-['Inter']">
      
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        onClose={() => setSubmitState({ status: 'idle', message: '' })} 
      />

      {/* Breadcrumb & Title Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
          <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
            <Link href="/dashboard/kegiatan" className="text-slate-500 hover:text-blue-600">Modul Kegiatan</Link>
            <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
            <Link href="/dashboard/kegiatan" className="text-slate-500 hover:text-blue-600">Daftar Kegiatan</Link>
            <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
            <span className="text-slate-700 font-bold">Absensi Susulan (Back-Office)</span>
          </div>
          <div className="self-stretch flex flex-col md:flex-row md:justify-between items-start md:items-end gap-4">
            <div className="inline-flex flex-col justify-start items-start">
              <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">{kegiatan?.nama_kegiatan || 'Acara GSJA'}</h1>
              <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 flex gap-1">
                <span className="material-icons-round text-[18px]">how_to_reg</span>
                <span className="uppercase tracking-widest text-xs font-bold my-auto ml-1">Input Kehadiran Manual</span>
              </div>
            </div>
            
            <div className="flex gap-2 text-xs font-bold font-['Public_Sans'] px-4 py-3 bg-slate-100/50 rounded-xl border border-slate-200/60 shadow-sm shrink-0">
               <span className="text-slate-500 uppercase tracking-widest mr-2 my-auto text-[10px]">TOTAL KEHADIRAN:</span>
               <div className="px-3 py-1 bg-white text-slate-800 rounded-md shadow-sm border border-slate-200/60">{stats.total_hadir} Jiwa</div>
            </div>
          </div>
      </div>

      {/* Tabs / Separator Indicator */}
      <div className="w-full border-b border-slate-200 inline-flex justify-start items-start gap-8 px-1">
          <div className="px-2 py-3 border-b-2 border-slate-700 inline-flex flex-col justify-center items-center cursor-default">
            <span className="text-sm font-bold font-['Inter'] leading-5 text-slate-700">Form Absensi & Daftar Hadir</span>
          </div>
      </div>

      {/* Content Area */}
      <div className="w-full flex flex-col justify-start items-start gap-8 mt-2">
         
         {/* DUAL PANELS GRID (50:50) */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            
            {/* PANEL KIRI: JEMAAT GSJA */}
            <div className="p-6 md:p-8 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6 relative overflow-visible">
               <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                     <span className="material-icons-round">contact_mail</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">Tambah Jemaat Terdaftar</h2>
                    <p className="text-slate-500 text-xs">Berdasarkan basis data Jemaat GKI Pusat & Satelit</p>
                  </div>
               </div>

               {selectedJemaat ? (
                 <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                       <div className="flex flex-col">
                          <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Jemaat Terpilih:</span>
                          <span className="text-sm font-black text-slate-800">{selectedJemaat.nama}</span>
                          <span className="text-xs text-slate-500">{selectedJemaat.satelit}</span>
                       </div>
                       <button onClick={() => setSelectedJemaat(null)} className="w-8 h-8 rounded-full bg-white text-rose-500 shadow-sm border border-rose-100 hover:bg-rose-50 flex items-center justify-center transition-colors">
                          <span className="material-icons-round text-lg">close</span>
                       </button>
                    </div>

                    <div className="flex flex-col gap-1.5 focus-within:relative z-[50]">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Role Kehadiran</label>
                      <select 
                        value={roleManual}
                        onChange={(e) => setRoleManual(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-medium focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                        style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px' }}
                      >
                         <option value="Jemaat">Jemaat (Peserta Umum)</option>
                         <option value="Worship Leader">Worship Leader</option>
                         <option value="Singer">Singer / Backing Vocal</option>
                         <option value="Pemusik">Pemusik</option>
                         <option value="Usher">Usher / Greeter</option>
                         <option value="Kolektan">Kolektan</option>
                         <option value="Multimedia">Multimedia / Sound</option>
                         <option value="Pengkhotbah">Pengkhotbah / Pendeta</option>
                         <option value="Pengerja Lainnya">Pengerja Lainnya</option>
                      </select>
                    </div>

                    <button onClick={submitInternalJemaat} disabled={submitState.status === 'loading'} className="w-full mt-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider group disabled:opacity-70 disabled:cursor-not-allowed">
                       <span className="material-icons-round text-lg group-hover:scale-110 transition-transform">add_circle</span> Simpan Kehadiran Jemaat
                    </button>
                 </div>
               ) : (
                 <div className="flex flex-col gap-4 text-sm relative">
                    <div className="flex flex-col gap-1.5 focus-within:relative z-[50]">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cari Nama Jemaat</label>
                      <div className="relative">
                         <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                         <input 
                           type="text" 
                           placeholder="Ketik sebagian nama jemaat terdaftar..." 
                           value={manualSearch}
                           onChange={(e) => setManualSearch(e.target.value)}
                           className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                         />
                      </div>
                    </div>
                    
                    {(searchResults.length > 0 || isSearching) && (
                      <div className="absolute top-[76px] left-0 right-0 max-h-56 overflow-y-auto border border-slate-200 rounded-xl shadow-lg bg-white z-[60]">
                        {isSearching ? (
                           <div className="p-4 text-slate-500 text-center text-xs font-medium bg-slate-50/50">Memuat silang data jemaat...</div>
                        ) : (
                          searchResults.map((jem) => (
                            <div key={jem.id} className="w-full p-3 flex justify-between items-center hover:bg-slate-50 border-b border-slate-100 transition-colors cursor-pointer group" onClick={() => setSelectedJemaat({ id: jem.id, nama: jem.nama_lengkap, satelit: jem.nama_satelit })}>
                              <div className="flex flex-col">
                                <span className="text-slate-800 font-bold text-sm tracking-tight">{jem.nama_lengkap}</span>
                                <span className="text-slate-500 text-xs font-medium">{jem.nama_satelit}</span>
                              </div>
                              <span className="material-icons-round text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">checklist</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    <div className="pt-8 flex flex-col items-center justify-center text-center opacity-60">
                        <span className="material-icons-round text-5xl text-slate-300 mb-2">person_search</span>
                        <p className="text-xs text-slate-500 max-w-[250px]">Gunakan fitur pencarian untuk menambahkan anggota GSJA ber-ID ke dalam buku tamu secara manual.</p>
                    </div>
                 </div>
               )}
            </div>

            {/* PANEL KANAN: TAMU BARU */}
            <div className="p-6 md:p-8 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6">
               <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                     <span className="material-icons-round">person_add</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">Input Tamu / Jiwa Baru</h2>
                    <p className="text-slate-500 text-xs">Penyalinan dari formulir kertas atau pendaftaran *on the spot*</p>
                  </div>
               </div>

               <form onSubmit={submitTamuSekarang} className="flex flex-col gap-4 text-sm">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap Tamu <span className="text-rose-500">*</span></label>
                     <input 
                       type="text" 
                       value={formTamu.nama} 
                       onChange={e => setFormTamu({...formTamu, nama: e.target.value})} 
                       placeholder="Sesuai formulir/buku tamu..." 
                       required 
                       className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" 
                     />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">No Hanphone / WA</label>
                        <input 
                          type="text" 
                          value={formTamu.hp} 
                          onChange={e => setFormTamu({...formTamu, hp: e.target.value})} 
                          placeholder="Opsional (Untuk Follow-up)" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" 
                        />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gereja / Daerah Asal</label>
                        <input 
                          type="text" 
                          value={formTamu.asal} 
                          onChange={e => setFormTamu({...formTamu, asal: e.target.value})} 
                          placeholder="Opsional (Luar GSJA)" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" 
                        />
                     </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                     <p className="text-[10px] text-slate-400 italic flex-1 mr-4">Data ini akan dicatat tanpa ID Jemaat (Anonymous Guest).</p>
                     <button 
                       type="submit" 
                       disabled={submitState.status === 'loading' || !formTamu.nama} 
                       className="py-3 px-6 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 focus:ring-4 focus:ring-slate-300 text-white font-bold rounded-xl transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm shrink-0"
                     >
                       <span className="material-icons-round text-lg">person_add</span> Simpan Tamu
                     </button>
                  </div>
               </form>
            </div>

         </div>

         {/* DATA GRID PENUH */}
         <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                 <h2 className="text-lg font-black text-slate-800">Tabel Daftar Kehadiran ({logs.length})</h2>
                 <p className="text-slate-500 text-xs mt-0.5">Mencakup kehadiran via Kiosk QR & manual.</p>
               </div>
            </div>

            <div className="w-full overflow-x-auto">
               <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                     <tr className="bg-slate-50/50 border-b border-slate-200">
                        <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50/50 w-16 text-center">No</th>
                        <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50/50">Nama Peserta / Tamu</th>
                        <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50/50">Kategori Role</th>
                        <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50/50">Metode Integrasi</th>
                        <th className="py-3 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50/50 text-right">Waktu Absen</th>
                     </tr>
                  </thead>
                  <tbody>
                     {logs.length === 0 ? (
                        <tr>
                           <td colSpan={5} className="py-12 text-center">
                              <span className="material-icons-round text-5xl text-slate-200 mb-3 block">assignment_ind</span>
                              <p className="text-slate-500 font-medium text-sm">Belum ada data absensi untuk kegiatan ini.</p>
                           </td>
                        </tr>
                     ) : (
                        logs.map((log, index) => (
                          <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                             <td className="py-3 px-6 text-sm text-slate-500 font-medium text-center">{index + 1}</td>
                             <td className="py-3 px-6">
                                <span className="text-slate-800 font-bold text-sm tracking-tight">{log.nama}</span>
                             </td>
                             <td className="py-3 px-6">
                                <span className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider 
                                  ${log.jenis === 'Tamu' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                    log.jenis === 'Jemaat' ? 'bg-slate-100 text-slate-600 border-slate-200' : 
                                    'bg-indigo-50 text-indigo-700 border-indigo-200'}`}
                                >
                                  {log.jenis}
                                </span>
                             </td>
                             <td className="py-3 px-6">
                                <span className={`flex items-center gap-1.5 text-xs font-bold
                                  ${log.metode === 'QR Code' ? 'text-emerald-600' : 'text-slate-500'}`}
                                >
                                  <span className="material-icons-round text-[14px]">
                                    {log.metode === 'QR Code' ? 'qr_code_2' : 'keyboard'}
                                  </span>
                                  {log.metode === 'QR Code' ? 'Aplikasi HP GSJA' : 'Back-Office / Usher'}
                                </span>
                             </td>
                             <td className="py-3 px-6 text-right text-xs font-bold font-['Liberation_Mono'] tracking-wide text-slate-500">
                                {formatWaktu(log.waktu_hadir)}
                             </td>
                          </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>

      </div>
    </div>
  );
}
