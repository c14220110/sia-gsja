'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CaretLeft, CaretRight, MapPin, Paperclip, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import type { PresensiRecord, KunjunganRecord } from '@/server/repositories/presensi.repository';
import { formatWorkedMinutes } from '@/lib/presensiTime';

export interface CalendarHistoryTabProps {
  pegawaiIdOverride?: number | null;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function toWibTime(iso?: string | null): string {
  if (!iso) return '--:--';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function getTodayWib(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const CalendarHistoryTab: React.FC<CalendarHistoryTabProps> = ({ pegawaiIdOverride }) => {
  const todayStr = useMemo(() => getTodayWib(), []);
  const [currentMonth, setCurrentMonth] = useState<string>(todayStr.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [presensiList, setPresensiList] = useState<PresensiRecord[]>([]);
  const [kunjunganList, setKunjunganList] = useState<KunjunganRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ month: currentMonth });
    if (pegawaiIdOverride) params.set('pegawai_id', String(pegawaiIdOverride));

    fetch(`/api/pegawai/presensi/calendar?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        if (json.success && json.data) {
          setPresensiList(json.data.presensi || []);
          setKunjunganList(json.data.kunjungan || []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentMonth, pegawaiIdOverride]);

  const [year, monthNum] = currentMonth.split('-').map(Number);

  const presensiByDate = useMemo(() => {
    const map = new Map<string, PresensiRecord>();
    for (const p of presensiList) {
      const key = String(p.tanggal).slice(0, 10);
      map.set(key, p);
    }
    return map;
  }, [presensiList]);

  const kunjunganByDate = useMemo(() => {
    const map = new Map<string, KunjunganRecord[]>();
    for (const k of kunjunganList) {
      const key = String(k.tanggal).slice(0, 10);
      const list = map.get(key) || [];
      list.push(k);
      map.set(key, list);
    }
    return map;
  }, [kunjunganList]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, monthNum - 1, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    const cells: { day: number | null; dateStr: string | null }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, dateStr: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      const mm = String(monthNum).padStart(2, '0');
      cells.push({ day: d, dateStr: `${year}-${mm}-${dd}` });
    }
    return cells;
  }, [year, monthNum]);

  const shiftMonth = (delta: number) => {
    const dt = new Date(year, monthNum - 1 + delta, 1);
    const nextMonth = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(nextMonth);
  };

  const selectedPresensi = presensiByDate.get(selectedDate) || null;
  const selectedVisits = kunjunganByDate.get(selectedDate) || [];

  const formattedSelectedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${selectedDate}T00:00:00+07:00`));

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Month Calendar Card */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-extrabold text-slate-900">
            {MONTH_NAMES[monthNum - 1]} {year}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
            >
              <CaretLeft className="w-4 h-4" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
            >
              <CaretRight className="w-4 h-4" weight="bold" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-[11px] font-bold text-slate-400 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (!cell.day || !cell.dateStr) {
              return <div key={`empty-${idx}`} className="h-10" />;
            }
            const pr = presensiByDate.get(cell.dateStr);
            const visits = kunjunganByDate.get(cell.dateStr) || [];
            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === todayStr;

            let dotColor = '';
            if (pr?.check_in_at) {
              dotColor = pr.check_in_status === 'TERLAMBAT' ? 'bg-amber-500' : 'bg-emerald-500';
            }

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => setSelectedDate(cell.dateStr!)}
                className={`h-10 rounded-xl flex flex-col items-center justify-center relative text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[#3B1F3D] text-white shadow-sm'
                    : isToday
                    ? 'bg-purple-50 text-[#3B1F3D] border border-purple-200'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{cell.day}</span>
                <div className="flex items-center gap-0.5 mt-0.5 h-1.5">
                  {dotColor && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor}`}
                    />
                  )}
                  {visits.length > 0 && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-emerald-300' : 'bg-indigo-500'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-center gap-4 text-[10px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Tepat Waktu
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Terlambat
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Ada Visit
          </span>
        </div>
      </div>

      {/* Detail Presensi Tanggal Terpilih */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Detail Presensi
            </p>
            <h4 className="text-sm font-extrabold text-slate-900">{formattedSelectedDate}</h4>
          </div>
          {selectedPresensi?.check_in_at ? (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                selectedPresensi.check_in_status === 'TERLAMBAT'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {selectedPresensi.check_in_status === 'TERLAMBAT' ? (
                <WarningCircle className="w-3.5 h-3.5" weight="fill" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" weight="fill" />
              )}
              <span>
                {selectedPresensi.check_in_status === 'TERLAMBAT' ? 'Terlambat' : 'Tepat Waktu'}
              </span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
              Tidak Ada Absen
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 py-4 text-center">Memuat data kalender...</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                <span className="text-[10px] font-bold text-slate-400 block">Jam Masuk</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {toWibTime(selectedPresensi?.check_in_at)} WIB
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                <span className="text-[10px] font-bold text-slate-400 block">Jam Pulang</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {toWibTime(selectedPresensi?.check_out_at)} WIB
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                <span className="text-[10px] font-bold text-slate-400 block">Durasi</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {selectedPresensi?.worked_minutes
                    ? formatWorkedMinutes(selectedPresensi.worked_minutes)
                    : selectedPresensi?.check_in_at
                    ? 'Berjalan'
                    : '-'}
                </span>
              </div>
            </div>

            {/* Overview Catatan & Attachment */}
            {(selectedPresensi?.overview_note || selectedPresensi?.overview_attachment_url) && (
              <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
                  Catatan Overview Harian
                </p>
                {selectedPresensi.overview_note && (
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedPresensi.overview_note}
                  </p>
                )}
                {selectedPresensi.overview_attachment_url && (
                  <a
                    href={selectedPresensi.overview_attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{selectedPresensi.overview_attachment_name || 'Lihat Lampiran Overview'}</span>
                  </a>
                )}
              </div>
            )}

            {/* Daftar Kunjungan Tanggal Ini */}
            <div>
              <p className="text-xs font-extrabold text-slate-800 mb-2">
                Jurnal Visit ({selectedVisits.length})
              </p>
              {selectedVisits.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3 text-center">
                  Belum ada catatan kunjungan pada tanggal ini.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {selectedVisits.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-xl border border-slate-200 p-2.5 flex gap-3 items-start"
                    >
                      <img
                        src={v.selfie_url}
                        alt="Selfie Visit"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {v.satelit_tujuan_nama || v.lokasi_bebas}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">
                            {toWibTime(v.waktu_kunjungan)} WIB
                          </span>
                        </div>
                        <span className="inline-block text-[10px] font-semibold text-indigo-600 mb-0.5">
                          {v.kategori}
                        </span>
                        <p className="text-xs text-slate-600 leading-snug">{v.notes}</p>
                        <a
                          href={`https://maps.google.com/?q=${v.lat},${v.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:underline"
                        >
                          <MapPin className="w-3 h-3" weight="fill" />
                          <span>Lihat Titik GPS</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
