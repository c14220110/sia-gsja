'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function BroadcastNotifikasiPage() {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  // User data for permission
  const [userData, setUserData] = useState<any>(null);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          setUserData(json);
        }
      } catch {}
    };
    fetchUser();
  }, []);

  const hasPermission = (perm: string) => userData?.is_super_admin || userData?.permissions?.includes?.(perm);

  // Redirect jemaat
  useEffect(() => {
    if (userData?.role_name?.toLowerCase() === 'jemaat') router.replace('/jadwal');
  }, [userData, router]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'kirim' | 'riwayat'>('kirim');

  // ─── FORM STATE (TAB KIRIM) ─────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    judul: '',
    isi_pesan: '',
    target_audience: 'semua_jemaat',
    target_satelit_id: '',
    target_komisi_id: '',
    target_jemaat_id: '',
    url_tujuan: '/',
  });
  
  const [jemaatSearchQuery, setJemaatSearchQuery] = useState('');
  const [jemaatOptions, setJemaatOptions] = useState<any[]>([]);
  const [isSearchingJemaat, setIsSearchingJemaat] = useState(false);
  const [selectedJemaatName, setSelectedJemaatName] = useState('');

  // Options
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [resSatelit, resKomisi] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=komisi'),
        ]);
        const satelitData = await resSatelit.json();
        const komisiData = await resKomisi.json();
        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (komisiData.success) setKomisiOptions(komisiData.data);
      } catch (e) {
        console.error('Failed to fetch options', e);
      }
    };
    fetchOptions();
  }, []);

  // Debounced search for individu jemaat
  useEffect(() => {
    if (formData.target_audience !== 'individu_jemaat') return;
    
    const timer = setTimeout(async () => {
      if (jemaatSearchQuery.trim().length >= 3) {
        setIsSearchingJemaat(true);
        try {
          const res = await fetch(`/api/members?search=${encodeURIComponent(jemaatSearchQuery)}&limit=10`);
          if (res.ok) {
            const data = await res.json();
            setJemaatOptions(data.data || []);
          }
        } catch (error) {
          console.error('Failed to search jemaat', error);
        } finally {
          setIsSearchingJemaat(false);
        }
      } else {
        setJemaatOptions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [jemaatSearchQuery, formData.target_audience]);

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  const handleSend = async () => {
    if (!formData.judul.trim()) {
      setSubmitState({ status: 'error', message: 'Judul notifikasi wajib diisi' });
      return;
    }
    if (!formData.isi_pesan.trim()) {
      setSubmitState({ status: 'error', message: 'Isi pesan wajib diisi' });
      return;
    }
    if (formData.target_audience === 'per_satelit' && !formData.target_satelit_id) {
      setSubmitState({ status: 'error', message: 'Pilih satelit tujuan' });
      return;
    }
    if (formData.target_audience === 'per_komisi' && !formData.target_komisi_id) {
      setSubmitState({ status: 'error', message: 'Pilih komisi tujuan' });
      return;
    }
    if (formData.target_audience === 'individu_jemaat' && !formData.target_jemaat_id) {
      setSubmitState({ status: 'error', message: 'Pilih individu jemaat tujuan' });
      return;
    }

    const targetLabel = formData.target_audience === 'semua_jemaat'
      ? 'SEMUA jemaat aktif'
      : formData.target_audience === 'per_satelit'
        ? `jemaat satelit "${satelitOptions.find(s => s.id.toString() === formData.target_satelit_id)?.nama_satelit || formData.target_satelit_id}"`
        : formData.target_audience === 'per_komisi'
        ? `jemaat komisi "${komisiOptions.find(k => k.id.toString() === formData.target_komisi_id)?.nama_komisi || formData.target_komisi_id}"`
        : `individu jemaat "${selectedJemaatName}"`;

    if (!confirm(`Anda yakin ingin mengirim notifikasi push ke ${targetLabel}?\n\nJudul: ${formData.judul}\nIsi: ${formData.isi_pesan}`)) return;

    setSubmitState({ status: 'loading', message: 'Mengirim notifikasi ke jemaat...' });
    try {
      const res = await fetch('/api/notifikasi/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: result.message });
        setFormData({
          judul: '',
          isi_pesan: '',
          target_audience: 'semua_jemaat',
          target_satelit_id: '',
          target_komisi_id: '',
          target_jemaat_id: '',
          url_tujuan: '/',
        });
        setJemaatSearchQuery('');
        setSelectedJemaatName('');
        setRefreshHistory(prev => prev + 1);
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 3000);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal mengirim notifikasi' });
      }
    } catch (error) {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
    }
  };

  // ─── RIWAYAT STATE (TAB RIWAYAT) ───────────────────────────────────────────
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState('');
  const [refreshHistory, setRefreshHistory] = useState(0);

  // Stats
  const [statsBroadcast, setStatsBroadcast] = useState(0);
  const [statsTerkirim, setStatsTerkirim] = useState(0);
  const [statsTarget, setStatsTarget] = useState(0);

  const historyLimit = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedHistorySearch(historySearch), 500);
    return () => clearTimeout(timer);
  }, [historySearch]);

  useEffect(() => {
    setHistoryPage(1);
  }, [debouncedHistorySearch]);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedHistorySearch) queryParams.append('search', debouncedHistorySearch);
        queryParams.append('limit', historyLimit.toString());
        queryParams.append('offset', ((historyPage - 1) * historyLimit).toString());

        const res = await fetch(`/api/notifikasi/broadcast?${queryParams.toString()}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setHistoryData(result.data);
            setHistoryTotal(result.meta.total);
            setStatsBroadcast(result.meta.total_broadcast || 0);
            setStatsTerkirim(result.meta.total_terkirim || 0);
            setStatsTarget(result.meta.total_target || 0);
          }
        }
      } catch (error) {
        console.error('Failed to fetch history', error);
      } finally {
        hideLoader();
      }
    };

    fetchHistory();
  }, [debouncedHistorySearch, historyPage, refreshHistory]);

  const totalHistoryPages = Math.ceil(historyTotal / historyLimit) || 1;

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  };

  const renderAudienceBadge = (audience: string) => {
    switch (audience) {
      case 'semua_jemaat':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap flex items-center gap-1">
            <span className="material-icons-round text-[10px]">public</span>Semua Jemaat
          </span>
        );
      case 'per_satelit':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap flex items-center gap-1">
            <span className="material-icons-round text-[10px]">church</span>Per Satelit
          </span>
        );
      case 'per_komisi':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-purple-50 text-purple-700 border-purple-200 whitespace-nowrap flex items-center gap-1">
            <span className="material-icons-round text-[10px]">groups</span>Per Komisi
          </span>
        );
      case 'individu_jemaat':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap flex items-center gap-1">
            <span className="material-icons-round text-[10px]">person</span>Individu
          </span>
        );
      default:
        return null;
    }
  };

  if (userData?.role_name?.toLowerCase() === 'jemaat') return null;

  return (
    <div className="w-full flex flex-col gap-8 pb-10 relative">
      
      {/* Submit Overlay */}
      {(submitState.status !== 'idle') && <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />}

      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="w-full flex flex-col justify-start items-start gap-4">
          <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
            <Link href="/kegiatan" className="text-slate-500 hover:text-violet-600">Kegiatan</Link>
            <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
            <Link href="/kegiatan/survei" className="text-slate-500 hover:text-violet-600">Survei</Link>
            <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
            <span className="text-slate-700 font-bold">Broadcast Notifikasi</span>
          </div>
          <div className="self-stretch inline-flex justify-between items-end">
            <div className="inline-flex flex-col justify-start items-start">
              <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Broadcast Notifikasi</h1>
              <div className="text-slate-500 text-base font-medium font-sans leading-6">Kirim notifikasi push ke perangkat jemaat secara massal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-indigo-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-indigo-600 text-3xl">campaign</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">TOTAL BROADCAST</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{statsBroadcast}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-emerald-600 text-3xl">check_circle</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">TOTAL TERKIRIM</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{statsTerkirim}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-blue-600 text-3xl">people</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">TOTAL TARGET</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{statsTarget}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="w-full border-b border-slate-200 flex gap-0">
        <button 
          onClick={() => setActiveTab('kirim')}
          className={`px-6 py-3 text-sm font-bold font-sans border-b-2 transition-colors ${activeTab === 'kirim' ? 'border-slate-700 text-slate-700' : 'border-transparent text-slate-400 hover:text-slate-500'}`}
        >
          <span className="flex items-center gap-2">
            <span className="material-icons-round text-[18px]">send</span>
            Kirim Notifikasi
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('riwayat')}
          className={`px-6 py-3 text-sm font-bold font-sans border-b-2 transition-colors ${activeTab === 'riwayat' ? 'border-slate-700 text-slate-700' : 'border-transparent text-slate-400 hover:text-slate-500'}`}
        >
          <span className="flex items-center gap-2">
            <span className="material-icons-round text-[18px]">history</span>
            Riwayat Pengiriman
          </span>
        </button>
      </div>

      {/* ─── TAB: KIRIM NOTIFIKASI ─────────────────────────────────────────────── */}
      {activeTab === 'kirim' && (
        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Compose Form */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Judul & Isi */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6">
              <div className="w-full inline-flex justify-start items-center gap-2">
                <span className="material-icons-round text-slate-700 text-[18px]">edit_note</span>
                <span className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Konten Notifikasi</span>
              </div>

              <div className="w-full flex-col gap-4 flex">
                <div className="w-full flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Judul Notifikasi <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    value={formData.judul}
                    onChange={(e) => setFormData(prev => ({ ...prev, judul: e.target.value }))}
                    placeholder="Contoh: 📢 Pengumuman Ibadah Minggu"
                    maxLength={100}
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all"
                  />
                  <span className="text-slate-400 text-[11px]">{formData.judul.length}/100 karakter</span>
                </div>

                <div className="w-full flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Isi Pesan <span className="text-rose-500">*</span></label>
                  <textarea 
                    value={formData.isi_pesan}
                    onChange={(e) => setFormData(prev => ({ ...prev, isi_pesan: e.target.value }))}
                    placeholder="Tulis pesan yang akan diterima jemaat di HP mereka..."
                    rows={4}
                    maxLength={500}
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all resize-none"
                  />
                  <span className="text-slate-400 text-[11px]">{formData.isi_pesan.length}/500 karakter</span>
                </div>

                <div className="w-full flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Tujuan Ketika Diklik</label>
                  <select
                    value={formData.url_tujuan}
                    onChange={(e) => setFormData(prev => ({ ...prev, url_tujuan: e.target.value }))}
                    className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all"
                  >
                    <option value="/">🏠 Dashboard (Halaman Utama)</option>
                    <option value="/survei-saya">📊 Halaman Survei Saya</option>
                  </select>
                  <span className="text-slate-400 text-[11px]">Halaman yang terbuka ketika jemaat mengklik notifikasi di HP</span>
                </div>
              </div>
            </div>

            {/* Target Audience */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-6">
              <div className="w-full inline-flex justify-start items-center gap-2">
                <span className="material-icons-round text-slate-700 text-[18px]">group_add</span>
                <span className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Target Penerima</span>
              </div>

              <div className="w-full flex flex-col gap-4">
                {/* Audience selector */}
                <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, target_audience: 'semua_jemaat', target_satelit_id: '', target_komisi_id: '', target_jemaat_id: '' }))}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                      formData.target_audience === 'semua_jemaat'
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-2xl ${formData.target_audience === 'semua_jemaat' ? 'text-emerald-600' : 'text-slate-400'}`}>public</span>
                    <span className={`text-sm font-bold font-sans ${formData.target_audience === 'semua_jemaat' ? 'text-emerald-700' : 'text-slate-700'}`}>Semua Jemaat</span>
                    <span className="text-[11px] text-slate-400 text-center">Kirim ke semua jemaat aktif</span>
                  </button>

                  <button
                    onClick={() => setFormData(prev => ({ ...prev, target_audience: 'per_satelit', target_satelit_id: '', target_komisi_id: '', target_jemaat_id: '' }))}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                      formData.target_audience === 'per_satelit'
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-2xl ${formData.target_audience === 'per_satelit' ? 'text-blue-600' : 'text-slate-400'}`}>church</span>
                    <span className={`text-sm font-bold font-sans ${formData.target_audience === 'per_satelit' ? 'text-blue-700' : 'text-slate-700'}`}>Per Satelit</span>
                    <span className="text-[11px] text-slate-400 text-center">Kirim ke satelit tertentu</span>
                  </button>

                  <button
                    onClick={() => setFormData(prev => ({ ...prev, target_audience: 'per_komisi', target_satelit_id: '', target_komisi_id: '', target_jemaat_id: '' }))}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                      formData.target_audience === 'per_komisi'
                        ? 'border-purple-500 bg-purple-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-2xl ${formData.target_audience === 'per_komisi' ? 'text-purple-600' : 'text-slate-400'}`}>groups</span>
                    <span className={`text-sm font-bold font-sans ${formData.target_audience === 'per_komisi' ? 'text-purple-700' : 'text-slate-700'}`}>Per Komisi</span>
                    <span className="text-[11px] text-slate-400 text-center">Kirim ke komisi tertentu</span>
                  </button>

                  <button
                    onClick={() => setFormData(prev => ({ ...prev, target_audience: 'individu_jemaat', target_satelit_id: '', target_komisi_id: '', target_jemaat_id: '' }))}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                      formData.target_audience === 'individu_jemaat'
                        ? 'border-amber-500 bg-amber-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-2xl ${formData.target_audience === 'individu_jemaat' ? 'text-amber-600' : 'text-slate-400'}`}>person</span>
                    <span className={`text-sm font-bold font-sans text-center ${formData.target_audience === 'individu_jemaat' ? 'text-amber-700' : 'text-slate-700'}`}>Individu Jemaat</span>
                    <span className="text-[11px] text-slate-400 text-center">Kirim ke 1 jemaat</span>
                  </button>
                </div>

                {/* Conditional selectors */}
                {formData.target_audience === 'per_satelit' && (
                  <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-2">
                    <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Pilih Satelit <span className="text-rose-500">*</span></label>
                    <select 
                      value={formData.target_satelit_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_satelit_id: e.target.value }))}
                      className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all"
                    >
                      <option value="">-- Pilih Satelit --</option>
                      {satelitOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.target_audience === 'per_komisi' && (
                  <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-2">
                    <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Pilih Komisi <span className="text-rose-500">*</span></label>
                    <select 
                      value={formData.target_komisi_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_komisi_id: e.target.value }))}
                      className="px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all"
                    >
                      <option value="">-- Pilih Komisi --</option>
                      {komisiOptions.map(k => (
                        <option key={k.id} value={k.id}>{k.nama_komisi}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.target_audience === 'individu_jemaat' && (
                  <div className="w-full flex-col gap-1 flex animate-in fade-in slide-in-from-top-2">
                    <label className="text-slate-400 text-xs font-bold font-sans uppercase leading-4">Cari Jemaat <span className="text-rose-500">*</span></label>
                    
                    {!formData.target_jemaat_id ? (
                      <div className="relative w-full flex flex-col gap-2">
                        <div className="relative">
                          <span className="material-icons-round absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
                          <input 
                            type="text"
                            value={jemaatSearchQuery}
                            onChange={(e) => setJemaatSearchQuery(e.target.value)}
                            placeholder="Ketik nama jemaat (min. 3 huruf)..."
                            className="pl-10 pr-4 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 text-sm font-sans w-full transition-all"
                          />
                        </div>
                        
                        {isSearchingJemaat ? (
                          <div className="text-xs text-slate-400 flex items-center gap-1"><span className="material-icons-round animate-spin text-[14px]">sync</span> Mencari...</div>
                        ) : jemaatOptions.length > 0 && jemaatSearchQuery.trim().length >= 3 ? (
                          <div className="w-full border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                            {jemaatOptions.map(j => (
                              <button 
                                key={j.id} 
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, target_jemaat_id: j.id.toString() }));
                                  setSelectedJemaatName(j.nama_lengkap);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
                              >
                                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">{j.nama_lengkap}</span>
                                <span className="text-[10px] text-slate-400">ID: {j.jemaat_id}</span>
                              </button>
                            ))}
                          </div>
                        ) : jemaatSearchQuery.trim().length >= 3 && (
                          <div className="text-xs text-rose-500">Jemaat tidak ditemukan</div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-icons-round text-amber-600 text-[18px]">person</span>
                          <span className="text-sm font-bold text-amber-800">{selectedJemaatName}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setFormData(prev => ({ ...prev, target_jemaat_id: '' }));
                            setSelectedJemaatName('');
                            setJemaatSearchQuery('');
                            setJemaatOptions([]);
                          }}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-200/50 text-amber-700 transition-colors"
                        >
                          <span className="material-icons-round text-[16px]">close</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Preview & Send */}
          <div className="flex flex-col gap-6">
            {/* Preview Card */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
              <div className="w-full inline-flex justify-start items-center gap-2">
                <span className="material-icons-round text-slate-700 text-[18px]">preview</span>
                <span className="text-slate-700 text-xs font-bold font-sans uppercase leading-4 tracking-wider">Preview Notifikasi</span>
              </div>

              {/* Mock phone notification */}
              <div className="w-full bg-slate-900 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span className="material-icons-round text-white text-[16px]">church</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-bold truncate">{formData.judul || 'Judul Notifikasi'}</div>
                    <div className="text-slate-400 text-[10px]">SIA GSJA Eben Haezer • Sekarang</div>
                  </div>
                </div>
                <div className="text-slate-300 text-xs leading-relaxed">
                  {formData.isi_pesan || 'Isi pesan notifikasi akan tampil di sini...'}
                </div>
              </div>
            </div>

            {/* Send Button */}
            {hasPermission('survei_manage') && (
              <button
                onClick={handleSend}
                disabled={submitState.status === 'loading'}
                className="w-full py-3.5 bg-slate-700 rounded-xl flex justify-center items-center gap-2 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                <span className="material-icons-round text-white text-[20px]">send</span>
                <span className="text-white text-sm font-bold font-sans">Kirim Notifikasi Sekarang</span>
              </button>
            )}

            {/* Info */}
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex gap-3">
              <span className="material-icons-round text-amber-500 text-[20px] mt-0.5 flex-shrink-0">info</span>
              <div className="flex flex-col gap-1">
                <span className="text-amber-800 text-xs font-bold font-sans">Catatan Penting</span>
                <span className="text-amber-700 text-[11px] leading-relaxed">
                  Notifikasi hanya terkirim ke jemaat yang sudah mengaktifkan notifikasi di perangkat mereka. Pastikan pesan singkat dan jelas.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: RIWAYAT PENGIRIMAN ────────────────────────────────────────────── */}
      {activeTab === 'riwayat' && (
        <div className="w-full flex flex-col gap-6">
          
          {/* Search */}
          <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
            <div className="flex-1 min-w-[200px] relative flex items-center">
              <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
              <input 
                type="text" 
                placeholder="Cari berdasarkan judul atau isi pesan..."
                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
          </div>

          {/* History Table */}
          <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
            <div className="w-full overflow-x-auto pb-16 min-h-[400px]">
              <div className="min-w-[900px] flex flex-col">
                {/* Table Header */}
                <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
                  <div className="flex-1 min-w-[250px] text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">NOTIFIKASI</div>
                  <div className="w-[140px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">TARGET</div>
                  <div className="w-[100px] shrink-0 text-center text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">TERKIRIM</div>
                  <div className="w-[170px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">WAKTU KIRIM</div>
                  <div className="w-[140px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">PENGIRIM</div>
                </div>

                {/* Table Body */}
                <div>
                  {historyData.length === 0 ? (
                    <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                      <span className="material-icons-round text-5xl mb-2 text-slate-300">notifications_off</span>
                      <span className="text-sm font-sans">Belum ada notifikasi yang pernah dikirim.</span>
                    </div>
                  ) : (
                    historyData.map((item) => (
                      <div key={item.id} className="w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-blue-50/40 hover:shadow-[inset_4px_0_0_0_#3b82f6] transition-all">
                        {/* Kolom 1: Judul & Isi */}
                        <div className="flex-1 min-w-[250px] flex flex-col items-start justify-center pr-4 gap-0.5">
                          <div className="text-slate-900 font-bold text-sm">{item.judul}</div>
                          <div className="text-slate-500 text-[11px] line-clamp-2">{item.isi_pesan}</div>
                        </div>

                        {/* Kolom 2: Target */}
                        <div className="w-[140px] shrink-0 flex flex-col gap-1">
                          {renderAudienceBadge(item.target_audience)}
                          {item.target_audience === 'per_satelit' && item.nama_satelit && (
                            <span className="text-slate-400 text-[10px] font-medium">{item.nama_satelit}</span>
                          )}
                          {item.target_audience === 'individu_jemaat' && item.target_jemaat_nama && (
                            <span className="text-slate-400 text-[10px] font-medium truncate" title={item.target_jemaat_nama}>{item.target_jemaat_nama}</span>
                          )}
                        </div>

                        {/* Kolom 3: Terkirim */}
                        <div className="w-[100px] shrink-0 text-center">
                          <span className="text-emerald-600 text-sm font-bold">{item.total_terkirim}</span>
                          <span className="text-slate-400 text-xs">/{item.total_target}</span>
                        </div>

                        {/* Kolom 4: Waktu */}
                        <div className="w-[170px] shrink-0 text-slate-600 text-sm">{formatDate(item.created_at)}</div>

                        {/* Kolom 5: Pengirim */}
                        <div className="w-[140px] shrink-0 text-slate-600 text-sm truncate">{item.pengirim_nama || '-'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Pagination Footer */}
            {historyTotal > 0 && (
              <div className="w-full px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-xl">
                <div className="text-slate-500 text-sm font-sans">
                  Menampilkan {((historyPage - 1) * historyLimit) + 1} - {Math.min(historyPage * historyLimit, historyTotal)} dari {historyTotal}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                    disabled={historyPage === 1}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-icons-round text-[18px]">chevron_left</span>
                  </button>
                  <button 
                    onClick={() => setHistoryPage(prev => Math.min(totalHistoryPages, prev + 1))}
                    disabled={historyPage === totalHistoryPages}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-icons-round text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
