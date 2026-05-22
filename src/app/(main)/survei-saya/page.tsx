'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';

export default function SurveiSayaPage() {
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();

  const [activeSurveys, setActiveSurveys] = useState<any[]>([]);
  const [surveyHistory, setSurveyHistory] = useState<any[]>([]);
  const [filterChip, setFilterChip] = useState('Semua');

  // ── Survey Modal State (same pattern as dashboard) ──
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<number, any>>({});
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const [activeRes, historyRes] = await Promise.all([
          fetch('/api/survei/saya'),
          fetch('/api/survei/saya/riwayat'),
        ]);
        const activeData = await activeRes.json();
        const historyData = await historyRes.json();
        if (activeData.success) setActiveSurveys(activeData.data || []);
        if (historyData.success) setSurveyHistory(historyData.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        hideLoader();
      }
    };
    fetchData();
  }, []);

  const handleSubmitSurvey = async () => {
    if (!selectedSurvey || isSubmittingSurvey) return;
    setIsSubmittingSurvey(true);
    try {
      const res = await fetch('/api/survei/saya/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survei_id: selectedSurvey.id,
          jawaban: Object.entries(surveyAnswers).map(([pertanyaanId, ans]) => ({
            pertanyaan_id: Number(pertanyaanId),
            ...ans,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitSuccess(true);
        // Refresh data in background
        const [activeRes, historyRes] = await Promise.all([
          fetch('/api/survei/saya'),
          fetch('/api/survei/saya/riwayat'),
        ]);
        const activeData = await activeRes.json();
        const historyData = await historyRes.json();
        if (activeData.success) setActiveSurveys(activeData.data || []);
        if (historyData.success) setSurveyHistory(historyData.data || []);
        // Auto-close after 3 seconds
        setTimeout(() => {
          setIsSurveyModalOpen(false);
          setSelectedSurvey(null);
          setSubmitSuccess(false);
        }, 3000);
      } else {
        alert(data.message || 'Gagal mengirim survei. Silakan coba lagi.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan. Pastikan koneksi internet Anda stabil.');
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  const filteredHistory = surveyHistory.filter((h: any) => {
    if (filterChip === 'Semua') return true;
    if (filterChip === 'Pasca-Kegiatan') return !!h.nama_kegiatan;
    if (filterChip === 'Survei Umum') return !h.nama_kegiatan;
    return true;
  });

  const chips = ['Semua', 'Pasca-Kegiatan', 'Survei Umum'];

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col font-sans pb-24">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 pt-6 pb-4 px-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 mb-4">
           <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
             <span className="material-icons-round text-xl">arrow_back</span>
           </Link>
           <h1 className="text-xl font-black text-slate-800 tracking-tight">Survei Saya</h1>
        </div>

        {/* ── STATISTIK ── */}
        <div className="w-full grid grid-cols-2 gap-3 mb-4">
           <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-4 flex flex-col shadow-sm">
              <span className="material-icons-round absolute -bottom-4 -right-3 text-[70px] text-slate-100 pointer-events-none transform -rotate-12">pending_actions</span>
              <div className="relative z-10 flex flex-col h-full">
                 <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Belum Diisi</span>
                 <div className="flex items-baseline gap-1 mt-auto pt-3">
                    <h2 className="text-3xl font-black text-slate-800 leading-none">{activeSurveys.length}</h2>
                    <span className="text-xs font-bold text-slate-500">survei</span>
                 </div>
              </div>
           </div>
           
           <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-4 flex flex-col shadow-md shadow-emerald-500/20">
              <span className="material-icons-round absolute -bottom-4 -right-3 text-[70px] text-white/10 pointer-events-none transform rotate-12">task_alt</span>
              <div className="relative z-10 flex flex-col h-full">
                 <span className="text-emerald-200 text-[10px] font-bold uppercase tracking-wider mb-2">Sudah Diisi</span>
                 <div className="flex items-baseline gap-1 mt-auto pt-3">
                    <h2 className="text-3xl font-black text-white leading-none">{surveyHistory.length}</h2>
                    <span className="text-xs font-bold text-emerald-200">survei</span>
                 </div>
              </div>
           </div>
        </div>

        {/* ── FILTER CHIPS ── */}
        <div className="flex overflow-x-auto gap-2 pb-1 pt-1 scrollbar-hide">
           {chips.map(kat => (
             <button 
               key={kat} 
               onClick={() => setFilterChip(kat)}
               className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold border transition-all duration-200 ${filterChip === kat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
             >
               {kat}
             </button>
           ))}
        </div>
      </div>

      {/* ── ACTIVE SURVEYS ── */}
      {activeSurveys.length > 0 && (
        <div className="px-5 pt-6 flex flex-col gap-3">
          <h2 className="text-[11px] font-black text-slate-400 tracking-widest uppercase px-1">Menunggu Diisi</h2>
          {activeSurveys.map((s: any) => (
            <div 
              key={s.id}
              onClick={() => {
                setSelectedSurvey(s);
                const initialAnswers: Record<number, any> = {};
                s.pertanyaan.forEach((q: any) => {
                  initialAnswers[q.id] = q.tipe_jawaban === 'skala' ? { skor: 5 } : { jawaban_teks: '' };
                });
                setSurveyAnswers(initialAnswers);
                setIsSurveyModalOpen(true);
              }}
              className="w-full bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-100 rounded-[20px] p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                  <span className="material-icons-round text-xl">poll</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-800 font-black text-sm group-hover:text-amber-600 transition-colors">{s.judul}</span>
                    {s.is_anonim && (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-bold rounded-full border border-emerald-200 flex items-center gap-0.5 shrink-0">
                        <span className="material-icons-round text-[10px]">visibility_off</span>Anonim
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-[11px] font-medium">
                    {s.nama_kegiatan ? `Pasca-Kegiatan: ${s.nama_kegiatan}` : 'Survei Umum'}
                  </span>
                </div>
              </div>
              <span className="material-icons-round text-slate-300 group-hover:text-amber-500 transition-all">chevron_right</span>
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORY LIST ── */}
      <div className="px-5 py-6 flex flex-col gap-3">
        <h2 className="text-[11px] font-black text-slate-400 tracking-widest uppercase px-1">Riwayat Survei</h2>
        {filteredHistory.length === 0 ? (
          <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-100 border-dashed rounded-[20px]">
             <span className="material-icons-round text-5xl mb-3 opacity-50">inbox</span>
             <p className="text-sm font-medium">Belum ada survei yang pernah Anda isi.</p>
          </div>
        ) : (
          filteredHistory.map((h: any) => {
            const tanggal = h.tanggal_diisi ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(h.tanggal_diisi)) : '-';
            const skor = parseFloat(h.rata_rata_skor) || 0;
            return (
              <div key={h.id} className="bg-white rounded-[20px] p-4 border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] w-full flex gap-3 relative overflow-hidden">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <span className="material-icons-round text-2xl">task_alt</span>
                 </div>
                 <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 pr-14">
                    <span className="text-[15px] font-black text-slate-900 leading-snug line-clamp-2">{h.judul}</span>
                    <span className="text-slate-400 text-[11px] font-medium">
                       {h.nama_kegiatan ? `Pasca-Kegiatan: ${h.nama_kegiatan}` : 'Survei Umum'}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                       <span className="text-[11px] font-bold text-slate-400">
                         <i className="material-icons-round text-[12px] align-middle mr-1">event</i>
                         Diisi: {tanggal}
                       </span>
                       {h.is_anonim && (
                         <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-full border border-slate-200">Anonim</span>
                       )}
                    </div>
                 </div>
                 {/* Skor badge */}
                 <div className="absolute top-4 right-4 flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg border border-amber-100">
                    <span className="material-icons-round text-[14px]">star</span>
                    <span className="text-[12px] font-black">{skor > 0 ? skor.toFixed(1) : '-'}</span>
                 </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── SURVEY FILL BOTTOM SHEET ── */}
      {isSurveyModalOpen && selectedSurvey && (
        <SurveyBottomSheet
          survey={selectedSurvey}
          answers={surveyAnswers}
          setAnswers={setSurveyAnswers}
          isSubmitting={isSubmittingSurvey}
          isSuccess={submitSuccess}
          onSubmit={handleSubmitSurvey}
          onClose={() => { setIsSurveyModalOpen(false); setSubmitSuccess(false); }}
        />
      )}
    </div>
  );
}

/* ── Draggable Bottom Sheet (same animation as Pengaturan Akun) ── */
function SurveyBottomSheet({
  survey, answers, setAnswers, isSubmitting, isSuccess, onSubmit, onClose,
}: {
  survey: any;
  answers: Record<number, any>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, any>>>;
  isSubmitting: boolean;
  isSuccess: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const [isClosing, setIsClosing] = useState(false);

  const closeSheet = () => {
    setIsClosing(true);
    setTimeout(() => { onClose(); }, 400);
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none">
      {/* Backdrop — same as Pengaturan Akun */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
        onClick={closeSheet}
        style={{
          animation: isClosing
            ? 'settings-backdrop-out 0.4s ease-out forwards'
            : 'settings-backdrop-in 0.3s ease-out forwards',
        }}
      />

      {/* Sheet — same animation as Pengaturan Akun */}
      <div
        className="w-full max-w-lg mx-auto bg-white rounded-t-3xl max-h-[85vh] flex flex-col pointer-events-auto relative z-10 overflow-hidden"
        style={{
          animation: isClosing
            ? 'settings-slide-down 0.4s cubic-bezier(0.8, 0, 0.8, 0.2) forwards'
            : 'settings-slide-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber indicator — same as Pengaturan Akun */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-2 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-1 border-b border-slate-100 shrink-0">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-black text-slate-800">{survey.judul}</h2>
            <span className="text-slate-400 text-xs font-medium">
              {survey.nama_kegiatan ? `Pasca-Kegiatan: ${survey.nama_kegiatan}` : 'Survei Umum'}
            </span>
            {survey.is_anonim && (
              <div className="flex items-center gap-1.5 mt-0.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                <span className="material-icons-round text-emerald-600 text-[14px]">visibility_off</span>
                <span className="text-emerald-700 text-[11px] font-bold">Survei Anonim — identitas Anda tidak akan dicatat</span>
              </div>
            )}
          </div>
          <button onClick={closeSheet} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
            <span className="material-icons-round text-lg">close</span>
          </button>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 gap-4">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center" style={{ animation: 'settings-slide-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>
              <span className="material-icons-round text-4xl text-emerald-600">check_circle</span>
            </div>
            <h3 className="text-xl font-black text-slate-800">Terima Kasih! 🎉</h3>
            <p className="text-sm text-slate-500 text-center max-w-xs leading-relaxed">
              Respons Anda telah berhasil dikirim.
              {survey.is_anonim && (
                <><br /><span className="text-emerald-600 font-bold">Survei ini bersifat anonim</span> — identitas Anda tidak akan ditampilkan kepada pengelola.</>)}
            </p>
            <div className="mt-2 px-3 py-1.5 bg-slate-100 rounded-full">
              <span className="text-[11px] font-bold text-slate-400">Menutup otomatis...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
              {survey.pertanyaan?.map((q: any, idx: number) => (
                <div key={q.id} className="flex flex-col gap-3">
                  <p className="text-sm font-bold text-slate-700">
                    <span className="text-indigo-500 mr-1.5">{idx + 1}.</span>
                    {q.teks_pertanyaan}
                  </p>
                  {q.tipe_jawaban === 'skala' ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between px-1">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { skor: val } }))}
                            className={`w-12 h-12 rounded-2xl text-lg font-black transition-all duration-200 ${
                              answers[q.id]?.skor === val
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between px-2">
                        <span className="text-[10px] font-bold text-slate-400">Sangat Buruk</span>
                        <span className="text-[10px] font-bold text-slate-400">Sangat Baik</span>
                      </div>
                    </div>
                  ) : (
                    <textarea
                      value={answers[q.id]?.jawaban_teks || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: { jawaban_teks: e.target.value } }))}
                      className="w-full border border-slate-200 rounded-2xl p-3 text-sm text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      rows={3}
                      placeholder="Tulis jawaban Anda..."
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] border-t border-slate-100 shrink-0">
              <button
                onClick={onSubmit}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
              >
                {isSubmitting ? (
                  <span className="material-icons-round animate-spin text-lg">refresh</span>
                ) : (
                  <span className="material-icons-round text-lg">send</span>
                )}
                {isSubmitting ? 'Mengirim...' : 'Kirim Survei'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

