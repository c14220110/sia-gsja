'use client';

import { useState, useEffect, useCallback } from 'react';

interface KeluhanTimelineProps {
  surveiId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Pass current tindak lanjut data to build the inline timeline */
  tindakLanjutData: any[];
  /** Callback after PATCH success */
  onUpdated?: () => void;
}

const STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; ringColor: string }> = {
  'Keluhan Masuk':       { icon: 'report',       color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    ringColor: 'ring-rose-100' },
  'Belum Ditangani':     { icon: 'error_outline', color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    ringColor: 'ring-rose-100' },
  'Sedang Ditangani':    { icon: 'autorenew',     color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   ringColor: 'ring-amber-100' },
  'Selesai':             { icon: 'check_circle',  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ringColor: 'ring-emerald-100' },
};

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' WIB';
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

function calcResponseTime(createdAt: string, updatedAt: string): string | null {
  if (!createdAt || !updatedAt) return null;
  const start = new Date(createdAt).getTime();
  const end = new Date(updatedAt).getTime();
  const diffMs = end - start;
  if (diffMs <= 0) return null;

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} hari ${hours % 24} jam`;
  if (hours > 0) return `${hours} jam ${mins % 60} menit`;
  return `${mins} menit`;
}

export default function KeluhanTimeline({ surveiId, isOpen, onClose, tindakLanjutData, onUpdated }: KeluhanTimelineProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || tindakLanjutData.length === 0) return null;

  // Group by respons_id to handle multiple flagged questions per respondent
  const grouped = new Map<number, any[]>();
  for (const tl of tindakLanjutData) {
    const key = tl.respons_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(tl);
  }

  // Build timeline entries from each tindak lanjut
  const buildTimeline = (tl: any) => {
    const entries: { aksi: string; timestamp: string; detail?: string; actor?: string; statusFrom?: string; statusTo?: string }[] = [];

    // Entry 1: Keluhan masuk (from created_at of the tindak_lanjut)
    entries.push({
      aksi: 'Keluhan Masuk',
      timestamp: tl.respons_created_at || tl.tindak_lanjut_created_at,
      detail: `Skor ${tl.skor}/5 pada "${tl.teks_pertanyaan}"${tl.jawaban_teks ? ` — "${tl.jawaban_teks}"` : ''}`,
      actor: tl.nama_jemaat || 'Anonim',
    });

    // Entry 2+: Current status (if changed from "Belum Ditangani")
    if (tl.status === 'Sedang Ditangani') {
      entries.push({
        aksi: 'Sedang Ditangani',
        timestamp: tl.updated_at || tl.tindak_lanjut_created_at,
        statusFrom: 'Belum Ditangani',
        statusTo: 'Sedang Ditangani',
        actor: tl.ditangani_oleh_nama || undefined,
        detail: tl.catatan_tindakan || undefined,
      });
    } else if (tl.status === 'Selesai') {
      // We can infer there was a "Sedang Ditangani" step
      entries.push({
        aksi: 'Sedang Ditangani',
        timestamp: tl.tindak_lanjut_created_at, // approximation
        statusFrom: 'Belum Ditangani',
        statusTo: 'Sedang Ditangani',
        actor: tl.ditangani_oleh_nama || undefined,
      });
      entries.push({
        aksi: 'Selesai',
        timestamp: tl.updated_at || tl.tindak_lanjut_created_at,
        statusFrom: 'Sedang Ditangani',
        statusTo: 'Selesai',
        actor: tl.ditangani_oleh_nama || undefined,
        detail: tl.catatan_tindakan || undefined,
      });
    }

    return entries;
  };

  // Summary stats
  const totalKeluhan = tindakLanjutData.length;
  const selesaiCount = tindakLanjutData.filter(t => t.status === 'Selesai').length;
  const sedangCount = tindakLanjutData.filter(t => t.status === 'Sedang Ditangani').length;
  const belumCount = tindakLanjutData.filter(t => t.status === 'Belum Ditangani').length;

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
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center">
              <span className="material-icons-round text-white text-[22px]">flag</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 font-sans">Riwayat Keluhan</h2>
              <p className="text-xs text-slate-500 font-sans">
                {totalKeluhan} keluhan tercatat
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

        {/* Summary Card */}
        <div className="mx-6 mt-4 grid grid-cols-3 gap-3">
          <div className="px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-100 text-center">
            <div className="text-lg font-black text-rose-600">{belumCount}</div>
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Belum</div>
          </div>
          <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-center">
            <div className="text-lg font-black text-amber-600">{sedangCount}</div>
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Proses</div>
          </div>
          <div className="px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
            <div className="text-lg font-black text-emerald-600">{selesaiCount}</div>
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Selesai</div>
          </div>
        </div>

        {/* Timeline Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-6">
            {tindakLanjutData.map((tl, tlIdx) => {
              const timeline = buildTimeline(tl);
              const responseTime = tl.status !== 'Belum Ditangani'
                ? calcResponseTime(tl.tindak_lanjut_created_at, tl.updated_at)
                : null;

              return (
                <div key={tl.tindak_lanjut_id} className="relative">
                  {/* Keluhan Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[11px] font-bold shrink-0">{tlIdx + 1}</span>
                    <span className="text-sm font-bold text-slate-800 truncate">{tl.teks_pertanyaan}</span>
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className={`material-icons-round text-[14px] ${star <= (tl.skor || 0) ? 'text-amber-400' : 'text-slate-200'}`}>star</span>
                      ))}
                    </div>
                  </div>

                  {/* Response time */}
                  {responseTime && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 flex items-center gap-2">
                      <span className="material-icons-round text-indigo-500 text-[16px]">speed</span>
                      <div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Waktu Respons: </span>
                        <span className="text-xs font-bold text-indigo-700">{responseTime}</span>
                      </div>
                    </div>
                  )}

                  {/* Mini Timeline */}
                  <div className="relative ml-1">
                    {/* Vertical line */}
                    <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" />

                    <div className="flex flex-col gap-0">
                      {timeline.map((entry, idx) => {
                        const cfg = STATUS_CONFIG[entry.aksi] || STATUS_CONFIG['Belum Ditangani'];
                        const isLast = idx === timeline.length - 1;
                        const relative = formatRelative(entry.timestamp);

                        return (
                          <div key={idx} className="flex gap-3 relative group">
                            {/* Timeline Node */}
                            <div className="flex flex-col items-center shrink-0 z-10">
                              <div className={`w-8 h-8 rounded-full ${cfg.bg} border-2 ${cfg.border} flex items-center justify-center ring-4 ${cfg.ringColor} bg-white`}>
                                <span className={`material-icons-round text-[14px] ${cfg.color}`}>{cfg.icon}</span>
                              </div>
                              {!isLast && <div className="w-px flex-1 bg-slate-200 min-h-[12px]" />}
                            </div>

                            {/* Content */}
                            <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
                              <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm hover:shadow-md hover:border-slate-200 transition-all">
                                {/* Aksi + Timestamp Row */}
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                                    <span className="material-icons-round text-[10px]">{cfg.icon}</span>
                                    {entry.aksi}
                                  </span>
                                  <div className="text-right shrink-0">
                                    <div className="text-[10px] text-slate-400 font-medium">{formatTimestamp(entry.timestamp)}</div>
                                    {relative && <div className="text-[9px] text-slate-300">{relative}</div>}
                                  </div>
                                </div>

                                {/* Status Transition */}
                                {entry.statusFrom && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{entry.statusFrom}</span>
                                    <span className="material-icons-round text-[12px] text-slate-300">east</span>
                                    <span className="text-[10px] text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">{entry.statusTo}</span>
                                  </div>
                                )}

                                {/* Actor Info */}
                                {entry.actor && (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="material-icons-round text-[12px] text-slate-300">person</span>
                                    <span className="text-[10px] text-slate-600 font-semibold">{entry.actor}</span>
                                  </div>
                                )}

                                {/* Detail / Catatan */}
                                {entry.detail && (
                                  <div className="mt-1.5 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-[11px] text-slate-500 leading-relaxed italic">
                                      <span className="material-icons-round text-[10px] text-slate-300 align-middle mr-1">notes</span>
                                      {entry.detail}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider between keluhan items */}
                  {tlIdx < tindakLanjutData.length - 1 && (
                    <div className="border-t border-dashed border-slate-200 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
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
