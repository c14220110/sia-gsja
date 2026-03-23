'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';

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

  // TABS State (Panel Kanan)
  const [activeTab, setActiveTab] = useState<'cari' | 'tamu'>('cari');

  // Search Jemaat Manual State
  const [manualSearch, setManualSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Tamu Form State
  const [formTamu, setFormTamu] = useState({ nama: '', hp: '', asal: '' });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // ==========================================
  // KIOSK DYNAMIC QR STATE
  // ==========================================
  const [sessionActive, setSessionActive] = useState(false);
  const [rotateSeconds, setRotateSeconds] = useState(15);
  const [durationMinutes, setDurationMinutes] = useState(30);
  
  const [qrPayload, setQrPayload] = useState('');
  const [sessionEndMs, setSessionEndMs] = useState<number | null>(null);
  
  const [timeLeftStr, setTimeLeftStr] = useState('00:00');
  const [rotateProgress, setRotateProgress] = useState(100);

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

  // Handle Session & Rotation Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let rotationStartMs: number;

    if (sessionActive && sessionEndMs) {
      // Function to generate new secure QR payload
      const generateNewQR = () => {
         const payload = JSON.stringify({
            k: id,
            ts: Date.now(),
            exp: Date.now() + (rotateSeconds * 1000)
         });
         // In real prod, this payload is encrypted (e.g JWT or AES). Here encoded to base64.
         setQrPayload(btoa(payload));
         rotationStartMs = Date.now();
      };
      
      generateNewQR();

      timer = setInterval(() => {
        const now = Date.now();
        
        // 1. Check Session Expiration
        if (now >= sessionEndMs) {
           setSessionActive(false);
           setQrPayload('');
           alert("Sesi absensi telah berakhir secara otomatis.");
           return;
        }

        // 2. Update Session Time Left String
        const diffSeconds = Math.floor((sessionEndMs - now) / 1000);
        const m = Math.floor(diffSeconds / 60).toString().padStart(2, '0');
        const s = (diffSeconds % 60).toString().padStart(2, '0');
        setTimeLeftStr(`${m}:${s}`);

        // 3. Update Rotation Progress
        const msSinceRotation = now - rotationStartMs;
        const rotateDurationMs = rotateSeconds * 1000;
        
        if (msSinceRotation >= rotateDurationMs) {
           // Time to rotate
           generateNewQR();
           setRotateProgress(100);
        } else {
           const percent = Math.max(0, 100 - (msSinceRotation / rotateDurationMs) * 100);
           setRotateProgress(percent);
        }
      }, 100); // 100ms interval for smooth progress bar
    }

    return () => {
       if (timer) clearInterval(timer);
    };
  }, [sessionActive, sessionEndMs, rotateSeconds, id]);

  const handleStartSession = () => {
     setSessionEndMs(Date.now() + (durationMinutes * 60 * 1000));
     setSessionActive(true);
  };

  const handleStopSession = () => {
     if (confirm('Apakah Anda yakin ingin menutup sesi absensi saat ini?')) {
       setSessionActive(false);
       setQrPayload('');
     }
  };

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
    }
  };

  const formatWaktu = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (isLoadingHeader) return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-800"><span className="material-icons-round text-5xl animate-spin text-blue-600">refresh</span></div>;

  return (
    <div className="w-full h-screen bg-white text-slate-800 flex flex-col overflow-hidden font-['Inter']">
      
      {/* HEADER BAR - Enterprise Soft (Mirip Dashboard GSJA) */}
      <div className="w-full h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 relative z-10 shadow-sm">
         <div className="flex items-center gap-4">
           <Link href="/dashboard/kegiatan" className="w-10 h-10 border border-slate-200 hover:bg-slate-50 rounded-full flex items-center justify-center text-slate-500 transition-colors">
              <span className="material-icons-round text-[20px]">arrow_back</span>
           </Link>
           <h1 className="text-xl font-bold tracking-tight text-slate-800">
             Absensi Dinamis <span className="text-slate-300 mx-2">|</span> <span className="text-blue-600 font-medium">{kegiatan?.nama_kegiatan || 'Acara GSJA'}</span>
           </h1>
         </div>
         <div className="flex items-center gap-3">
            <span className="material-icons-round text-slate-400">qr_code_scanner</span>
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Mode Kiosk Terpusat</span>
         </div>
      </div>

      {/* MAIN SPLIT SCREEN */}
      <div className="flex-1 flex w-full relative">
        
        {/* ========================================================= */}
        {/* KIRI: PANEL DYNAMIC QR (60%) */}
        {/* ========================================================= */}
        <div className="w-[60%] h-full bg-slate-50/50 flex flex-col relative">
           
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

           {!sessionActive ? (
              // ------------------------------------
              // SETUP SESI STATE
              // ------------------------------------
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                 <div className="w-full max-w-lg bg-white p-10 rounded-3xl shadow-xl border border-slate-100 flex flex-col gap-8">
                    <div className="text-center">
                       <span className="material-icons-round text-[48px] text-blue-500 mb-3">settings_suggest</span>
                       <h2 className="text-2xl font-black text-slate-800 tracking-tight">Pengaturan Sesi Absensi</h2>
                       <p className="text-slate-500 mt-1">Konfigurasikan panel rotasi QR Code untuk mencegah duplikasi atau kecurangan absen jarak jauh.</p>
                    </div>

                    <div className="flex flex-col gap-6">
                       <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Interval Rotasi Barcode</label>
                          <div className="flex gap-3">
                             {[15, 30, 45].map(sec => (
                               <button 
                                 key={`sec-${sec}`}
                                 onClick={() => setRotateSeconds(sec)}
                                 className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${rotateSeconds === sec ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                               >
                                 {sec} Detik
                               </button>
                             ))}
                          </div>
                       </div>

                       <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Batas Durasi Sesi</label>
                          <div className="flex gap-3">
                             {[15, 30, 45, 60].map(min => (
                               <button 
                                 key={`min-${min}`}
                                 onClick={() => setDurationMinutes(min)}
                                 className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${durationMinutes === min ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                               >
                                 {min} Menit
                               </button>
                             ))}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">Sesi akan otomatis tertutup saat *timer* habis untuk mengamankan data.</p>
                       </div>
                    </div>

                    <div className="pt-2">
                       <button onClick={handleStartSession} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg tracking-wide rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2">
                          <span className="material-icons-round">qr_code_scanner</span> Mulai Transmisikan QR
                       </button>
                    </div>
                 </div>
              </div>
           ) : (
              // ------------------------------------
              // ACTIVE SESSION STATE
              // ------------------------------------
              <div className="flex-1 flex flex-col items-center justify-center p-12 relative animate-in fade-in duration-500">
                 
                 <div className="absolute top-8 left-8 flex items-center gap-3 px-5 py-2.5 bg-white rounded-full shadow-sm border border-slate-200">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-slate-700 font-bold text-sm tracking-wide">Sesi Terbuka — {timeLeftStr}</span>
                 </div>

                 <button onClick={handleStopSession} className="absolute top-8 right-8 flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full border border-rose-200 transition-colors shadow-sm font-bold text-sm tracking-wide">
                    <span className="material-icons-round text-[18px]">stop_circle</span> Tutup Sesi
                 </button>

                 <div className="text-center mb-8 flex flex-col items-center">
                    <h2 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">PINDAI UNTUK HADIR</h2>
                    <p className="text-slate-500 text-lg">Gunakan fitur Kamera / Scan di Aplikasi GSJA Smartphone Anda</p>
                 </div>
                 
                 {/* QR CODE DISPLAY */}
                 <div className="relative p-2 bg-white rounded-3xl shadow-2xl border border-slate-100 mt-2">
                    {/* Progress Bar Top */}
                    <div className="absolute -top-6 left-0 right-0 h-2 bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 transition-all duration-100 ease-linear rounded-full" style={{ width: `${rotateProgress}%` }}></div>
                    </div>
                    
                    <div className="p-4 border-4 border-slate-100 rounded-2xl flex items-center justify-center relative">
                       {qrPayload ? (
                          <div className="animate-in fade-in zoom-in-95 duration-300">
                            <QRCode value={qrPayload} size={350} level="H" />
                          </div>
                       ) : (
                          <div className="w-[350px] h-[350px] flex items-center justify-center bg-slate-50">
                             <span className="material-icons-round text-slate-300 text-[64px] animate-spin">refresh</span>
                          </div>
                       )}
                    </div>

                    <p className="absolute -bottom-10 left-0 right-0 text-center text-sm font-bold text-slate-400">
                       QR akan diperbarui dalam {Math.ceil((rotateProgress / 100) * rotateSeconds)} detik
                    </p>
                 </div>
              </div>
           )}
        </div>

        {/* ========================================================= */}
        {/* KANAN: PANEL MANUAL (40%) */}
        {/* ========================================================= */}
        <div id="manual-panel-container" className="flex-1 bg-white flex flex-col border-l border-slate-200 shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-20">
          
          {/* STATISTIK HEADER */}
          <div className="w-full p-6 bg-slate-50 flex flex-col gap-4 border-b border-slate-200 shrink-0">
             <div className="w-full flex justify-between items-end">
                <div>
                   <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Status Kehadiran Realtime</p>
                   <h2 className="text-slate-900 text-4xl font-black font-['Public_Sans'] leading-tight">{stats.total_hadir} <span className="text-lg text-slate-500 font-bold">Jiwa</span></h2>
                </div>
                <div className="flex gap-2 text-xs font-bold font-['Public_Sans']">
                  <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg shadow-sm border border-blue-200">Jemaat: {stats.total_jemaat}</div>
                  <div className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg shadow-sm border border-emerald-200">Tamu: {stats.total_tamu}</div>
                </div>
             </div>
          </div>

          {/* TAB NAVS */}
          <div className="w-full flex border-b border-slate-200 shrink-0 bg-white">
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
                     className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                   />
                 </div>
                 
                 {/* Hasil Search Box */}
                 {(searchResults.length > 0 || isSearching) && (
                   <div className="w-full max-h-60 overflow-y-auto border border-blue-200 rounded-xl mt-1 shadow-lg bg-white relative z-50">
                     {isSearching ? (
                        <div className="p-4 text-slate-500 text-center text-sm font-medium">Mencari...</div>
                     ) : (
                       searchResults.map((jem) => (
                         <div key={jem.id} className="w-full p-3 flex justify-between items-center hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors cursor-pointer" onClick={() => submitManualAbsen(jem.id, jem.nama_lengkap)}>
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
                   <input type="text" value={formTamu.nama} onChange={e => setFormTamu({...formTamu, nama: e.target.value})} placeholder="Nama Lengkap (Wajib)" required className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all" />
                 </div>
                 <div className="flex gap-3">
                    <input type="text" value={formTamu.hp} onChange={e => setFormTamu({...formTamu, hp: e.target.value})} placeholder="No Hanphone" className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all" />
                    <input type="text" value={formTamu.asal} onChange={e => setFormTamu({...formTamu, asal: e.target.value})} placeholder="Gereja Asal" className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all" />
                 </div>
                 <button type="submit" disabled={isSubmittingManual || !formTamu.nama} className="w-full py-2.5 mt-2 bg-slate-800 hover:bg-slate-900 focus:ring-4 focus:ring-slate-300 disabled:opacity-50 text-white font-bold rounded-lg transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md">
                   <span className="material-icons-round text-[18px]">how_to_reg</span> Daftarkan Kehadiran Tamu
                 </button>
               </form>
             )}
          </div>

          {/* LOG HISTORI (Fills remaining height) */}
          <div className="flex-1 bg-slate-50 p-6 flex flex-col gap-3 overflow-hidden relative border-t border-slate-200">
             <div className="w-full h-8 absolute top-0 inset-x-0 bg-gradient-to-b from-slate-50 to-transparent z-10"></div>
             <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] relative z-20 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Histori Transaksi Live
             </p>
             
             <div className="w-full h-full overflow-y-auto flex flex-col gap-2 relative z-20 pr-2 pb-4">
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
