'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  SignIn,
  SignOut,
  Clock,
  Camera,
  CheckCircle,
  WarningCircle,
  LockKey,
  MapPin,
  SpinnerGap,
  PlusCircle,
} from '@phosphor-icons/react';

export interface AttendanceHeroCardProps {
  isWithinOffice: boolean;
  isLoadingLocation: boolean;
  branchName?: string | null;
  distanceMeters?: number | null;
  onOpenBranches?: () => void;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workDuration?: string | null;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  isFaceEnrolled: boolean;
  onOpenCamera: (mode: 'ENROLL' | 'CHECK_IN' | 'CHECK_OUT') => void;
  onOpenVisit: () => void;
  brandColor?: string;
}

const WIB_CLOCK_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const WIB_CLOCK_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export const AttendanceHeroCard: React.FC<AttendanceHeroCardProps> = ({
  isWithinOffice,
  isLoadingLocation,
  branchName = 'Kantor Gereja',
  distanceMeters = null,
  onOpenBranches,
  checkInTime,
  checkOutTime,
  workDuration,
  hasCheckedIn,
  hasCheckedOut,
  isFaceEnrolled,
  onOpenCamera,
  onOpenVisit,
  brandColor = '#3B1F3D',
}) => {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const formattedTime = now ? WIB_CLOCK_TIME_FORMATTER.format(now) : '--:--:--';
  const formattedDate = now ? WIB_CLOCK_DATE_FORMATTER.format(now) : 'Memuat tanggal...';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden"
    >
      {/* Top Bar: Schedule & Geofence Status */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-600 truncate">
          Jadwal Kerja · 08:00 - 14:00 WIB
        </span>

        <button
          type="button"
          onClick={onOpenBranches}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors shrink-0 ${
            isLoadingLocation
              ? 'bg-slate-200 text-slate-600'
              : isWithinOffice
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {isLoadingLocation ? (
            <>
              <SpinnerGap className="w-3 h-3 animate-spin" />
              <span>Melacak GPS...</span>
            </>
          ) : isWithinOffice ? (
            <>
              <MapPin className="w-3 h-3" weight="fill" />
              <span>Dalam Radius ({distanceMeters ?? 0}m)</span>
            </>
          ) : (
            <>
              <WarningCircle className="w-3 h-3" weight="fill" />
              <span>
                Luar Radius{distanceMeters != null && Number.isFinite(distanceMeters) ? ` (${distanceMeters}m)` : ''}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Live Digital Clock */}
      <div className="px-5 pt-5 pb-4 text-center">
        <p className="text-xs font-medium text-slate-500 mb-1">{formattedDate}</p>
        <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono">
          {formattedTime} <span className="text-sm font-bold text-slate-400">WIB</span>
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <span
            className={`w-2 h-2 rounded-full ${
              isLoadingLocation ? 'bg-slate-400 animate-pulse' : isWithinOffice ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span>
            {branchName ? `Terdekat: ${branchName}` : 'Lokasi Satelit Belum Dikonfigurasi'}
          </span>
        </div>
      </div>

      {/* Clock In / Clock Out Boxes */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <SignIn className="w-3.5 h-3.5 text-emerald-600" />
            <span>Clock In</span>
          </div>
          <div className="mt-1 text-lg font-extrabold text-slate-900">
            {checkInTime || '--:--'}
          </div>
          <div className="text-[10px] font-medium text-slate-400">
            {hasCheckedIn ? 'Tercatat' : 'Belum masuk'}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <SignOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Clock Out</span>
          </div>
          <div className="mt-1 text-lg font-extrabold text-slate-900">
            {checkOutTime || '--:--'}
          </div>
          <div className="text-[10px] font-medium text-slate-400">
            {hasCheckedOut ? workDuration || 'Selesai' : 'Belum pulang'}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-5 flex flex-col gap-2.5">
        {!isFaceEnrolled ? (
          <button
            type="button"
            onClick={() => onOpenCamera('ENROLL')}
            style={{ backgroundColor: brandColor }}
            className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all"
          >
            <Camera className="w-5 h-5" weight="bold" />
            <span>Daftarkan Wajah Saya (1x)</span>
          </button>
        ) : !hasCheckedIn ? (
          <>
            <button
              type="button"
              disabled={!isWithinOffice || isLoadingLocation}
              onClick={() => onOpenCamera('CHECK_IN')}
              style={{
                backgroundColor: !isWithinOffice || isLoadingLocation ? undefined : brandColor,
              }}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                !isWithinOffice || isLoadingLocation
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'text-white shadow-md hover:opacity-95 active:scale-[0.99]'
              }`}
            >
              {!isWithinOffice ? (
                <>
                  <LockKey className="w-5 h-5" weight="bold" />
                  <span>Check-In Terkunci (Di Luar Radius Kantor)</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" weight="bold" />
                  <span>Clock In Sekarang (Wajah)</span>
                </>
              )}
            </button>
          </>
        ) : !hasCheckedOut ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenVisit}
              style={{ backgroundColor: brandColor }}
              className="py-3 px-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-md hover:opacity-95 active:scale-[0.99] transition-all"
            >
              <PlusCircle className="w-4 h-4" weight="bold" />
              <span>Tambah Visit</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCamera('CHECK_OUT')}
              className="py-3 px-3 rounded-xl bg-white border-2 border-slate-200 text-slate-800 font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-slate-50 active:scale-[0.99] transition-all"
            >
              <SignOut className="w-4 h-4 text-rose-600" weight="bold" />
              <span>Clock Out</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-center gap-2 text-emerald-700 text-xs font-bold">
              <CheckCircle className="w-4 h-4" weight="fill" />
              <span>Presensi Hari Ini Selesai ({workDuration || '0j 0m'})</span>
            </div>
            {/* Tetap bisa Tambah Visit meskipun sudah Check-Out (kunjungan luar jam kerja) */}
            <button
              type="button"
              onClick={onOpenVisit}
              style={{ backgroundColor: brandColor }}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all"
            >
              <PlusCircle className="w-5 h-5" weight="bold" />
              <span>Tambah Visit (Luar Jam Kerja)</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
