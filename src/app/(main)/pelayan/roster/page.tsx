'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function RosterPelayanPage() {
  const [rosterData, setRosterData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  
  // Filters
  const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString());
  const [filterYear, setFilterYear] = useState((new Date().getFullYear()).toString());
  const [filterSatelit, setFilterSatelit] = useState('');

  // User auth state
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      try {
        const [resSatelit, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/auth/me')
        ]);
        
        if (resSatelit.ok) {
          const text = await resSatelit.text();
          try {
            const data = JSON.parse(text);
            if (data.success) setSatelitOptions(data.data);
          } catch (e) {}
        }

        if (resUser.ok) {
          const authData = await resUser.json();
          setUserData(authData);
          if (authData.role_name?.toUpperCase().includes('SATELIT')) {
            setFilterSatelit(authData.satelit_id?.toString() || '');
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial options & user:', err);
      }
    };
    fetchOptionsAndUser();
  }, []);

  useEffect(() => {
    const fetchRoster = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          month: filterMonth,
          year: filterYear,
        });
        if (filterSatelit) queryParams.append('satelit_id', filterSatelit);

        const res = await fetch(`/api/pelayan/roster?${queryParams.toString()}`);
        const result = await res.json();

        if (result.success) {
          setRosterData(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch roster data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoster();
  }, [filterMonth, filterYear, filterSatelit]);

  // Group data by Date
  const groupedByDate = rosterData.reduce((acc: any, curr: any) => {
    const date = new Date(curr.tanggal_mulai).toISOString().split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(curr);
    return acc;
  }, {});

  const dates = Object.keys(groupedByDate).sort();

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      {/* Breadcrumbs & Title */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <Link href="/dashboard" className="text-slate-500 hover:text-violet-600">Manajemen User</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/pelayan" className="text-slate-500 hover:text-violet-600">Pelayan</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Kalender Roster</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Kalender Roster</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Daftar Jadwal Penugasan Pelayan</div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="w-full p-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 flex flex-col gap-1 w-full">
          <label className="text-slate-500 text-xs font-bold font-sans uppercase">Bulan</label>
          <select 
            value={filterMonth} 
            onChange={e => setFilterMonth(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m.toString()}>{new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 flex flex-col gap-1 w-full">
          <label className="text-slate-500 text-xs font-bold font-sans uppercase">Tahun</label>
          <input 
            type="number" 
            value={filterYear} 
            onChange={e => setFilterYear(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex-1 flex flex-col gap-1 w-full">
          <label className="text-slate-500 text-xs font-bold font-sans uppercase">Satelit</label>
          <select 
            value={filterSatelit} 
            onChange={e => setFilterSatelit(e.target.value)}
            disabled={userData?.role_name?.toUpperCase().includes('SATELIT')}
            className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-70"
          >
            <option value="">Semua Satelit</option>
            {satelitOptions.map(s => (
              <option key={s.id} value={s.id.toString()}>{s.nama_satelit}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Roster List View */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-violet-600 animate-spin"></div>
        </div>
      ) : dates.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center p-16 bg-white border border-slate-200 rounded-xl text-slate-400">
          <span className="material-icons-round text-5xl opacity-50 mb-4">event_busy</span>
          <p className="font-sans">Tidak ada data jadwal / roster pada bulan ini.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {dates.map((dateStr) => {
            const dateObj = new Date(dateStr);
            const items = groupedByDate[dateStr];
            
            return (
              <div key={dateStr} className="w-full flex flex-col md:flex-row gap-6">
                {/* Date Left Column */}
                <div className="w-32 shrink-0 flex flex-col items-start gap-1 pt-2">
                  <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">{dateObj.toLocaleString('id-ID', { weekday: 'long' })}</span>
                  <span className="text-slate-900 text-3xl font-black">{dateObj.getDate()}</span>
                  <span className="text-slate-500 text-sm font-medium">{dateObj.toLocaleString('id-ID', { month: 'short', year: 'numeric' })}</span>
                </div>
                
                {/* Cards Container */}
                <div className="flex-1 flex flex-col gap-3">
                  {items.map((item: any) => {
                    let statusColor = 'bg-slate-100 text-slate-600';
                    if (item.status_konfirmasi === 'Hadir' || item.status_konfirmasi === 'Bersedia') statusColor = 'bg-emerald-100 text-emerald-700';
                    if (item.status_konfirmasi === 'Berhalangan' || item.status_konfirmasi === 'Tidak Hadir') statusColor = 'bg-rose-100 text-rose-700';
                    if (item.status_konfirmasi === 'Menunggu Konfirmasi') statusColor = 'bg-amber-100 text-amber-700';

                    return (
                      <div key={item.roster_id} className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col lg:flex-row gap-4 lg:items-center hover:shadow-md transition-shadow">
                        
                        <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:items-center min-w-0">
                          {/* Kegiatan Info */}
                          <div className="w-full lg:w-1/3 flex flex-col">
                            <span className="text-slate-900 font-bold font-sans truncate">{item.nama_kegiatan}</span>
                            <div className="flex items-center gap-2 mt-1 text-slate-500 text-xs">
                              <span className="material-icons-round text-[14px]">schedule</span>
                              <span className="font-sans">{item.waktu_mulai?.substring(0, 5)} WIB</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-xs truncate">
                              <span className="material-icons-round text-[14px]">location_on</span>
                              <span className="truncate">{item.lokasi_kegiatan}</span>
                            </div>
                          </div>

                          <div className="hidden lg:block w-px h-10 bg-slate-200 shrink-0 mx-2"></div>

                          {/* Role Info */}
                          <div className="w-full lg:w-1/4 flex flex-col justify-center">
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Peran / Role</span>
                            <span className="px-2.5 py-1 bg-slate-50 text-slate-700 rounded-md border border-slate-200 text-xs font-semibold w-fit">
                              {item.nama_role}
                            </span>
                          </div>

                          <div className="hidden lg:block w-px h-10 bg-slate-200 shrink-0 mx-2"></div>

                          {/* Pelayan Info */}
                          <div className="flex-1 flex items-center gap-3 min-w-0">
                            <img 
                              src={item.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.nama_lengkap)}&background=random`} 
                              alt="Avatar" 
                              className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-slate-900 text-sm font-bold truncate">
                                <Link href={`/pelayan/${item.pelayan_id}?mode=view`} className="hover:text-violet-600 transition-colors">
                                  {item.nama_lengkap}
                                </Link>
                              </span>
                              <span className="text-slate-500 text-[11px] truncate">ID Pelayan: #{item.pelayan_id}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="shrink-0 flex items-center lg:justify-end border-t border-slate-100 lg:border-t-0 pt-3 lg:pt-0 mt-2 lg:mt-0">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize ${statusColor}`}>
                            {item.status_konfirmasi}
                          </span>
                        </div>
                        
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
