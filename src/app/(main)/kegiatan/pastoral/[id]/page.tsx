'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLoader } from '@/components/ui/GlobalLoader';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function AdminPastoralDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { showLoader, hideLoader } = useLoader();

  const [ticketId, setTicketId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [callerRole, setCallerRole] = useState<string>('');
  const [isCurrentPJ, setIsCurrentPJ] = useState<boolean>(false);

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  // Action Modals State
  const [isSelesaiModalOpen, setIsSelesaiModalOpen] = useState(false);
  const [catatanPenyelesaian, setCatatanPenyelesaian] = useState('');
  
  const [isBatalModalOpen, setIsBatalModalOpen] = useState(false);
  const [alasanPembatalan, setAlasanPembatalan] = useState('');

  // Assign PIC Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [picOptions, setPicOptions] = useState<any[]>([]);
  const [picSearch, setPicSearch] = useState('');
  const [debouncedPicSearch, setDebouncedPicSearch] = useState('');
  const [picRoleFilter, setPicRoleFilter] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [tanggalFix, setTanggalFix] = useState('');
  const [waktuFix, setWaktuFix] = useState('');

  useEffect(() => {
    if (id) {
      setTicketId(id);
    }
  }, [id]);

  const fetchData = async () => {
    if (!ticketId) return;
    showLoader();
    try {
      const res = await fetch(`/api/kegiatan/pastoral/${ticketId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json.data.ticket);
          setLogs(json.data.logs);
          setCallerRole((json.data.caller_role || '').toUpperCase());
          setIsCurrentPJ(!!json.data.is_current_pj);
        } else {
          setSubmitState({ status: 'error', message: json.message || 'Tiket tidak ditemukan' });
        }
      } else {
        let errorMsg = `Gagal mengambil data (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson.message) errorMsg = errJson.message;
        } catch(e) {}
        setSubmitState({ status: 'error', message: errorMsg });
      }
    } catch (e) {
      console.error(e);
      setSubmitState({ status: 'error', message: 'Gagal mengambil detail tiket' });
    } finally {
      hideLoader();
    }
  };

  useEffect(() => {
    fetchData();
  }, [ticketId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPicSearch(picSearch), 300);
    return () => clearTimeout(timer);
  }, [picSearch]);

  useEffect(() => {
    if (!assignModalOpen) return;
    const fetchPics = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (debouncedPicSearch) queryParams.append('search', debouncedPicSearch);
        if (picRoleFilter) queryParams.append('jabatan_id', picRoleFilter);
        const res = await fetch(`/api/kegiatan/pastoral/pic-options?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setPicOptions(json.data);
        }
      } catch (error) {
        console.error('Failed to fetch PICs', error);
      }
    };
    fetchPics();
  }, [assignModalOpen, debouncedPicSearch, picRoleFilter]);

  const handleAssign = async (pengurusId: number) => {
    if (!ticketId) return;
    if (!tanggalFix || !waktuFix) {
      alert("Harap lengkapi Tanggal Fix dan Jam Fix terlebih dahulu!");
      return;
    }
    setAssignLoading(true);
    setSubmitState({ status: 'loading', message: 'Menugaskan Penanggung Jawab...' });
    setAssignModalOpen(false);
    try {
      const res = await fetch(`/api/kegiatan/pastoral/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengguna_id: pengurusId, tanggal_fix: tanggalFix, waktu_fix: waktuFix })
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Penanggung Jawab berhasil ditugaskan!' });
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
        fetchData();
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal menugaskan PIC' });
      }
    } catch (error) {
      console.error(error);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
    } finally {
      setAssignLoading(false);
    }
  };

  const handleStatusChange = async (status: string, extraData: any = {}) => {
    if (!ticketId) return;
    setSubmitState({ status: 'loading', message: `Memperbarui status menjadi ${status}...` });
    setIsSelesaiModalOpen(false);
    setIsBatalModalOpen(false);
    
    try {
      const res = await fetch(`/api/kegiatan/pastoral/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extraData })
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: `Tiket berhasil diperbarui` });
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
        fetchData();
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal memperbarui status' });
      }
    } catch (error) {
      console.error(error);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
    }
  };

  if (!data) {
    if (submitState.status === 'error') {
      return (
        <div className="w-full py-12 flex flex-col items-center justify-center text-rose-500">
           <span className="material-icons-round text-5xl mb-2">error_outline</span>
           <span className="text-lg font-bold">{submitState.message}</span>
           <button onClick={() => router.back()} className="mt-4 text-blue-500 underline text-sm">Kembali</button>
        </div>
      );
    }
    return (
      <div className="w-full py-20 flex justify-center items-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    // Memperbaiki double-loss timezone (DB menyimpan UTC sebagai timestamp without timezone, lalu pg Node menganggapnya WIB)
    const d = new Date(dateString);
    d.setHours(d.getHours() + 7);
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d) + ' WIB';
  };

  const formatKegiatanDate = (tanggal: string, waktu: string) => {
    if (!tanggal) return '-';
    const d = new Date(tanggal);
    const hari = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(d);
    const tgl = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
    const jam = waktu ? waktu.substring(0, 5).replace(':', '.') + ' WIB' : '';
    return `${hari}, ${tgl}${jam ? ' • ' + jam : ''}`;
  };

  const renderStatusBadge = (status: string) => {
    let colorClass = "bg-slate-100 text-slate-600 border-slate-200"; 
    if (status === 'Menunggu') colorClass = "bg-orange-100 text-orange-700 border-orange-200";
    else if (status === 'Ditugaskan') colorClass = "bg-amber-100 text-amber-700 border-amber-200";
    else if (status === 'Ditindaklanjuti') colorClass = "bg-blue-100 text-blue-700 border-blue-200";
    else if (status === 'Selesai') colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
    else if (status === 'Dibatalkan') colorClass = "bg-slate-100 text-slate-600 border-slate-200";

    return (
      <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wide border ${colorClass}`}>
        {status}
      </span>
    );
  };

  const isFinalStatus = data.status_permohonan === 'Selesai' || data.status_permohonan === 'Dibatalkan';
  const isSekretaris = ['SEKRETARIS_PUSAT', 'SUPER_ADMIN'].includes(callerRole);
  const isMajelisOrGembala = ['MAJELIS', 'GEMBALA_SIDANG', 'GEMBALA_SATELIT'].includes(callerRole);
  // isCurrentPJ: di-set dari server (is_current_pj), bukan dihitung di client

  return (
    <div className="w-full flex justify-center items-start pb-20 relative animate-in fade-in slide-in-from-bottom-2">
      {(submitState.status !== 'idle') && <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />}

      <div className="w-full max-w-[1200px] flex flex-col gap-6">
        
        {/* Breadcrumb */}
        <div className="w-full inline-flex justify-start items-center gap-2 text-xs font-medium font-sans leading-4">
          <span className="text-slate-500">Modul Kegiatan</span>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <Link href="/kegiatan/pastoral" className="text-slate-500 hover:text-blue-600">Layanan Pastoral</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">Detail Tiket</span>
        </div>

        {/* Header Title Card */}
        <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-bl-full opacity-50 pointer-events-none"></div>
          
          <div className="flex justify-between items-start z-10 w-full">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-center">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase tracking-wide border border-blue-200">
                  {data.nomor_tiket}
                </span>
                {renderStatusBadge(data.status_permohonan)}
                {data.is_urgent && (
                   <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded text-xs font-bold uppercase tracking-wide border border-rose-200 flex items-center gap-1">
                     <span className="material-icons-round text-[14px]">warning</span> Urgent
                   </span>
                )}
              </div>
              <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mt-1">
                Layanan {data.nama_jenis_kegiatan}
              </h1>
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mt-1">
                 <span className="material-icons-round text-[18px]">person</span> 
                 Pemohon: {data.nama_pemohon} &bull; Target: {data.target_pelayanan}
              </div>
            </div>
            
            <div className="flex gap-3">
               {!isFinalStatus && (isSekretaris || (isCurrentPJ && isMajelisOrGembala)) && (
                 <button onClick={() => setIsBatalModalOpen(true)} className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-rose-600 font-bold hover:bg-rose-50 hover:border-rose-200 transition flex items-center gap-2 text-sm shadow-sm">
                   <span className="material-icons-round text-[18px]">cancel</span> Batalkan Tiket
                 </button>
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
                 <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-0.5">Diterima Pada</span>
                 <span className="text-[15px] font-bold text-slate-900">{formatDate(data.waktu_diterima)}</span>
               </div>
             </div>
             
             <div className="w-px h-12 bg-slate-200/80 hidden md:block"></div>

             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="material-icons-round text-[22px]">event_available</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-0.5">Jadwal Pelayanan</span>
                  <span className="text-[15px] font-bold text-slate-900">
                    {data.jadwal_tanggal
                      ? `${new Date(data.jadwal_tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}${
                          data.jadwal_waktu ? ' pukul ' + data.jadwal_waktu.substring(0, 5) + ' WIB' : ''
                        }`
                      : <span className="text-slate-400 font-medium text-sm">Belum ditetapkan</span>}
                  </span>
                </div>
              </div>

              <div className="w-px h-12 bg-slate-200/80 hidden md:block"></div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <span className="material-icons-round text-[22px]">manage_accounts</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-0.5">Penanggung Jawab</span>
                  <span className="text-[15px] font-bold text-slate-900 line-clamp-1">
                    {data.nama_penanggung_jawab
                      ? data.nama_penanggung_jawab
                      : <span className="text-slate-400 font-medium text-sm">Belum ditugaskan</span>}
                  </span>
                </div>
              </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="w-full border-b border-slate-200 mt-2">
          <div className="flex gap-8">
            <button className="pb-4 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 border-blue-600 text-blue-600 flex items-center gap-2">
              <span className="material-icons-round text-[18px]">info</span> Ringkasan & Tindakan
            </button>
            <button className="pb-4 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 border-transparent text-slate-400 flex items-center gap-2 cursor-default">
              <span className="material-icons-round text-[18px]">history</span> Riwayat Status
            </button>
          </div>
        </div>

        {/* GRID LAYOUT */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Kolom Kiri - Detail Utama */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Card Info Tambahan */}
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kontak Pemohon / Nomor HP</span>
                  {data.no_hp_kontak ? (
                    <a
                      href={`https://wa.me/${data.no_hp_kontak.replace(/\s+|-/g, '').replace(/^0/, '62').replace(/^(?!62)/, '62')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-green-600 bg-green-50 w-fit px-4 py-1.5 rounded-lg border border-green-100 flex items-center gap-2 hover:bg-green-100 transition-colors"
                    >
                      <span className="material-icons-round text-[16px]">chat</span>
                      {data.no_hp_kontak}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">-</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Keterangan Tambahan</span>
                  <div className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">
                    {data.keterangan || 'Tidak ada keterangan tambahan yang dicantumkan dari pemohon.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Card Penanggung Jawab */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-8 py-5 flex justify-between items-center">
                 <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                   <span className="material-icons-round text-violet-500">badge</span> Penanggung Jawab (PIC)
                 </h3>
                 {!data.nama_penanggung_jawab && !isFinalStatus && isSekretaris && (
                   <button onClick={() => setAssignModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors">
                     Tugaskan Sekarang
                   </button>
                 )}
              </div>
              <div className="p-8">
                {data.nama_penanggung_jawab ? (
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden shrink-0 border-2 border-white shadow-sm">
                      <img src={data.foto_penanggung_jawab || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nama_penanggung_jawab)}&background=random`} alt="PIC" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-slate-900">{data.nama_penanggung_jawab}</span>
                      <span className="text-sm font-medium text-slate-500">Ditugaskan pada {formatDate(data.waktu_ditugaskan)}</span>
                    </div>
                    {!isFinalStatus && isSekretaris && (
                      <button onClick={() => setAssignModalOpen(true)} className="ml-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-200 shadow-sm">
                        Ubah PIC
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-full py-8 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <span className="material-icons-round text-4xl text-slate-400 mb-3">person_search</span>
                    <span className="text-base font-bold text-slate-700">Belum Ada Penanggung Jawab</span>
                    <span className="text-sm text-slate-500 mt-1 max-w-sm text-center">Silakan tugaskan Pelayan atau Gembala untuk menangani permohonan pastoral ini.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Kegiatan Terkait - hanya tampil jika kegiatan sudah terbuat */}
            {data.kegiatan_id && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-8 py-5 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="material-icons-round text-blue-500">event</span> Kegiatan Terkait
                  </h3>
                  <Link
                    href={`/kegiatan/${data.kegiatan_id}`}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Lihat Detail Kegiatan
                    <span className="material-icons-round text-[14px]">arrow_forward</span>
                  </Link>
                </div>
                <div className="p-8">
                  <div className="flex flex-col gap-4">
                    {/* Nama Kegiatan */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Kegiatan</span>
                      <span className="text-sm font-bold text-slate-800">{data.kegiatan_nama}</span>
                    </div>

                    {/* Jadwal & Lokasi */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <span className="material-icons-round text-[18px]">calendar_today</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Jadwal Fix</span>
                          <span className="text-sm font-bold text-slate-800 leading-snug">
                            {formatKegiatanDate(data.kegiatan_tanggal, data.kegiatan_waktu)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                          <span className="material-icons-round text-[18px]">place</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Lokasi</span>
                          <span className="text-sm font-bold text-slate-800 leading-snug">
                            {data.kegiatan_lokasi || 'Tidak Spesifik'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Kegiatan */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Kegiatan:</span>
                      <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wide border ${
                        data.kegiatan_status === 'Selesai'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : data.kegiatan_status === 'Akan Datang'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : data.kegiatan_status === 'Berlangsung'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : data.kegiatan_status === 'Dibatalkan'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {data.kegiatan_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Catatan Penyelesaian Jika Ada */}
            {(data.catatan_penyelesaian || data.alasan_pembatalan) && (
              <div className={`border rounded-xl p-8 shadow-sm ${data.status_permohonan === 'Selesai' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                 <h3 className={`text-base font-bold flex items-center gap-2 mb-4 ${data.status_permohonan === 'Selesai' ? 'text-emerald-800' : 'text-rose-800'}`}>
                   <span className="material-icons-round">{data.status_permohonan === 'Selesai' ? 'task_alt' : 'cancel'}</span> 
                   {data.status_permohonan === 'Selesai' ? 'Catatan Pelayanan / Penyelesaian' : 'Alasan Pembatalan'}
                 </h3>
                 <p className={`text-sm leading-relaxed ${data.status_permohonan === 'Selesai' ? 'text-emerald-700' : 'text-rose-700'}`}>
                   {data.catatan_penyelesaian || data.alasan_pembatalan}
                 </p>
              </div>
            )}

          </div>

          {/* Kolom Kanan - Aksi & Timeline */}
          <div className="flex flex-col gap-6">
            
            {/* Panel Aksi Cepat */}
             {!isFinalStatus && (isSekretaris || isCurrentPJ) && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden sticky top-6">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-5">
                   <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><span className="material-icons-round text-blue-500">touch_app</span> Panel Aksi Pelayanan</h3>
                </div>
                <div className="p-6 flex flex-col gap-4">
                  {isSekretaris && data.status_permohonan === 'Menunggu' && (
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3">
                      <span className="material-icons-round text-orange-500 text-[20px]">info</span>
                      <p className="text-xs text-orange-800 leading-relaxed font-medium">Tugaskan PIC terlebih dahulu di Card Penanggung Jawab untuk dapat memproses status selanjutnya.</p>
                    </div>
                  )}
                  
                  {/* Hanya PJ Majelis/Gembala yang bisa tandai Ditindaklanjuti - Sekretaris tidak boleh */}
                  {isCurrentPJ && isMajelisOrGembala && data.status_permohonan === 'Ditugaskan' && (
                    <button onClick={() => handleStatusChange('Ditindaklanjuti')} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                      <span className="material-icons-round text-[18px]">play_arrow</span> Tandai Ditindaklanjuti
                    </button>
                  )}

                  {isCurrentPJ && data.status_permohonan === 'Ditindaklanjuti' && (
                    <button onClick={() => setIsSelesaiModalOpen(true)} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                      <span className="material-icons-round text-[18px]">done_all</span> Selesaikan Pelayanan
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Timeline Riwayat */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
               <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-6"><span className="material-icons-round text-slate-500">history</span> Jejak Audit Log</h3>
               
               <div className="relative pl-3 border-l-2 border-slate-100 flex flex-col gap-8 ml-2">
                  {logs.map((log: any, idx: number) => {
                    const isLatest = idx === logs.length - 1;
                    return (
                      <div key={log.id} className="relative">
                        {/* Node Bullet */}
                        <div className={`absolute -left-[18px] top-1 w-3 h-3 rounded-full border-2 border-white ${isLatest && !isFinalStatus ? 'bg-blue-500 animate-pulse' : (isLatest && data.status_permohonan === 'Selesai' ? 'bg-emerald-500' : 'bg-slate-300')}`}></div>
                        
                        <div className="flex flex-col gap-1 pl-4">
                          <span className="text-sm font-bold text-slate-900">{log.status_baru}</span>
                          <span className="text-[11px] font-bold text-slate-400 font-sans tracking-wide">{formatDate(log.created_at)}</span>
                          <p className="text-xs text-slate-600 leading-relaxed mt-1">{log.catatan_perubahan}</p>
                          {log.nama_pengubah && <span className="text-[10px] text-slate-400 mt-0.5 italic">Aktor: {log.nama_pengubah}</span>}
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* Selesai Modal */}
      {isSelesaiModalOpen && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4">
           <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsSelesaiModalOpen(false)}></div>
           <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-8 flex flex-col gap-5">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <span className="material-icons-round text-emerald-500 text-3xl">done_all</span> Selesaikan Permohonan
              </h3>
              <p className="text-sm text-slate-600 font-medium">Pelayanan pastoral ini telah selesai dilakukan. Silakan tulis kesaksian singkat atau catatan hasil kunjungan sebagai laporan resmi.</p>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catatan Pelayanan / Kesimpulan</label>
                <textarea 
                  className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[140px] transition-all bg-slate-50 hover:bg-white"
                  placeholder="Misal: Bapak Budi sudah dikunjungi dan didoakan, kondisi saat ini jauh lebih tenang..."
                  value={catatanPenyelesaian}
                  onChange={(e) => setCatatanPenyelesaian(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => setIsSelesaiModalOpen(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors">Batal</button>
                <button 
                  onClick={() => handleStatusChange('Selesai', { catatan_penyelesaian: catatanPenyelesaian })} 
                  disabled={!catatanPenyelesaian.trim()}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                >Simpan &amp; Selesai</button>
              </div>
           </div>
        </div>
      )}

      {/* Batal Modal */}
      {isBatalModalOpen && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4">
           <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsBatalModalOpen(false)}></div>
           <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-8 flex flex-col gap-5">
              <h3 className="text-2xl font-black text-rose-600 flex items-center gap-3">
                <span className="material-icons-round text-3xl">cancel</span> Batalkan Tiket
              </h3>
              <p className="text-sm text-slate-600 font-medium">Tindakan ini tidak dapat dibatalkan. Tiket yang dibatalkan akan ditutup secara permanen.</p>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alasan Pembatalan</label>
                <textarea 
                  className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 min-h-[120px] transition-all bg-slate-50 hover:bg-white"
                  placeholder="Misal: Jemaat membatalkan karena jadwal berhalangan..."
                  value={alasanPembatalan}
                  onChange={(e) => setAlasanPembatalan(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => setIsBatalModalOpen(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors">Kembali</button>
                <button 
                  onClick={() => handleStatusChange('Dibatalkan', { alasan_pembatalan: alasanPembatalan })} 
                  disabled={!alasanPembatalan.trim()}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                >Konfirmasi Batal</button>
              </div>
           </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setAssignModalOpen(false)}></div>
          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex justify-center items-center text-blue-600">
                  <span className="material-icons-round text-[24px]">assignment_ind</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{data.nama_penanggung_jawab ? 'Ubah Penanggung Jawab' : 'Tugaskan Penanggung Jawab'}</h3>
                  <p className="text-xs text-slate-500 font-medium">Pilih Majelis atau Gembala untuk tiket ini</p>
                </div>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="w-10 h-10 flex justify-center items-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            <div className="p-8 border-b border-slate-100 bg-white flex flex-col gap-5 shrink-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Fix (WIB) <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 font-medium transition-all"
                    value={tanggalFix}
                    onChange={(e) => setTanggalFix(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jam Fix (WIB) <span className="text-rose-500">*</span></label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 font-medium transition-all"
                    value={waktuFix}
                    onChange={(e) => setWaktuFix(e.target.value)}
                  />
                </div>
              </div>
              <hr className="border-slate-100" />
              <div className="relative">
                <span className="material-icons-round absolute left-5 top-4 text-slate-400 text-[20px]">search</span>
                <input 
                  type="text" 
                  placeholder="Cari nama Majelis atau Gembala..."
                  className="w-full pl-14 pr-5 py-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 font-sans text-sm transition-all"
                  value={picSearch}
                  onChange={(e) => setPicSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {picOptions.length === 0 ? (
                <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400">
                  <span className="material-icons-round text-5xl mb-3 opacity-50">group_off</span>
                  <span className="text-base font-bold text-slate-500">Tidak ada Majelis/Gembala ditemukan</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {picOptions.map(pic => (
                    <div key={pic.pengguna_id} className="w-full bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center hover:shadow-md hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex justify-center items-center text-slate-600 font-bold uppercase text-lg">
                          {pic.nama.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold text-base">{pic.nama}</span>
                          <span className="text-slate-500 text-sm font-medium">{pic.role}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAssign(pic.pengguna_id)}
                        disabled={assignLoading}
                        className="px-5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                      >
                        Pilih
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
