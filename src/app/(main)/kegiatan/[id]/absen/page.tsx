'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { Scanner } from '@yudiel/react-qr-scanner';
import { AlertModal } from '@/components/ui/AlertModal';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

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

  // Scanner Usher State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [usherToast, setUsherToast] = useState<{ visible: boolean, type: 'success' | 'error', message: string }>({ visible: false, type: 'success', message: '' });

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

  // UX states (Fullscreen, Loaders)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCloseAlert, setShowCloseAlert] = useState(false);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

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

  const handleStopSession = () => setShowCloseAlert(true);

  const confirmStopSession = () => {
     setShowCloseAlert(false);
     setSubmitState({ status: 'loading', message: 'Tutup Sesi sedang diproses...' });
     // Animasi Lottie Loading -> Sukses
     setTimeout(() => {
       setSessionActive(false);
       setQrPayload('');
       setIsFullscreen(false);
       setSubmitState({ status: 'success', message: 'Sesi Absensi telah berhasil ditutup!' });
     }, 1200);
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

  const submitManualAbsen = async (jemaat_id: number | string, nama: string = 'Jemaat') => {
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

  const handleUsherScan = async (detectedCodes: any[]) => {
    if (!detectedCodes || detectedCodes.length === 0 || isProcessingScan) return;
    const rawValue = detectedCodes[0].rawValue;
    if (!rawValue) return;

    setIsProcessingScan(true);
    try {
      // Jemaat QR code payload is either a number (jemaat_nomor) or jemaat_id
      const res = await fetch(`/api/kegiatan/${id}/absensi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'manual_jemaat', id_jemaat: rawValue })
      });
      const data = await res.json();
      
      setIsScannerOpen(false); // Tutup scanner otomatis jika scan dibaca

      const toastType = data.success ? 'success' : 'error';
      const toastMsg = data.success ? data.message : (data.message || 'Gagal memindai');
      setUsherToast({ visible: true, type: toastType, message: toastMsg });
      setTimeout(() => setUsherToast(prev => ({ ...prev, visible: false })), 3000);
      if (data.success) fetchLogs();
    } catch (e) {
      setUsherToast({ visible: true, type: 'error', message: 'Koneksi Error' });
      setTimeout(() => setUsherToast(prev => ({ ...prev, visible: false })), 3000);
    } finally {
      setTimeout(() => setIsProcessingScan(false), 2000); // cooldown 2 detik
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

  if (isLoadingHeader) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800"><span className="material-icons-round text-5xl animate-spin text-blue-600">refresh</span></div>;

  return (
    <div className="w-full min-h-[calc(100vh-64px)] lg:h-screen lg:min-h-screen bg-slate-50 text-slate-800 flex flex-col lg:overflow-hidden font-['Inter']">
      
      <AlertModal
        isOpen={showCloseAlert}
        title="Tutup Sesi Absensi?"
        message="Anda akan mengakhiri tayangan sesi pendaftaran ini. Anda masih tetap dapat melihat riwayat atau membuka sesi yang baru kapanpun setelah ini."
        onConfirm={confirmStopSession}
        onCancel={() => setShowCloseAlert(false)}
        confirmText="Tutup Sesi Sekarang"
        cancelText="Batal"
      />
      
      <SubmitOverlay 
        status={submitState.status} 
        message={submitState.message} 
        onClose={() => setSubmitState({ status: 'idle', message: '' })} 
      />

      {/* FULLSCREEN QR OVERLAY */}
      {isFullscreen && sessionActive && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-4 md:p-8 animate-in zoom-in-95 duration-300 overflow-y-auto">
           <button onClick={() => setIsFullscreen(false)} className="absolute top-4 md:top-8 right-4 md:right-8 w-12 h-12 md:w-14 md:h-14 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center transition-colors shadow-sm cursor-pointer hover:scale-105">
              <span className="material-icons-round text-2xl md:text-3xl">fullscreen_exit</span>
           </button>
           
           <div className="text-center mb-6 md:mb-10 flex flex-col items-center max-w-3xl mt-12 md:mt-0">
              {kegiatan?.nama_kegiatan && <div className="px-4 py-1.5 md:py-2 bg-blue-50/80 backdrop-blur-sm border border-blue-200 text-blue-700 rounded-full text-sm md:text-lg font-bold tracking-widest uppercase mb-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">{kegiatan.nama_kegiatan}</div>}
              <h2 className="text-3xl sm:text-4xl md:text-[54px] font-black text-slate-900 mb-3 md:mb-5 tracking-tight leading-tight">PINDAI UNTUK HADIR</h2>
              <p className="text-slate-500 text-lg md:text-2xl font-medium">Gunakan fitur Kamera / Scan di Aplikasi GSJA Smartphone Anda</p>
           </div>
           
           <div className="relative p-3 md:p-5 bg-white rounded-3xl md:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 max-w-full">
              <div className="absolute -top-5 md:-top-7 left-0 right-0 h-3 md:h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner flex border border-slate-200/50">
                 <div className="h-full bg-blue-500 transition-all duration-100 ease-linear rounded-full" style={{ width: `${rotateProgress}%` }}></div>
              </div>
              
              <div className="p-4 md:p-8 border-4 border-slate-100 rounded-2xl md:rounded-[32px] flex items-center justify-center relative bg-white">
                 {qrPayload ? (
                    <div className="animate-in fade-in zoom-in-95 duration-300 w-full max-w-[420px] aspect-square flex items-center justify-center">
                      <QRCode value={qrPayload} style={{ height: "auto", maxWidth: "100%", width: "100%" }} size={420} level="H" />
                    </div>
                 ) : (
                    <div className="w-64 h-64 md:w-[420px] md:h-[420px] flex items-center justify-center bg-slate-50 rounded-2xl md:rounded-3xl">
                       <span className="material-icons-round text-slate-300 text-[60px] md:text-[80px] animate-spin">refresh</span>
                    </div>
                 )}
              </div>
              <p className="absolute -bottom-12 md:-bottom-16 left-0 right-0 text-center text-sm md:text-lg font-bold text-slate-500 uppercase tracking-widest bg-slate-50 py-2 md:py-3 rounded-full border border-slate-200 shadow-sm">
                 QR diperbarui dalam <span className="text-blue-600 font-black">{Math.ceil((rotateProgress / 100) * rotateSeconds)}</span> Detik
              </p>

              <div className="absolute hidden lg:flex top-1/2 -right-40 -translate-y-1/2 transform flex-col items-center gap-3">
                 <div className="flex items-center gap-2 px-5 py-2 lg:py-3 bg-white border border-slate-200 rounded-full shadow-sm">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-slate-700 font-extrabold text-sm uppercase tracking-wide">{timeLeftStr}</span>
                 </div>
              </div>
           </div>
           
           <div className="mt-20 lg:hidden flex items-center gap-2 px-5 py-2 md:py-3 bg-white border border-slate-200 rounded-full shadow-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-slate-700 font-extrabold text-sm uppercase tracking-wide">Sesi Tersisa: {timeLeftStr}</span>
           </div>
        </div>
      )}

      {/* HEADER BAR - Mode Breadcrumb */}
      <div className="w-full bg-white border-b border-slate-200 flex flex-col justify-center px-4 md:px-8 py-4 md:py-5 shrink-0 relative z-10 shadow-sm gap-2 mt-0">
        <div className="flex flex-wrap items-center gap-1 md:gap-2 text-[10px] md:text-xs font-medium font-['Inter'] leading-4">
           <span className="text-slate-500 hover:text-blue-600 hidden sm:inline cursor-pointer">Modul Kegiatan</span>
           <span className="text-slate-400 material-icons-round text-[14px] hidden sm:inline">chevron_right</span>
           <Link href="/kegiatan" className="text-slate-500 hover:text-blue-600 transition-colors">Daftar Kegiatan</Link>
           <span className="text-slate-400 material-icons-round text-[14px]">chevron_right</span>
           <span className="text-slate-700 font-bold">Absensi Terpusat</span>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 mt-1">
           <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
              <h1 className="text-slate-900 text-xl md:text-2xl lg:text-3xl font-black font-['Inter'] leading-tight tracking-tight max-w-full break-words">
                {kegiatan?.nama_kegiatan || 'Acara GSJA'}
              </h1>
              {sessionActive && (
                <div className="px-2 py-1 md:px-3 md:py-1.5 bg-emerald-50 rounded border border-emerald-300 flex items-center gap-1.5 md:gap-2 shrink-0">
                   <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                   <span className="text-emerald-700 text-[10px] md:text-xs font-bold uppercase tracking-wide">SESI TERBUKA</span>
                </div>
              )}
           </div>
           <div className="text-slate-500 text-[10px] md:text-sm font-medium font-['Inter'] flex gap-1.5 md:gap-2 items-center">
              <span className="material-icons-round text-base md:text-lg text-slate-400">qr_code_scanner</span> <span className="uppercase tracking-wider font-bold">Absensi Terpusat</span>
           </div>
        </div>
      </div>

      {/* MAIN SPLIT SCREEN */}
      <div className="flex-1 flex flex-col lg:flex-row w-full relative h-auto lg:h-[calc(100vh-140px)] overflow-y-auto lg:overflow-hidden">
        
        {/* ========================================================= */}
        {/* KIRI: PANEL DYNAMIC QR (60%) */}
        {/* ========================================================= */}
        <div className="w-full lg:w-[60%] h-auto lg:h-full bg-slate-50/50 flex flex-col relative shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200">
           
           {/* Feedback Pop-Up Overlay (Absolute) */}
           {feedback.isVisible && (
             <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-md transition-all duration-300 ${feedback.type === 'success' ? 'bg-emerald-500/95 text-white' : 'bg-red-600/95 text-white'}`}>
                <span className="material-icons-round text-[80px] md:text-[120px] mb-4 md:mb-6 drop-shadow-lg">
                  {feedback.type === 'success' ? 'check_circle' : 'cancel'}
                </span>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-center max-w-2xl leading-tight">
                  {feedback.message}
                </h1>
                {feedback.detail && <p className="text-lg md:text-2xl mt-3 md:mt-4 font-bold opacity-90">{feedback.detail}</p>}
             </div>
           )}

           {!sessionActive ? (
              // ------------------------------------
              // SETUP SESI STATE
              // ------------------------------------
              <div className="flex-1 flex flex-col items-center justify-center p-4 py-8 md:p-12">
                 <div className="w-full max-w-lg bg-white p-6 md:p-10 rounded-2xl shadow-xl border border-slate-100 flex flex-col gap-6 md:gap-8">
                    <div className="text-center">
                       <span className="material-icons-round text-[40px] md:text-[48px] text-blue-500 mb-2 md:mb-3">settings_suggest</span>
                       <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Pengaturan Sesi Absensi</h2>
                       <p className="text-slate-500 mt-1 text-sm md:text-base">Konfigurasikan panel rotasi QR Code untuk mencegah duplikasi atau kecurangan absen jarak jauh.</p>
                    </div>

                    <div className="flex flex-col gap-5 md:gap-6">
                       <div className="flex flex-col gap-2">
                          <label className="text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wide">Interval Rotasi Barcode</label>
                          <div className="grid grid-cols-3 gap-2 md:gap-3">
                             {[15, 30, 45].map(sec => (
                               <button 
                                 key={`sec-${sec}`}
                                 onClick={() => setRotateSeconds(sec)}
                                 className={`flex-1 py-2 md:py-3 px-1 md:px-4 rounded-xl border-2 font-bold transition-all text-xs md:text-sm ${rotateSeconds === sec ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                               >
                                 {sec} Detik
                               </button>
                             ))}
                          </div>
                       </div>

                       <div className="flex flex-col gap-2">
                          <label className="text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wide">Batas Durasi Sesi</label>
                          <div className="grid grid-cols-4 gap-2 md:gap-3">
                             {[15, 30, 45, 60].map(min => (
                               <button 
                                 key={`min-${min}`}
                                 onClick={() => setDurationMinutes(min)}
                                 className={`flex-1 py-2 md:py-3 px-1 md:px-4 rounded-xl border-2 font-bold transition-all text-[11px] md:text-sm ${durationMinutes === min ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                               >
                                 {min} <span className="hidden sm:inline">Menit</span><span className="sm:hidden">M</span>
                               </button>
                             ))}
                          </div>
                          <p className="text-[11px] md:text-xs text-slate-400 mt-1">Sesi akan otomatis tertutup saat *timer* habis untuk mengamankan data kehadiran.</p>
                       </div>
                    </div>

                    <div className="pt-2 md:pt-4">
                       <button onClick={handleStartSession} className="w-full py-3 md:py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base md:text-lg tracking-wide rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]">
                          <span className="material-icons-round">qr_code_scanner</span> Mulai Transmisikan QR
                       </button>
                    </div>
                 </div>
              </div>
           ) : (
              // ------------------------------------
              // ACTIVE SESSION STATE
              // ------------------------------------
              <div className="flex-1 flex flex-col items-center justify-center p-4 py-8 md:p-12 relative animate-in fade-in z-10">
                 
                 <div className="absolute top-4 md:top-8 left-4 md:left-8 flex items-center gap-2 px-3 py-1.5 md:px-5 md:py-2.5 bg-white rounded-full shadow-sm border border-slate-200 z-10">
                    <span className="relative flex h-2 w-2 md:h-3 md:w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-slate-700 font-bold text-[10px] md:text-sm tracking-wide">Sesi Terbuka — {timeLeftStr}</span>
                 </div>

                 <div className="absolute top-4 md:top-8 right-4 md:right-8 flex gap-2 z-10">
                    <button onClick={() => setIsFullscreen(true)} className="flex items-center justify-center gap-1 md:gap-2 p-1.5 md:px-4 md:py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg md:rounded-lg border border-slate-200 transition-colors shadow-sm font-bold text-[10px] md:text-sm tracking-wide">
                       <span className="material-icons-round text-base md:text-[18px] text-blue-500">fullscreen</span> <span className="hidden sm:inline">Perbesar</span>
                    </button>
                    <button onClick={handleStopSession} className="flex items-center justify-center gap-1 md:gap-2 p-1.5 md:px-5 md:py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg md:rounded-lg border border-rose-200 transition-colors shadow-sm font-bold text-[10px] md:text-sm tracking-wide">
                       <span className="material-icons-round text-base md:text-[18px]">stop_circle</span> <span className="hidden sm:inline">Tutup</span> Sesi
                    </button>
                 </div>

                 <div className="text-center mb-6 mt-14 md:mt-2 md:mb-8 flex flex-col items-center max-w-[90%] mx-auto">
                    {kegiatan?.nama_kegiatan && <div className="px-3 py-1 bg-blue-50/80 backdrop-blur-sm border border-blue-200 text-blue-700 rounded-full text-[10px] md:text-sm font-bold tracking-widest uppercase mb-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">{kegiatan.nama_kegiatan}</div>}
                    <h2 className="text-2xl md:text-4xl font-black text-slate-800 mb-1 md:mb-2 tracking-tight line-clamp-2 md:line-clamp-none">PINDAI UNTUK HADIR</h2>
                    <p className="text-slate-500 text-xs md:text-lg">Gunakan Kamera / Scan di Aplikasi GSJA</p>
                 </div>
                 
                 <div className="relative p-3 md:p-5 bg-white rounded-[24px] md:rounded-[40px] shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05)] border border-slate-100 mt-2 mx-auto max-w-full">
                    <div className="absolute -top-4 md:-top-7 left-0 right-0 h-2 md:h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner flex border border-slate-200/50">
                       <div className="h-full bg-blue-500 transition-all duration-100 ease-linear rounded-full" style={{ width: `${rotateProgress}%` }}></div>
                    </div>
                    
                    <div className="p-4 md:p-8 border-2 md:border-4 border-slate-100 rounded-2xl md:rounded-[32px] flex items-center justify-center relative bg-white mx-auto max-w-[250px] sm:max-w-[320px] md:max-w-[420px] aspect-square">
                       {qrPayload ? (
                          <div className="animate-in fade-in zoom-in-95 duration-300 w-full h-full flex items-center justify-center">
                            <QRCode value={qrPayload} style={{ height: "auto", maxWidth: "100%", width: "100%" }} size={300} level="H" />
                          </div>
                       ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl md:rounded-3xl">
                             <span className="material-icons-round text-slate-300 text-[40px] md:text-[80px] animate-spin">refresh</span>
                          </div>
                       )}
                    </div>
                    <p className="absolute -bottom-10 md:-bottom-16 left-0 right-0 text-center text-[10px] md:text-lg font-bold text-slate-500 uppercase tracking-widest bg-slate-50 py-1.5 md:py-3 rounded-full border border-slate-200 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] z-20 mx-4 md:mx-0">
                       <span className="hidden sm:inline">QR diperbarui dalam </span><span className="sm:hidden">Ubah dlm </span>
                       <span className="text-blue-600 font-black">{Math.ceil((rotateProgress / 100) * rotateSeconds)}</span> <span className="hidden sm:inline">Detik</span><span className="sm:hidden">dtk</span>
                    </p>
                 </div>
              </div>
           )}
        </div>

        {/* ========================================================= */}
        {/* KANAN: PANEL MANUAL (40%) */}
        {/* ========================================================= */}
        <div id="manual-panel-container" className="flex-1 w-full lg:w-[40%] bg-white flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-20 min-h-[500px] lg:min-h-0">
          
          {/* STATISTIK HEADER */}
          <div className="w-full p-4 md:p-6 bg-slate-50 flex flex-col gap-3 md:gap-4 border-b border-slate-200 shrink-0">
             <div className="w-full flex justify-between items-end">
                <div>
                   <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1">Status Kehadiran Realtime</p>
                   <h2 className="text-slate-900 text-3xl md:text-4xl font-black font-['Public_Sans'] leading-tight">{stats.total_hadir} <span className="text-sm md:text-lg text-slate-500 font-bold">Jiwa</span></h2>
                </div>
                <div className="flex gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold font-['Public_Sans']">
                  <div className="px-2 md:px-3 py-1 md:py-1.5 bg-blue-100 text-blue-700 rounded-lg shadow-sm border border-blue-200">Jemaat: {stats.total_jemaat}</div>
                  <div className="px-2 md:px-3 py-1 md:py-1.5 bg-emerald-100 text-emerald-700 rounded-lg shadow-sm border border-emerald-200">Tamu: {stats.total_tamu}</div>
                </div>
             </div>
          </div>

          {/* TAB NAVS */}
          <div className="w-full flex border-b border-slate-200 shrink-0 bg-white">
            <button onClick={() => { setActiveTab('cari'); setIsScannerOpen(false); }} className={`flex-1 py-3 md:py-4 text-[11px] md:text-sm font-bold uppercase tracking-wider border-b-4 transition-colors ${activeTab === 'cari' && !isScannerOpen ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
              Cari Jemaat GSJA
            </button>
            <button onClick={() => { setActiveTab('tamu'); setIsScannerOpen(false); }} className={`flex-1 py-3 md:py-4 text-[11px] md:text-sm font-bold uppercase tracking-wider border-b-4 transition-colors ${activeTab === 'tamu' && !isScannerOpen ? 'border-amber-500 text-amber-700 bg-amber-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
              Tamu Baru
            </button>
          </div>

          {/* USHER TOAST (Non-intrusive) */}
          {usherToast.visible && (
            <div className={`w-full px-4 py-3 flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-2 fade-in duration-200 ${
              usherToast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-b border-emerald-200' : 'bg-red-50 text-red-700 border-b border-red-200'
            }`}>
              <span className="material-icons-round text-[18px]">{usherToast.type === 'success' ? 'check_circle' : 'error'}</span>
              <span className="truncate">{usherToast.message}</span>
            </div>
          )}

          {/* TAB CONTENTS */}
          <div className="w-full p-4 md:p-6 bg-white shrink-0 shadow-sm z-20">
             {isScannerOpen ? (
               <div className="flex flex-col w-full animate-in fade-in zoom-in-95 duration-200">
                 <div className="w-full flex justify-between items-center mb-4">
                   <div className="flex items-center gap-2">
                     <span className="material-icons-round text-blue-600">qr_code_scanner</span>
                     <span className="text-sm font-bold text-slate-800">Arahkan Ke QR Jemaat</span>
                   </div>
                   <button onClick={() => setIsScannerOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors">
                     <span className="material-icons-round text-[18px]">close</span>
                   </button>
                 </div>
                 <div className="w-full rounded-2xl overflow-hidden relative border-4 border-slate-100 shadow-inner bg-slate-900 mx-auto">
                    <Scanner
                      onScan={(detectedCodes) => {
                         // Play beep immediately when anything is scanned (success)
                         try {
                           const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                           const oscillator = audioContext.createOscillator();
                           oscillator.type = 'sine';
                           oscillator.frequency.value = 800;
                           oscillator.connect(audioContext.destination);
                           oscillator.start();
                           setTimeout(() => oscillator.stop(), 150);
                         } catch (e) {}
                         handleUsherScan(detectedCodes);
                      }}
                      formats={['qr_code']}
                      components={{ finder: false }}
                      styles={{ container: { width: '100%', borderRadius: '12px' } }}
                    />
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-500 shadow-[0_0_15px_3px_rgba(59,130,246,0.5)] z-20 animate-pulse pointer-events-none"></div>
                 </div>
               </div>
             ) : (
               <>
                 {activeTab === 'cari' && (
                   <div className="flex flex-col gap-3 md:gap-4 text-sm animate-in fade-in duration-200">
                     <div className="relative flex items-center">
                       <span className="material-icons-round absolute left-3 md:left-4 text-slate-400 text-lg pointer-events-none">search</span>
                       <input 
                         type="text" 
                         placeholder="Ketik minimal 3 huruf nama jemaat..." 
                         value={manualSearch}
                         onChange={(e) => setManualSearch(e.target.value)}
                         className="w-full pl-10 md:pl-12 pr-12 md:pr-14 py-2.5 md:py-3 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs md:text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                       />
                       <button 
                         onClick={() => setIsScannerOpen(true)}
                         className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-100 hover:text-blue-700 transition-colors shadow-sm cursor-pointer"
                         title="Memindai QR Jemaat"
                       >
                         <span className="material-icons-round text-[18px] md:text-[20px]">qr_code_scanner</span>
                       </button>
                     </div>
                     
                     {/* Hasil Search Box */}
                     {(searchResults.length > 0 || isSearching) && (
                       <div className="w-full max-h-48 md:max-h-60 overflow-y-auto border border-blue-200 rounded-xl mt-1 shadow-lg bg-white relative z-50">
                         {isSearching ? (
                            <div className="p-4 text-slate-500 text-center text-xs md:text-sm font-medium">Mencari...</div>
                         ) : (
                           searchResults.map((jem) => (
                             <div key={jem.id} className="w-full p-2.5 md:p-3 flex justify-between items-center hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors cursor-pointer" onClick={() => submitManualAbsen(jem.id, jem.nama_lengkap)}>
                               <div className="flex flex-col">
                                 <span className="text-slate-800 font-bold text-xs md:text-sm tracking-tight line-clamp-1">{jem.nama_lengkap}</span>
                                 <span className="text-slate-500 text-[10px] md:text-xs font-medium">{jem.nama_satelit}</span>
                               </div>
                               <button className="px-2 md:px-3 py-1 md:py-1.5 bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 text-[10px] md:text-xs font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap ml-2 shrink-0">
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
                   <form onSubmit={submitTamu} className="flex flex-col gap-2.5 md:gap-3 text-sm animate-in fade-in duration-200">
                     <div className="flex flex-col gap-1.5">
                       <input type="text" value={formTamu.nama} onChange={e => setFormTamu({...formTamu, nama: e.target.value})} placeholder="Nama Lengkap (Wajib)" required className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs md:text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all" />
                     </div>
                     <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3">
                        <input type="text" value={formTamu.hp} onChange={e => setFormTamu({...formTamu, hp: e.target.value})} placeholder="No Hanphone" className="flex-1 px-3 md:px-4 py-2 md:py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs md:text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all" />
                        <input type="text" value={formTamu.asal} onChange={e => setFormTamu({...formTamu, asal: e.target.value})} placeholder="Gereja Asal" className="flex-1 px-3 md:px-4 py-2 md:py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs md:text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all" />
                     </div>
                     <button type="submit" disabled={isSubmittingManual || !formTamu.nama} className="w-full py-2.5 mt-2 bg-slate-800 hover:bg-slate-900 focus:ring-4 focus:ring-slate-300 disabled:opacity-50 text-white font-bold rounded-lg transition-all text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm">
                       <span className="material-icons-round text-[16px] md:text-[18px]">how_to_reg</span> Kehadiran Tamu
                     </button>
                   </form>
                 )}
               </>
             )}
          </div>

          {/* LOG HISTORI (Fills remaining height) */}
          <div className="flex-1 bg-slate-50 p-4 md:p-6 flex flex-col gap-2 md:gap-3 overflow-hidden relative border-t border-slate-200">
             <div className="w-full h-4 md:h-8 absolute top-0 inset-x-0 bg-gradient-to-b from-slate-50 to-transparent z-10"></div>
             <p className="text-slate-500 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] relative z-20 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Histori Transaksi Live
             </p>
             
             <div className="w-full h-[300px] lg:h-full overflow-y-auto flex flex-col gap-2 relative z-20 pr-1 md:pr-2 pb-4">
                {logs.length === 0 ? (
                  <p className="text-slate-400 text-xs md:text-sm italic py-2 md:py-4">Belum ada kehadiran tercatat.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="w-full p-2.5 md:p-3 bg-white border border-slate-200 shadow-sm rounded-xl flex items-center justify-between animate-in slide-in-from-left-2 fade-in duration-300 shrink-0">
                       <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                         <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 ${log.metode === 'QR Code' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                           <span className="material-icons-round text-[12px] md:text-[16px]">
                             {log.metode === 'QR Code' ? 'qr_code_2' : 'keyboard'}
                           </span>
                         </div>
                         <div className="flex flex-col min-w-0">
                           <span className="text-slate-800 font-bold text-[11px] md:text-sm tracking-tight truncate">{log.nama}</span>
                           <span className="text-slate-500 text-[9px] md:text-[10px] font-bold uppercase truncate">{log.jenis} / Via {log.metode}</span>
                         </div>
                       </div>
                       <div className="text-slate-400 text-[10px] md:text-xs font-bold font-['Liberation_Mono'] tracking-wide shrink-0 ml-2">
                          {formatWaktu(log.waktu_hadir)}
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>

      </div>

      {/* MODAL SCANNER JEMAAT (USHER SIDE) - REMOVED (NOW INLINE) */}

    </div>
  );
}
