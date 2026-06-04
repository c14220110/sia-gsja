'use client';

import { useState, useEffect, useCallback } from 'react';

interface TimelineEntry {
  id:              number;
  anggaran_id:     string;
  kode_dokumen:    string;
  aksi:            string;
  status_sebelum:  string | null;
  status_sesudah:  string;
  user_id:         number;
  nama_pelaksana:  string;
  role_id:         number;
  nama_role:       string;
  satelit_id:      number;
  nama_satelit:    string;
  keterangan:      string | null;
  created_at:      string;
}

const AKSI_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; ringColor: string }> = {
  'Dibuat':                    { icon: 'add_circle',             color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', ringColor: 'ring-emerald-100' },
  'Diajukan':                  { icon: 'send',                   color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   ringColor: 'ring-amber-100'   },
  'Disetujui Penuh':           { icon: 'check_circle',           color: 'text-green-600',   bg: 'bg-green-50',    border: 'border-green-200',   ringColor: 'ring-green-100'   },
  'Disetujui Sebagian':        { icon: 'rule',                   color: 'text-teal-600',    bg: 'bg-teal-50',     border: 'border-teal-200',    ringColor: 'ring-teal-100'    },
  'Ditolak':                   { icon: 'cancel',                 color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-200',     ringColor: 'ring-red-100'     },
  'Revisi':                    { icon: 'replay',                 color: 'text-orange-600',  bg: 'bg-orange-50',   border: 'border-orange-200',  ringColor: 'ring-orange-100'  },
  'Direvisi & Diajukan Ulang': { icon: 'published_with_changes', color: 'text-purple-600',  bg: 'bg-purple-50',   border: 'border-purple-200',  ringColor: 'ring-purple-100'  },
  'Dihapus':                   { icon: 'delete',                 color: 'text-red-700',     bg: 'bg-red-100',     border: 'border-red-300',     ringColor: 'ring-red-100'     },
};

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHr < 24) return `${diffHr} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return '';
}

function calcResponseTime(timeline: TimelineEntry[]): string | null {
  // Find first 'Diajukan' and first review action after it
  const diajukanIdx = timeline.findIndex(e => e.aksi === 'Diajukan');
  if (diajukanIdx === -1) return null;

  const reviewActions = ['Disetujui Penuh', 'Disetujui Sebagian', 'Ditolak', 'Revisi'];
  const reviewEntry = timeline.slice(diajukanIdx + 1).find(e => reviewActions.includes(e.aksi));
  if (!reviewEntry) return null;

  const start = new Date(timeline[diajukanIdx].created_at).getTime();
  const end = new Date(reviewEntry.created_at).getTime();
  const diffMs = end - start;

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} hari ${hours % 24} jam`;
  if (hours > 0) return `${hours} jam ${mins % 60} menit`;
  return `${mins} menit`;
}

