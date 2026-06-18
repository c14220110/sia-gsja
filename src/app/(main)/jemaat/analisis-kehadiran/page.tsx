'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';

export default function AnalisisKehadiranPage() {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total: 0, setia: 0, jarang: 0, menghilang: 0, baru: 0 });
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [jenisKegiatanOptions, setJenisKegiatanOptions] = useState<any[]>([]);
  
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterJenisKegiatan, setFilterJenisKegiatan] = useState('1'); // Default to Ibadah Raya
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [periode, setPeriode] = useState('30');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [resSat, resJk] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=jenis_kegiatan')
        ]);
        const jsonSat = await resSat.json();
        const jsonJk = await resJk.json();
        
        if (jsonSat.success) setSatelitOptions(jsonSat.data);
        if (jsonJk.success) {
          // Hanya ambil kategori 'Ibadah Rutin'
          const ibadahRutin = jsonJk.data.filter((jk: any) => jk.kategori === 'Ibadah Rutin');
          setJenisKegiatanOptions(ibadahRutin);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      setErrorMsg('');
      try {
        const q = new URLSearchParams({ periode });
        if (filterSatelit) q.set('satelit_id', filterSatelit);
        if (filterJenisKegiatan) q.set('jenis_kegiatan_id', filterJenisKegiatan);
        
        const res = await fetch(`/api/jemaat/analisis-kehadiran?${q}`);
        const json = await res.json();
        
        if (res.status === 403) {
          setErrorMsg(json.message);
        } else if (json.success) {
          setData(json.data);
          setSummary(json.summary);
        } else {
          setErrorMsg('Gagal memuat data analisis kehadiran.');
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Terjadi kesalahan jaringan.');
      } finally {
        hideLoader();
      }
    };
    fetchData();
  }, [filterSatelit, filterJenisKegiatan, periode]);

  const filteredData = data.filter(j => {
    if (filterStatus !== 'Semua' && j.status_kehadiran !== filterStatus) return false;
    if (searchQuery && !j.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusColors = {
    'Setia': 'bg-emerald-100 text-emerald-700',
    'Mulai Jarang': 'bg-amber-100 text-amber-700',
    'Menghilang': 'bg-rose-100 text-rose-700',
    'Data Baru': 'bg-slate-100 text-slate-700'
  };

  if (errorMsg) {
    return (
      <div className="p-8 w-full max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <span className="material-icons-round text-rose-600 text-3xl">gpp_bad</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
        <p className="text-slate-500 text-center">{errorMsg}</p>
        <button onClick={() => router.push('/jemaat')} className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-700">
          Kembali ke Database Jemaat
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-slate-500 text-sm font-medium mb-1">
            <span className="cursor-pointer hover:text-slate-800" onClick={() => router.push('/jemaat')}>Manajemen User</span>
            <span className="material-icons-round text-[16px]">chevron_right</span>
            <span className="text-slate-800">Radar Kehadiran</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Radar Kehadiran Jemaat</h1>
          <p className="text-slate-500 mt-1">Pastoral Care Early Warning System &mdash; Deteksi jemaat yang mulai menjauh.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium text-sm"
          >
            <option value="30">30 Hari Terakhir</option>
            <option value="60">60 Hari Terakhir</option>
            <option value="90">90 Hari Terakhir</option>
          </select>
          {satelitOptions.length > 0 && (
            <select 
              value={filterSatelit}
              onChange={(e) => setFilterSatelit(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium text-sm"
            >
              <option value="">Semua Satelit</option>
              {satelitOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.nama_satelit}</option>
              ))}
            </select>
          )}
          {jenisKegiatanOptions.length > 0 && (
            <select 
              value={filterJenisKegiatan}
              onChange={(e) => setFilterJenisKegiatan(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium text-sm max-w-[200px] truncate"
            >
              <option value="">Semua Ibadah Rutin</option>
              {jenisKegiatanOptions.map((jk) => (
                <option key={jk.id} value={jk.id}>{jk.nama_jenis_kegiatan}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:border-slate-300 transition-colors" onClick={() => setFilterStatus('Semua')}>
          <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
            <span className="material-icons-round text-indigo-600">groups</span>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Aktif</div>
            <div className="text-2xl font-black text-slate-800 leading-none">{summary.total}</div>
          </div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-emerald-50/50 transition-colors" onClick={() => setFilterStatus('Setia')}>
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
            <span className="material-icons-round text-emerald-600">verified_user</span>
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Setia (≥3x)</div>
            <div className="text-2xl font-black text-slate-800 leading-none">{summary.setia}</div>
          </div>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-amber-50/50 transition-colors" onClick={() => setFilterStatus('Mulai Jarang')}>
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <span className="material-icons-round text-amber-600">warning_amber</span>
          </div>
          <div>
            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Mulai Jarang</div>
            <div className="text-2xl font-black text-slate-800 leading-none">{summary.jarang}</div>
          </div>
        </div>
        <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:bg-rose-50/50 transition-colors" onClick={() => setFilterStatus('Menghilang')}>
          <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center shrink-0">
            <span className="material-icons-round text-rose-600">person_off</span>
          </div>
          <div>
            <div className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Menghilang (0x)</div>
            <div className="text-2xl font-black text-slate-800 leading-none">{summary.menghilang}</div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <span className="material-icons-round absolute left-3 top-2.5 text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Cari nama jemaat..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm font-medium"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            {['Semua', 'Setia', 'Mulai Jarang', 'Menghilang', 'Data Baru'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterStatus === status ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <div className="min-w-[800px] flex flex-col">
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-80 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider">Nama Lengkap</div>
              <div className="w-40 shrink-0 text-slate-500 text-xs font-bold uppercase tracking-wider">Kontak</div>
              <div className="flex-1 min-w-[150px] text-slate-500 text-xs font-bold uppercase tracking-wider">Satelit</div>
              <div className="w-32 shrink-0 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">Kehadiran ({periode} Hr)</div>
              <div className="w-48 shrink-0 text-right text-slate-500 text-xs font-bold uppercase tracking-wider">Status Pastoral</div>
            </div>
            <div className="min-h-64">
              {filteredData.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">search_off</span>
                  <span className="text-sm">Tidak ada jemaat yang sesuai kriteria.</span>
                </div>
              ) : (
                filteredData.map((j) => (
                  <div key={j.id} className="w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="w-80 shrink-0 flex flex-col pr-4">
                      <span className="text-slate-900 font-bold text-sm truncate">{j.nama_lengkap}</span>
                      <span className="text-slate-400 text-xs mt-0.5">ID: {j.no_induk || '-'}</span>
                    </div>
                    <div className="w-40 shrink-0 text-slate-600 text-sm">{j.no_hp || '-'}</div>
                    <div className="flex-1 min-w-[150px] text-slate-600 text-sm truncate">{j.nama_satelit || '-'}</div>
                    <div className="w-32 shrink-0 text-center">
                      <span className="text-lg font-black text-slate-800">{j.jumlah_hadir}</span>
                      <span className="text-xs text-slate-400 font-medium ml-1">kali</span>
                    </div>
                    <div className="w-48 shrink-0 flex justify-end">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColors[j.status_kehadiran as keyof typeof statusColors]}`}>
                        {j.status_kehadiran}
                      </span>
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
