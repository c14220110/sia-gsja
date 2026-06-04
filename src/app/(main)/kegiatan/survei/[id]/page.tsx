'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import KeluhanTimeline from '@/components/survei/KeluhanTimeline';

export default function SurveiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [surveiId, setSurveiId] = useState<string>('');
  const [survei, setSurvei] = useState<any>(null);
  const [pertanyaan, setPertanyaan] = useState<any[]>([]);
  const [respons, setRespons] = useState<any[]>([]);
  const [tindakLanjut, setTindakLanjut] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'hasil' | 'respons' | 'keluhan'>('hasil');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  // Tindak Lanjut Modal
  const [tlModalOpen, setTlModalOpen] = useState(false);
  const [selectedTl, setSelectedTl] = useState<any>(null);
  const [tlStatus, setTlStatus] = useState('');
  const [tlCatatan, setTlCatatan] = useState('');

  // Timeline slide-in panel
  const [showKeluhanTimeline, setShowKeluhanTimeline] = useState(false);

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

  // Resolve params
  useEffect(() => {
    params.then(p => setSurveiId(p.id));
  }, [params]);

  // Fetch survei detail
  useEffect(() => {
    if (!surveiId) return;
    const fetchDetail = async () => {
      showLoader();
      try {
        const res = await fetch(`/api/survei/${surveiId}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            const d = result.data;
            setSurvei(d);
            setPertanyaan(d.pertanyaan || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch survei detail', error);
      } finally {
        hideLoader();
      }
    };
    fetchDetail();
  }, [surveiId, refreshTrigger]);

  // Fetch respons
  useEffect(() => {
    if (!surveiId || activeTab !== 'respons') return;
    const fetchRespons = async () => {
      try {
        const res = await fetch(`/api/survei/${surveiId}/respons`);
        if (res.ok) {
          const result = await res.json();
          if (result.success) setRespons(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch respons', error);
      }
    };
    fetchRespons();
  }, [surveiId, activeTab, refreshTrigger]);

  // Fetch tindak lanjut
  useEffect(() => {
    if (!surveiId || activeTab !== 'keluhan') return;
    const fetchTL = async () => {
      try {
        const res = await fetch(`/api/survei/${surveiId}/tindak-lanjut`);
        if (res.ok) {
          const result = await res.json();
          if (result.success) setTindakLanjut(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch tindak lanjut', error);
      }
    };
    fetchTL();
  }, [surveiId, activeTab, refreshTrigger]);

  // Handle tindak lanjut update
  const handleUpdateTL = async () => {
    if (!selectedTl) return;
    setSubmitState({ status: 'loading', message: 'Menyimpan tindak lanjut...' });
    setTlModalOpen(false);
    try {
      const res = await fetch(`/api/survei/${surveiId}/tindak-lanjut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respons_id: selectedTl.respons_id, status: tlStatus, catatan_tindakan: tlCatatan })
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Tindak lanjut berhasil diperbarui!' });
        setRefreshTrigger(prev => prev + 1);
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal memperbarui' });
      }
    } catch (error) {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) + ' WIB';
  };

  // Distribution bar
  const renderDistribution = (dist: any) => {
    if (!dist) return null;
    const total = (dist['1'] || 0) + (dist['2'] || 0) + (dist['3'] || 0) + (dist['4'] || 0) + (dist['5'] || 0);
    if (total === 0) return <span className="text-slate-400 text-xs">Belum ada respons</span>;
    
    const colors = ['bg-rose-400', 'bg-orange-400', 'bg-amber-400', 'bg-lime-400', 'bg-emerald-400'];
    
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {[5, 4, 3, 2, 1].map(star => {
          const count = dist[String(star)] || 0;
          const pct = (count / total) * 100;
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-slate-500 text-xs font-bold w-3 text-right">{star}</span>
              <span className="material-icons-round text-amber-400 text-[14px]">star</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${colors[star - 1]} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
              </div>
              <span className="text-slate-500 text-xs font-medium w-6 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Render tindak lanjut status badge
  const renderTlBadge = (status: string) => {
    let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
    if (status === 'Belum Ditangani') colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
    else if (status === 'Sedang Ditangani') colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    else if (status === 'Selesai') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${colorClass} whitespace-nowrap`}>{status}</span>;
  };

  if (!survei) return null;

  return (
    <div className="w-full flex flex-col gap-8 pb-10 relative">
      
      {/* Submit Overlay */}
      {(submitState.status !== 'idle') && <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />}

      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => router.push('/kegiatan/survei')} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 transition-colors">
              <span className="material-icons-round text-[18px]">arrow_back</span>
            </button>
            <h1 className="text-slate-900 text-3xl font-black font-sans leading-9">{survei.judul}</h1>
          </div>
          <div className="text-slate-500 text-base font-medium font-sans leading-6 flex items-center gap-3">
            {survei.nama_kegiatan && (
              <span className="flex items-center gap-1 text-blue-500">
                <span className="material-icons-round text-[16px]">event</span>
                {survei.nama_kegiatan}
              </span>
            )}
            <span>•</span>
            <span>{survei.nama_satelit}</span>
            <span>•</span>
            <span>{formatDate(survei.periode_mulai)} - {formatDate(survei.periode_selesai)}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-blue-600 text-2xl">groups</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[11px] font-bold font-sans uppercase tracking-wide">RESPONDEN</span>
            <span className="text-slate-900 text-2xl font-bold font-sans">{survei.total_responden || 0}</span>
          </div>
        </div>
        <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-amber-600 text-2xl">stars</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[11px] font-bold font-sans uppercase tracking-wide">SKOR KEPUASAN</span>
            <span className={`text-2xl font-bold font-sans ${(survei.avg_skor || 0) >= 4 ? 'text-emerald-600' : (survei.avg_skor || 0) >= 3 ? 'text-amber-600' : 'text-rose-600'}`}>{survei.avg_skor ? Number(survei.avg_skor).toFixed(1) : '-'}</span>
          </div>
        </div>
        <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-rose-600 text-2xl">flag</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[11px] font-bold font-sans uppercase tracking-wide">KELUHAN (FLAG)</span>
            <span className="text-rose-600 text-2xl font-bold font-sans">{survei.total_flagged || 0}</span>
          </div>
        </div>
        <div className="p-5 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-emerald-600 text-2xl">quiz</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[11px] font-bold font-sans uppercase tracking-wide">PERTANYAAN</span>
            <span className="text-slate-900 text-2xl font-bold font-sans">{pertanyaan.length}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {[
            { key: 'hasil', label: 'Hasil & Statistik', icon: 'bar_chart' },
            { key: 'respons', label: 'Daftar Respons', icon: 'list_alt' },
            { key: 'keluhan', label: 'Keluhan Survei', icon: 'flag', count: survei.total_flagged },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-4 flex justify-center items-center gap-2 text-sm font-bold transition-colors border-b-2 ${activeTab === tab.key ? 'text-blue-600 border-blue-600 bg-blue-50/50' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <span className="material-icons-round text-[18px]">{tab.icon}</span>
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-black rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          
          {/* TAB: Hasil & Statistik */}
          {activeTab === 'hasil' && (
            <div className="flex flex-col gap-6">
              {pertanyaan.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">quiz</span>
                  <span className="text-sm font-sans">Belum ada pertanyaan dalam survei ini.</span>
                </div>
              ) : (
                pertanyaan.map((q, i) => (
                  <div key={q.id} className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex justify-center items-center text-blue-600 font-bold text-sm shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <h4 className="text-slate-900 font-bold text-sm">{q.teks_pertanyaan}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${q.tipe_jawaban === 'skala' ? 'bg-indigo-100 text-indigo-600' : 'bg-teal-100 text-teal-600'}`}>
                            {q.tipe_jawaban === 'skala' ? 'Skala 1-5' : 'Teks Bebas'}
                          </span>
                          {q.is_required && <span className="text-rose-400 text-[10px] font-bold">Wajib</span>}
                          {q.count_respons != null && <span className="text-slate-400 text-[10px] font-medium">{q.count_respons} respons</span>}
                        </div>
                      </div>
                      {q.tipe_jawaban === 'skala' && q.avg_skor != null && (
                        <div className="flex flex-col items-center shrink-0">
                          <span className={`text-2xl font-bold font-sans ${Number(q.avg_skor) >= 4 ? 'text-emerald-600' : Number(q.avg_skor) >= 3 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {Number(q.avg_skor).toFixed(1)}
                          </span>
                          <span className="text-slate-400 text-[10px] font-medium">rata-rata</span>
                        </div>
                      )}
                    </div>
                    {q.tipe_jawaban === 'skala' && renderDistribution(q.distribusi)}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: Daftar Respons */}
          {activeTab === 'respons' && (
            <div className="flex flex-col gap-3">
              {respons.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">inbox</span>
                  <span className="text-sm font-sans">Belum ada respons yang masuk.</span>
                </div>
              ) : (
                respons.map(r => (
                  <div key={r.respons_id} className={`p-4 bg-white rounded-xl border ${r.is_flagged ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'} flex items-start gap-4`}>
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex justify-center items-center text-slate-600 font-bold text-sm uppercase shrink-0">
                      {r.nama_jemaat ? r.nama_jemaat.charAt(0) : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-900 font-bold text-sm">{r.nama_jemaat || 'Anonim'}</span>
                        <span className="text-slate-400 text-[11px] font-medium">{formatDateTime(r.created_at)}</span>
                        {r.is_flagged && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-600 flex items-center gap-1">
                            <span className="material-icons-round text-[10px]">flag</span>Flagged
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-col gap-1">
                        <span className="text-slate-600 text-xs font-medium">{r.teks_pertanyaan}</span>
                        {r.tipe_jawaban === 'skala' ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            {[1, 2, 3, 4, 5].map(star => (
                              <span key={star} className={`material-icons-round text-[18px] ${star <= (r.skor || 0) ? 'text-amber-400' : 'text-slate-200'}`}>star</span>
                            ))}
                            <span className="text-slate-600 text-sm font-bold ml-1">{r.skor}</span>
                          </div>
                        ) : (
                          <p className="text-slate-700 text-sm bg-slate-50 rounded-lg px-3 py-2 mt-1">{r.jawaban_teks || '-'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: Keluhan Survei */}
          {activeTab === 'keluhan' && (
            <div className="flex flex-col gap-3">
              {/* Header with Lihat Riwayat button */}
              {tindakLanjut.length > 0 && (
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{tindakLanjut.length} keluhan tercatat</span>
                  <button
                    onClick={() => setShowKeluhanTimeline(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                  >
                    <span className="material-icons-round text-[16px]">history</span>
                    Lihat Riwayat
                  </button>
                </div>
              )}
              {tindakLanjut.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">sentiment_satisfied</span>
                  <span className="text-sm font-sans">Tidak ada keluhan yang perlu ditindaklanjuti. 🎉</span>
                </div>
              ) : (
                tindakLanjut.map(tl => (
                  <div key={tl.tindak_lanjut_id} className="p-4 bg-white rounded-xl border border-slate-200 flex items-start gap-4 hover:shadow-sm transition-shadow">
                    <div className={`w-10 h-10 rounded-xl flex justify-center items-center shrink-0 ${tl.status === 'Selesai' ? 'bg-emerald-50 text-emerald-600' : tl.status === 'Sedang Ditangani' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                      <span className="material-icons-round text-xl">{tl.status === 'Selesai' ? 'check_circle' : tl.status === 'Sedang Ditangani' ? 'autorenew' : 'error_outline'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-slate-900 font-bold text-sm">{tl.nama_jemaat || 'Anonim'}</span>
                        {renderTlBadge(tl.status)}
                        <span className="text-slate-400 text-[11px] font-medium">{formatDateTime(tl.respons_created_at)}</span>
                      </div>
                      <p className="text-slate-600 text-xs font-medium mb-1">{tl.teks_pertanyaan}</p>
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} className={`material-icons-round text-[16px] ${star <= (tl.skor || 0) ? 'text-amber-400' : 'text-slate-200'}`}>star</span>
                        ))}
                        <span className="text-rose-600 text-xs font-bold ml-1">Skor: {tl.skor}</span>
                      </div>
                      {tl.jawaban_teks && <p className="text-slate-500 text-xs bg-slate-50 rounded-lg px-3 py-2 mb-2 italic">&ldquo;{tl.jawaban_teks}&rdquo;</p>}
                      {tl.catatan_tindakan && (
                        <div className="flex items-start gap-2 mt-2 p-2 bg-blue-50/50 rounded-lg">
                          <span className="material-icons-round text-[14px] text-blue-400 mt-0.5">notes</span>
                          <p className="text-blue-700 text-xs">{tl.catatan_tindakan}</p>
                        </div>
                      )}
                    </div>
                    {hasPermission('survei_manage') && tl.status !== 'Selesai' && (
                      <button
                        onClick={() => {
                          setSelectedTl(tl);
                          setTlStatus(tl.status === 'Belum Ditangani' ? 'Sedang Ditangani' : 'Selesai');
                          setTlCatatan(tl.catatan_tindakan || '');
                          setTlModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors shrink-0"
                      >
                        Tindak Lanjut
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tindak Lanjut Modal */}
      {tlModalOpen && selectedTl && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setTlModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex justify-center items-center text-blue-600">
                  <span className="material-icons-round">rate_review</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Tindak Lanjut Keluhan</h3>
                  <p className="text-xs text-slate-500 font-medium">Skor {selectedTl.skor}/5 — {selectedTl.nama_jemaat || 'Anonim'}</p>
                </div>
              </div>
              <button onClick={() => setTlModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                <select
                  value={tlStatus}
                  onChange={(e) => setTlStatus(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                >
                  <option value="Belum Ditangani">Belum Ditangani</option>
                  <option value="Sedang Ditangani">Sedang Ditangani</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catatan Tindakan</label>
                <textarea
                  value={tlCatatan}
                  onChange={(e) => setTlCatatan(e.target.value)}
                  rows={4}
                  placeholder="Jelaskan tindakan yang telah dilakukan..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 text-sm resize-none"
                />
              </div>
              <button
                onClick={handleUpdateTL}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
              >
                Simpan Tindak Lanjut
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keluhan Timeline Slide-in Panel */}
      <KeluhanTimeline
        surveiId={surveiId}
        isOpen={showKeluhanTimeline}
        onClose={() => setShowKeluhanTimeline(false)}
        tindakLanjutData={tindakLanjut}
        onUpdated={() => setRefreshTrigger(prev => prev + 1)}
      />

    </div>
  );
}