interface AnggaranTimelineProps {
  anggaranId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AnggaranTimeline({ anggaranId, isOpen, onClose }: AnggaranTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTimeline = useCallback(async () => {
    if (!anggaranId || !isOpen) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/anggaran/tahunan/${anggaranId}/timeline`);
      const json = await res.json();
      if (json.success) {
        setTimeline(json.data);
      } else {
        setError(json.message || 'Gagal memuat riwayat');
      }
    } catch (err) {
      setError('Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  }, [anggaranId, isOpen]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const responseTime = calcResponseTime(timeline);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Panel Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
              <span className="material-icons-round text-white text-[22px]">history</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 font-sans">Riwayat Dokumen</h2>
              <p className="text-xs text-slate-500 font-sans">
                {timeline.length > 0 ? `${timeline.length} aktivitas tercatat` : 'Memuat...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>

        {/* Response Time Card */}
        {responseTime && !loading && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="material-icons-round text-indigo-600 text-[20px]">speed</span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Waktu Respons Review</div>
              <div className="text-sm font-bold text-indigo-700 font-sans">{responseTime}</div>
            </div>
          </div>
        )}

        {/* Timeline Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-sans">Memuat riwayat...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="material-icons-round text-4xl text-red-300">error_outline</span>
              <p className="text-sm text-red-500 font-sans">{error}</p>
              <button onClick={fetchTimeline} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors">
                Coba Lagi
              </button>
            </div>
          ) : timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="material-icons-round text-5xl text-slate-200">timeline</span>
              <p className="text-sm text-slate-400 font-sans">Belum ada riwayat aktivitas</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[19px] top-3 bottom-3 w-px bg-slate-200" />

              <div className="flex flex-col gap-0">
                {timeline.map((entry, idx) => {
                  const cfg = AKSI_CONFIG[entry.aksi] || {
                    icon: 'info', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', ringColor: 'ring-slate-100'
                  };
                  const isLast = idx === timeline.length - 1;
                  const relative = formatRelative(entry.created_at);

                  return (
                    <div key={entry.id} className="flex gap-4 relative group">
                      {/* Timeline Node */}
                      <div className="flex flex-col items-center shrink-0 z-10">
                        <div className={`w-10 h-10 rounded-full ${cfg.bg} border-2 ${cfg.border} flex items-center justify-center ring-4 ${cfg.ringColor} bg-white`}>
                          <span className={`material-icons-round text-[18px] ${cfg.color}`}>{cfg.icon}</span>
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-slate-200 min-h-[16px]" />}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
                        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-slate-200 transition-all group-hover:translate-x-0.5">
                          {/* Aksi + Timestamp Row */}
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-sans ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                              <span className="material-icons-round text-[12px]">{cfg.icon}</span>
                              {entry.aksi}
                            </span>
                            <div className="text-right shrink-0">
                              <div className="text-[11px] text-slate-400 font-sans font-medium">{formatTimestamp(entry.created_at)}</div>
                              {relative && <div className="text-[10px] text-slate-300 font-sans">{relative}</div>}
                            </div>
                          </div>

                          {/* Status Transition */}
                          {entry.status_sebelum && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-slate-400 font-sans bg-slate-50 px-2 py-0.5 rounded">{entry.status_sebelum}</span>
                              <span className="material-icons-round text-[14px] text-slate-300">east</span>
                              <span className="text-xs text-slate-700 font-semibold font-sans bg-slate-100 px-2 py-0.5 rounded">{entry.status_sesudah}</span>
                            </div>
                          )}

                          {/* Actor Info */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-icons-round text-[14px] text-slate-300">person</span>
                            <span className="text-xs text-slate-600 font-semibold font-sans">{entry.nama_pelaksana}</span>
                            <span className="text-[10px] text-slate-400 font-sans">• {entry.nama_role.replace(/_/g, ' ')}</span>
                          </div>

                          {/* Keterangan */}
                          {entry.keterangan && (() => {
                            const isReviewAction = ['Disetujui Penuh', 'Disetujui Sebagian', 'Ditolak', 'Revisi'].includes(entry.aksi);
                            return isReviewAction ? (
                              <div className="mt-2 px-3 py-2 bg-amber-50 rounded-lg border-l-4 border-amber-400">
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="material-icons-round text-[12px] text-amber-500">person_pin</span>
                                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Catatan Reviewer</span>
                                </div>
                                <p className="text-xs text-amber-900 font-sans leading-relaxed">
                                  &ldquo;{entry.keterangan}&rdquo;
                                </p>
                              </div>
                            ) : (
                              <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-xs text-slate-500 font-sans leading-relaxed italic">
                                  <span className="material-icons-round text-[12px] text-slate-300 align-middle mr-1">notes</span>
                                  {entry.keterangan}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Panel Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold font-sans hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-icons-round text-[18px]">close</span>
            Tutup Riwayat
          </button>
        </div>
      </div>

      {/* Slide-in animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
}
