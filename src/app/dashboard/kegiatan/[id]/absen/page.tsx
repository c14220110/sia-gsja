'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function KioskAbsensiPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const id = unwrappedParams.id;

  // State Acara
  const [kegiatan, setKegiatan] = useState<any>(null);
  const [isLoadingHeader, setIsLoadingHeader] = useState(true);

  // State Log & Stats
  const [stats, setStats] = useState({ total_hadir: 0, total_jemaat: 0, total_tamu: 0, total_pelayan: 0 });
  const [logs, setLogs] = useState<any[]>([]);

  // Feedback State (Valid / Error)
  const [feedback, setFeedback] = useState<{ isVisible: boolean, type: 'success' | 'error', message: string, detail?: string }>({ isVisible: false, type: 'success', message: '' });

  // TABS State
  const [activeTab, setActiveTab] = useState<'cari' | 'tamu'>('cari');

  // Input States
  const [qrInput, setQrInput] = useState('');
  const qrInputRef = useRef<HTMLInputElement>(null);
  
  // Search Jemaat Manual State
  const [manualSearch, setManualSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Tamu Form State
  const [formTamu, setFormTamu] = useState({ nama: '', hp: '', asal: '' });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Load Header Info & Initial Stats
  useEffect(() => {
    const fetchEventInfo = async () => {
      try {
        const res = await fetch(`/api/kegiatan/${id}`);
        const data = await res.json();
        if (data.success) {
          setKegiatan(data.data);
        }
      } catch (err) {} finally {
        setIsLoadingHeader(false);
      }
    };
    fetchEventInfo();
    fetchLogs();
    
    // Set auto interval refetch logs
    const interval = setInterval(() => { fetchLogs(true); }, 5000);
    return () => clearInterval(interval);
  }, [id]);

  // Keep Autofocus on QR Input unless user holds focus in other inputs
  useEffect(() => {
    const focusQrInput = (e: MouseEvent) => {
      // Don't steal focus if user is clicking inside manual panel
      const target = e.target as HTMLElement;
      if (!target.closest('#manual-panel-container')) {
         qrInputRef.current?.focus();
      }
    };
    document.addEventListener('click', focusQrInput);
    qrInputRef.current?.focus();
    return () => document.removeEventListener('click', focusQrInput);
  }, []);

  const fetchLogs = async (silent = false) => {
    try {
      const res = await fetch(`/api/kegiatan/${id}/absensi`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data.data.stats || { total_hadir: 0, total_jemaat: 0, total_tamu: 0, total_pelayan: 0 });
          setLogs(data.data.recent_logs || []);
        }
      }
    } catch (error) {}
  };

  const triggerFeedback = (type: 'success' | 'error', message: string, detail?: string) => {
    setFeedback({ isVisible: true, type, message, detail });
    
    // Play Sound
    try {
      if (type === 'success') {
         // Create simple beep beep
         const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
         const oscillator = audioContext.createOscillator();
         oscillator.type = 'sine';
         oscillator.frequency.value = 800;
         oscillator.connect(audioContext.destination);
         oscillator.start();
         setTimeout(() => oscillator.stop(), 200);
      } else {
         const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
         const oscillator = audioContext.createOscillator();
         oscillator.type = 'sawtooth';
         oscillator.frequency.value = 200;
         oscillator.connect(audioContext.destination);
         oscillator.start();
         setTimeout(() => oscillator.stop(), 500);
      }
    } catch(e) {}

    // Hide feedback automatically after 2.5s
    setTimeout(() => {
      setFeedback(prev => ({ ...prev, isVisible: false }));
    }, 2500);
  };

  const handleQrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) return;

    const qrValue = qrInput.trim();
    setQrInput(''); // Reset immediately
    qrInputRef.current?.focus();

    try {
      const res = await fetch(`/api/kegiatan/${id}/absensi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'qr_scan', id_jemaat: qrValue })
      });
      const data = await res.json();
      
      if (data.success) {
        triggerFeedback('success', data.message, `(${data.tipe})`);
        fetchLogs();
      } else {
        triggerFeedback('error', 'GAGAL (AKSES DITOLAK)', data.message);
      }
    } catch (error) {
       triggerFeedback('error', 'SERVER ERROR', 'Periksa koneksi internet Anda.');
    }
  };

  // Debounced search Jemaat Manual
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
        if (data.success) setSearchResults(data.data);
      } catch (e) {} finally {
        setIsSearching(false);
      }
    };
    const timer = setTimeout(searchManual, 500);
    return () => clearTimeout(timer);
  }, [manualSearch]);

  const submitManualAbsen = async (jemaat_id: number, nama: string) => {
    setIsSubmittingManual(true);
    setManualSearch('');
    setSearchResults([]);
    try {
      const res = await fetch(`/api/kegiatan/${id}/absensi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'manual_jemaat', id_jemaat: jemaat_id })
      });
      const data = await res.json();
      if (data.success) {
        triggerFeedback('success', `MANUAL: ${data.message}`);
        fetchLogs();
      } else {
         alert(data.message); // Gunakan alert biasa untuk panel manual supervisor
      }
    } catch(e) { alert('Internal Error'); } finally {
      setIsSubmittingManual(false);
      qrInputRef.current?.focus(); // Balik ke scan
    }
  };

  const submitTamu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTamu.nama) return;
    setIsSubmittingManual(true);
    try {
      const res = await fetch(`/api/kegiatan/${id}/absensi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'tamu', nama_tamu: formTamu.nama, no_hp: formTamu.hp, gereja_asal: formTamu.asal })
      });
      const data = await res.json();
      if (data.success) {
        triggerFeedback('success', data.message, '(Tamu)');
        setFormTamu({ nama: '', hp: '', asal: '' });
        fetchLogs();
      } else {
        alert(data.message);
      }
    } catch(e) {} finally {
      setIsSubmittingManual(false);
      qrInputRef.current?.focus(); // Balik ke scan
    }
  };

  const formatWaktu = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (isLoadingHeader) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><span className="material-icons-round text-5xl animate-spin text-emerald-500">refresh</span></div>;

  return (
    <div className="w-full h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden font-['Inter']">
      
      {/* HEADER BAR */}
      <div className="w-full h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 shrink-0 relative z-10 shadow-md">
         <div className="flex items-center gap-4">
           <Link href="/dashboard/kegiatan" className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-slate-300 transition-colors">
              <span className="material-icons-round text-[20px]">arrow_back</span>
           </Link>
           <h1 className="text-xl font-bold tracking-wide">
             GKI KUTISARI KIOSK <span className="text-slate-500 mx-2">|</span> <span className="text-emerald-400">{kegiatan?.nama_kegiatan || 'Acara'}</span>
           </h1>
         </div>
         <div className="flex items-center gap-3">
            <span className="material-icons-round text-slate-400">how_to_reg</span>
            <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Mode Ushers Lapangan</span>
         </div>
      </div>

      {/* MAIN SPLIT SCREEN */}
      <div className="flex-1 flex w-full relative">
        
        {/* ========================================================= */}
        {/* KIRI: PANEL SCAN (60%) */}
        {/* ========================================================= */}
        <div className="w-[60%] h-full bg-slate-900 flex flex-col items-center justify-center relative px-12 pb-12 pt-8">
           
           {/* Feedback Pop-Up Overlay (Absolute) */}
           {feedback.isVisible && (
             <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md transition-all duration-300 ${feedback.type === 'success' ? 'bg-emerald-500/95 text-white' : 'bg-red-600/95 text-white'}`}>
                <span className="material-icons-round text-[120px] mb-6 drop-shadow-lg">
                  {feedback.type === 'success' ? 'check_circle' : 'cancel'}
                </span>
                <h1 className="text-5xl font-black tracking-tight text-center max-w-2xl leading-tight">
                  {feedback.message}
                </h1>
                {feedback.detail && <p className="text-2xl mt-4 font-bold opacity-80">{feedback.detail}</p>}
             </div>
           )}

           <div className="text-center mb-8 flex flex-col items-center z-10">
              <span className="material-icons-round text-[60px] text-emerald-500 mb-4 animate-bounce">qr_code_scanner</span>
              <h2 className="text-3xl font-black text-white mb-2 tracking-wide">SILAKAN PINDAI QR CODE</h2>
              <p className="text-slate-400 text-lg">Arahkan ID Card atau *Barcode Gun* pada kolom di bawah</p>
           </div>
           
           {/* Kotak Scanner Live Dummy & Input Capture */}
           <div className="relative w-full max-w-lg aspect-auto bg-slate-800 rounded-3xl border-4 border-dashed border-slate-600 flex flex-col items-center justify-center p-8 shadow-2xl z-10">
              <div className="w-16 h-16 border-t-4 border-l-4 border-emerald-500 absolute top-4 left-4 rounded-tl-xl animate-pulse"></div>
              <div className="w-16 h-16 border-t-4 border-r-4 border-emerald-500 absolute top-4 right-4 rounded-tr-xl animate-pulse"></div>
              <div className="w-16 h-16 border-b-4 border-l-4 border-emerald-500 absolute bottom-4 left-4 rounded-bl-xl animate-pulse"></div>
              <div className="w-16 h-16 border-b-4 border-r-4 border-emerald-500 absolute bottom-4 right-4 rounded-br-xl animate-pulse"></div>
              
              <form onSubmit={handleQrSubmit} className="w-full flex-col flex items-center justify-center z-20">
                <input 
                  ref={qrInputRef}
                  type="text"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  className="w-full text-center text-4xl bg-slate-900 border-2 border-emerald-500/50 rounded-xl py-6 text-white tracking-widest focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 shadow-inner"
                  placeholder="ID JEMAAT..."
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" className="hidden">Submit Hidden</button>
              </form>
              <p className="mt-6 text-slate-500 font-medium text-sm text-center">Tembakan instrumen laser Infrared (Gun) secara diam-diam bertindak sebagai penekanan *Enter* otomatis.</p>
           </div>
        </div>

        {/* ========================================================= */}
        {/* KANAN: PANEL MANUAL (40%) */}
        {/* ========================================================= */}
        <div id="manual-panel-container" className="flex-1 bg-white flex flex-col border-l border-slate-200">
          
          {/* STATISTIK HEADER */}
          <div className="w-full p-6 bg-slate-50 flex flex-col gap-4 border-b border-slate-200 shrink-0">
             <div className="w-full flex justify-between items-end">
                <div>
                   <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Status Kehadiran Realtime</p>
                   <h2 className="text-slate-900 text-4xl font-black font-['Public_Sans'] leading-tight">{stats.total_hadir} <span className="text-lg text-slate-500 font-bold">Jiwa</span></h2>
                </div>
                <div className="flex gap-2 text-xs font-bold font-['Public_Sans']">
                  <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg shadow-sm">Jemaat: {stats.total_jemaat}</div>
                  <div className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg shadow-sm">Tamu: {stats.total_tamu}</div>
                </div>
             </div>
          </div>

          {/* TAB NAVS */}
          <div className="w-full flex border-b border-slate-200 shrink-0">
            <button onClick={() => setActiveTab('cari')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider border-b-4 transition-colors ${activeTab === 'cari' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
              Cari Jemaat GSJA
            </button>
            <button onClick={() => setActiveTab('tamu')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider border-b-4 transition-colors ${activeTab === 'tamu' ? 'border-amber-500 text-amber-700 bg-amber-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
              Registrasi Tamu Baru
            </button>
          </div>

          {/* TAB CONTENTS */}
          <div className="w-full p-6 bg-white shrink-0 shadow-sm z-20">
             {activeTab === 'cari' && (
               <div className="flex flex-col gap-4">
                 <div className="relative">
                   <span className="material-icons-round absolute left-4 top-3.5 text-slate-400">search</span>
                   <input 
                     type="text" 
                     placeholder="Ketik minimal 3 huruf nama jemaat..." 
                     value={manualSearch}
                     onChange={(e) => setManualSearch(e.target.value)}
                     className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                   />
                 </div>
                 
                 {/* Hasil Search Box */}
                 {(searchResults.length > 0 || isSearching) && (
                   <div className="w-full max-h-60 overflow-y-auto border border-blue-100 rounded-xl mt-1 shadow-md bg-white">
                     {isSearching ? (
                        <div className="p-4 text-slate-500 text-center text-sm font-medium">Mencari...</div>
                     ) : (
                       searchResults.map((jem) => (
                         <div key={jem.id} className="w-full p-3 flex justify-between items-center hover:bg-blue-50 border-b border-blue-50/50 last:border-0 transition-colors cursor-pointer" onClick={() => submitManualAbsen(jem.id, jem.nama_lengkap)}>
                           <div className="flex flex-col">
                             <span className="text-slate-800 font-bold text-sm tracking-tight">{jem.nama_lengkap}</span>
                             <span className="text-slate-500 text-xs font-medium">{jem.nama_satelit}</span>
                           </div>
                           <button className="px-3 py-1.5 bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 text-xs font-bold rounded-lg transition-colors shadow-sm">
                             Hadirkan
                           </button>
                         </div>
                       ))
                     )}
                   </div>
                 )}
               </div>
             )}

             {activeTab === 'tamu' && (
               <form onSubmit={submitTamu} className="flex flex-col gap-3">
                 <div className="flex flex-col gap-1.5">
                   <input type="text" value={formTamu.nama} onChange={e => setFormTamu({...formTamu, nama: e.target.value})} placeholder="Nama Lengkap (Wajib)" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-medium focus:outline-none focus:border-amber-500 focus:bg-white" />
                 </div>
                 <div className="flex gap-3">
                    <input type="text" value={formTamu.hp} onChange={e => setFormTamu({...formTamu, hp: e.target.value})} placeholder="No Handphone" className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-medium focus:outline-none focus:border-amber-500 focus:bg-white" />
                    <input type="text" value={formTamu.asal} onChange={e => setFormTamu({...formTamu, asal: e.target.value})} placeholder="Gereja Asal" className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm font-medium focus:outline-none focus:border-amber-500 focus:bg-white" />
                 </div>
                 <button type="submit" disabled={isSubmittingManual || !formTamu.nama} className="w-full py-2.5 mt-2 bg-slate-800 hover:bg-slate-900 focus:ring-4 focus:ring-slate-300 disabled:opacity-50 text-white font-bold rounded-lg transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                   <span className="material-icons-round text-[18px]">how_to_reg</span> Daftarkan Kehadiran Tamu
                 </button>
               </form>
             )}
          </div>

          {/* LOG HISTORI (Fills remaining height) */}
          <div className="flex-1 bg-slate-100 p-6 flex flex-col gap-3 overflow-hidden relative">
             <div className="w-full h-8 absolute top-0 inset-x-0 bg-gradient-to-b from-slate-100 to-transparent z-10"></div>
             <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] relative z-20 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Histori Transaksi Live
             </p>
             
             <div className="w-full h-full overflow-y-auto flex flex-col gap-2 relative z-20 pr-2">
                {logs.length === 0 ? (
                  <p className="text-slate-400 text-sm italic py-4">Belum ada kehadiran tercatat.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="w-full p-3 bg-white border border-slate-200 shadow-sm rounded-xl flex items-center justify-between animate-in slide-in-from-left-2 fade-in duration-300">
                       <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.metode === 'QR Code' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                           <span className="material-icons-round text-[16px]">
                             {log.metode === 'QR Code' ? 'qr_code_2' : 'keyboard'}
                           </span>
                         </div>
                         <div className="flex flex-col">
                           <span className="text-slate-800 font-bold text-sm tracking-tight">{log.nama}</span>
                           <span className="text-slate-500 text-[10px] font-bold uppercase">{log.jenis} / Via {log.metode}</span>
                         </div>
                       </div>
                       <div className="text-slate-400 text-xs font-bold font-['Liberation_Mono'] tracking-wide">
                          {formatWaktu(log.waktu_hadir)}
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
