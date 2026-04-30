'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';

const STEPS = ['Menunggu', 'Ditugaskan', 'Ditindaklanjuti', 'Selesai'];

// Helper for step description
const getStepDescription = (step: string) => {
  switch (step) {
    case 'Menunggu': return 'Permintaan telah diterima';
    case 'Ditugaskan': return 'Telah ditetapkan penanggung jawab';
    case 'Ditindaklanjuti': return 'Sedang dalam proses pelayanan';
    case 'Selesai': return 'Pelayanan telah selesai';
    default: return '';
  }
};

const getStepLabel = (step: string) => {
  if (step === 'Menunggu') return 'Diterima';
  return step;
}

export default function DetailPermintaanPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { showLoader, hideLoader } = useLoader();

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/layanan-pastoral/${id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setData(json.data);
        }
      } catch (error) {
        console.error('Error fetching detail', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleBatal = async () => {
    if (confirm('Apakah Anda yakin ingin membatalkan permintaan ini?')) {
      showLoader();
      try {
        // Implementasi pembatalan nanti
        alert('Fitur pembatalan akan diproses oleh admin.');
      } finally {
        hideLoader();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full min-h-screen flex flex-col bg-[#F9FAFB] p-5">
         <div className="w-full py-16 flex flex-col items-center justify-center text-center mt-20">
            <h3 className="text-lg font-bold text-slate-600">Tiket Tidak Ditemukan</h3>
            <button onClick={() => router.push('/layanan-pastoral')} className="mt-4 px-4 py-2 bg-slate-200 rounded-lg text-slate-700 font-bold">Kembali</button>
         </div>
      </div>
    );
  }

  const currentStatusIndex = STEPS.indexOf(data.status_permohonan);
  const isCanceled = data.status_permohonan === 'Dibatalkan';

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    d.setHours(d.getHours() + 7);
    return new Intl.DateTimeFormat('id-ID', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    }).format(d) + ' WIB';
  };

  // Helper untuk mendapatkan waktu log untuk step tertentu
  const getLogTimeForStep = (step: string) => {
    const log = data.logs.find((l: any) => l.status === step);
    return log ? formatDate(log.waktu) : null;
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#F9FAFB] overflow-y-auto font-sans pb-24 relative">
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-[#F9FAFB]/90 backdrop-blur-xl pt-6 pb-4 px-5">
        <div className="flex items-center gap-4">
           <Link href="/layanan-pastoral" className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent hover:bg-slate-200 text-slate-800 transition-colors shrink-0">
             <span className="material-icons-round text-xl">arrow_back</span>
           </Link>
           <h1 className="text-lg font-bold text-slate-900 tracking-tight">Detail Permintaan</h1>
        </div>
      </div>

      <div className="w-full px-5 flex flex-col gap-6 max-w-md mx-auto pt-2">

        {/* SECTION 1: STATUS SAAT INI (TIMELINE) */}
        <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-slate-100 relative">
           <div className="flex justify-between items-center mb-6">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Status Saat Ini</span>
              <div className={`px-3 py-1.5 rounded-full text-[11px] font-bold text-white shadow-sm flex items-center gap-1.5 ${isCanceled ? 'bg-slate-500' : 'bg-blue-600'}`}>
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                {isCanceled ? 'Dibatalkan' : data.status_permohonan}
              </div>
           </div>

           <div className="flex flex-col relative pl-2">
              {/* Timeline Line BG */}
              <div className="absolute left-[13px] top-[14px] bottom-[20px] w-0.5 bg-slate-100 z-0"></div>
              {/* Timeline Line Active (Blue) */}
              {!isCanceled && currentStatusIndex >= 0 && (
                <div 
                  className="absolute left-[13px] top-[14px] w-0.5 bg-blue-600 z-0 transition-all duration-500"
                  style={{ height: `calc(${(currentStatusIndex / (STEPS.length - 1)) * 100}% - 20px)` }}
                ></div>
              )}

              {STEPS.map((step, idx) => {
                const isCompleted = currentStatusIndex > idx;
                const isCurrent = currentStatusIndex === idx;
                const isFuture = currentStatusIndex < idx;
                const logTime = getLogTimeForStep(step);

                if (isCanceled && isFuture) return null; // Sembunyikan langkah future jika batal

                return (
                  <div key={step} className="flex gap-4 relative z-10 mb-6 last:mb-0">
                     {/* Circle Indicator */}
                     <div className="w-7 h-7 flex items-center justify-center bg-white shrink-0 pt-0.5">
                       {isCompleted ? (
                         <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shadow-sm">
                           <span className="material-icons-round text-white text-[14px]">check</span>
                         </div>
                       ) : isCurrent ? (
                         <div className="w-6 h-6 rounded-full border-2 border-blue-600 flex items-center justify-center bg-white shadow-sm">
                           <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                         </div>
                       ) : (
                         <div className="w-6 h-6 rounded-full border-2 border-slate-200 bg-white"></div>
                       )}
                     </div>
                     {/* Text Content */}
                     <div className="flex flex-col pt-0.5">
                       <span className={`text-[15px] font-bold ${isFuture ? 'text-slate-300' : isCurrent ? 'text-blue-700' : 'text-slate-900'}`}>
                         {getStepLabel(step)}
                       </span>
                       <span className={`text-[11px] mt-0.5 ${isFuture ? 'text-slate-200' : 'text-slate-400'}`}>
                         {logTime || getStepDescription(step)}
                       </span>
                     </div>
                  </div>
                );
              })}
           </div>
        </div>

        {/* SECTION 2: INFORMASI PELAYANAN */}
        <div className="flex flex-col gap-2.5">
           <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-1">Informasi Pelayanan</span>
           <div className="bg-white rounded-[24px] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col gap-5">
              
              <div className="flex gap-4 items-start">
                 <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-[20px]">medical_services</span>
                 </div>
                 <div className="flex flex-col pt-1">
                    <span className="text-[11px] text-slate-400 font-medium">Jenis Layanan</span>
                    <span className="text-[14px] font-medium text-slate-800 leading-snug">{data.jenis_layanan}</span>
                 </div>
              </div>
              <div className="h-px w-full bg-slate-100 ml-14"></div>

              <div className="flex gap-4 items-start">
                 <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-[20px]">person</span>
                 </div>
                 <div className="flex flex-col pt-1">
                    <span className="text-[11px] text-slate-400 font-medium">Nama Pemohon / Target</span>
                    <span className="text-[14px] font-medium text-slate-800 leading-snug">{data.target_pelayanan}</span>
                 </div>
              </div>
              <div className="h-px w-full bg-slate-100 ml-14"></div>

              <div className="flex gap-4 items-start">
                 <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <span className="material-icons-round text-[20px]">description</span>
                 </div>
                 <div className="flex flex-col pt-1">
                    <span className="text-[11px] text-slate-400 font-medium">Keterangan</span>
                    <span className="text-[13px] text-slate-700 leading-relaxed mt-1">
                       {data.keterangan || '-'}
                    </span>
                 </div>
              </div>

              {(data.jadwal_tanggal && data.jadwal_waktu) && (
                <>
                  <div className="h-px w-full bg-slate-100 ml-14"></div>
                  <div className="flex gap-4 items-start">
                     <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <span className="material-icons-round text-[20px]">event_available</span>
                     </div>
                     <div className="flex flex-col pt-1">
                        <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider">Jadwal Pelaksanaan Fix</span>
                        <span className="text-[14px] font-bold text-slate-800 leading-snug mt-0.5">
                           {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(data.jadwal_tanggal))}
                        </span>
                        <span className="text-[13px] font-medium text-slate-500 mt-0.5 flex items-center gap-1">
                          <span className="material-icons-round text-[14px]">schedule</span>
                          Pukul {data.jadwal_waktu.substring(0, 5)} WIB
                        </span>
                     </div>
                  </div>
                </>
              )}

           </div>
        </div>

        {/* SECTION 3: PENANGGUNG JAWAB (IF EXISTS) */}
        {data.penanggung_jawab && (
          <div className="flex flex-col gap-2.5">
             <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-1">Penanggung Jawab</span>
             <div className="bg-white rounded-[24px] p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                   <div className="w-12 h-12 bg-blue-100 rounded-full border-2 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                      <span className="material-icons-round text-blue-500 text-2xl">account_circle</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[15px] font-black text-slate-800">{data.penanggung_jawab.nama}</span>
                      <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                        <span className="material-icons-round text-[12px]">badge</span>
                        <span className="text-[11px] font-medium">{data.penanggung_jawab.role}</span>
                      </div>
                   </div>
                </div>
                <button className="w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-colors">
                   <span className="material-icons-round text-[18px]">chat</span>
                </button>
             </div>
          </div>
        )}

        {/* SECTION 4: CATATAN PENYELESAIAN */}
        <div className="flex flex-col gap-2.5 mt-2">
           <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest pl-1">Catatan Penyelesaian</span>
           <div className="bg-[#F3F4F9] rounded-[24px] p-6 border border-[#E5E7EB] flex flex-col items-center justify-center text-center min-h-[120px]">
              {data.catatan_penyelesaian ? (
                 <p className="text-[13px] text-slate-700 font-medium leading-relaxed italic">
                   "{data.catatan_penyelesaian}"
                 </p>
              ) : (
                 <>
                   <span className="material-icons-round text-3xl text-slate-300 mb-2">edit_note</span>
                   <span className="text-[13px] text-slate-500 font-medium">Belum ada catatan.</span>
                   <span className="text-[11px] text-slate-400 mt-0.5">Catatan akan muncul setelah pelayanan selesai.</span>
                 </>
              )}
           </div>
        </div>

        {/* BATALKAN BUTTON */}
        {(!isCanceled && currentStatusIndex < STEPS.length - 1) && (
          <button 
            onClick={handleBatal}
            className="w-full mt-4 py-4 bg-white border border-slate-200 hover:bg-slate-50 rounded-[20px] text-slate-600 font-bold text-[14px] flex items-center justify-center gap-2 transition-all"
          >
            <span className="material-icons-round text-[18px]">cancel</span>
            Batalkan Permintaan
          </button>
        )}

      </div>
    </div>
  );
}
