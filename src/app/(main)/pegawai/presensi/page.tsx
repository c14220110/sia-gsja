'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import {
  MapPin,
  CalendarDots,
  ClipboardText,
  PlusCircle,
  Buildings,
  Paperclip,
  UserCircle,
  CheckCircle,
  ShieldCheck,
  ArrowsLeftRight,
  SignOut,
  X,
} from '@phosphor-icons/react';
import { AttendanceHeroCard } from '@/components/presensi/AttendanceHeroCard';
import { BottomNavBar, type PresensiTabType } from '@/components/presensi/BottomNavBar';
import { CameraDrawer } from '@/components/presensi/CameraDrawer';
import { VisitDrawer } from '@/components/presensi/VisitDrawer';
import { CalendarHistoryTab } from '@/components/presensi/CalendarHistoryTab';
import { findNearestSatelit, calculateDistanceMeters, type SatelitGeofence } from '@/lib/geofence';
import { formatWorkedMinutes } from '@/lib/presensiTime';
import type { PresensiRecord, KunjunganRecord } from '@/server/repositories/presensi.repository';

function toWibTime(iso?: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export default function PresensiPegawaiPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PresensiTabType>('home');
  const [loading, setLoading] = useState(true);
  const [pegawai, setPegawai] = useState<any>(null);
  const [isFaceEnrolled, setIsFaceEnrolled] = useState(false);
  const [presensi, setPresensi] = useState<PresensiRecord | null>(null);
  const [visits, setVisits] = useState<KunjunganRecord[]>([]);
  const [satelits, setSatelits] = useState<SatelitGeofence[]>([]);

  // GPS State
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Drawers
  const [cameraMode, setCameraMode] = useState<'ENROLL' | 'CHECK_IN' | 'CHECK_OUT' | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [overlayState, setOverlayState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  const handleSwitchRole = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const me = await res.json();
        const payload = {
          user_id: me.user_id,
          available_roles: me.available_roles || [],
        };
        try {
          sessionStorage.setItem('temp_auth_data', JSON.stringify(payload));
        } catch {
          (window as any).__TEMP_AUTH_DATA = JSON.stringify(payload);
        }
        router.push('/select-role');
        return;
      }
    } catch {
      // ignore
    }
    router.push('/select-role');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/me', { method: 'POST' });
    } catch {
      // ignore
    }
    router.push('/login');
  };

  // Overview Form
  const [overviewNote, setOverviewNote] = useState('');
  const [overviewFile, setOverviewFile] = useState<File | null>(null);
  const [savingOverview, setSavingOverview] = useState(false);

  const loadTodayData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pegawai/presensi/today');
      const json = await res.json();
      if (json.success && json.data) {
        setPegawai(json.data.pegawai);
        setIsFaceEnrolled(Boolean(json.data.isFaceEnrolled));
        setPresensi(json.data.presensi);
        setVisits(json.data.visits || []);
        setSatelits(json.data.satelits || []);
        setOverviewNote(json.data.presensi?.overview_note || '');
      }
    } catch (e) {
      console.error('[PresensiPage] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodayData();
  }, [loadTodayData]);

  const refreshGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Browser tidak mendukung GPS.');
      setGpsLoading(false);
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(err.message || 'Gagal membaca lokasi GPS.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    refreshGps();
  }, [refreshGps]);

  const geofence = useMemo(() => {
    if (!coords) {
      return { satelit: satelits[0] || null, distanceMeters: null, isWithinRadius: false };
    }
    return findNearestSatelit(coords.lat, coords.lng, satelits);
  }, [coords, satelits]);

  const hasCheckedIn = Boolean(presensi?.check_in_at);
  const hasCheckedOut = Boolean(presensi?.check_out_at);

  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overviewNote.trim() && !overviewFile) {
      setOverlayState({
        status: 'error',
        message: 'Isi catatan overview atau lampiran terlebih dahulu.',
      });
      return;
    }
    setSavingOverview(true);
    setOverlayState({ status: 'loading', message: 'Menyimpan overview harian...' });
    try {
      const fd = new FormData();
      fd.append('overview_note', overviewNote.trim());
      if (overviewFile) fd.append('attachment', overviewFile);

      const res = await fetch('/api/pegawai/presensi/overview', {
        method: 'PUT',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menyimpan overview.');
      }
      setOverlayState({
        status: 'success',
        message: json.message || 'Overview harian tersimpan.',
      });
      setOverviewFile(null);
      await loadTodayData();
    } catch (err: any) {
      setOverlayState({
        status: 'error',
        message: err?.message || 'Gagal menyimpan overview.',
      });
    } finally {
      setSavingOverview(false);
    }
  };

  const handleCenterAction = () => {
    if (!pegawai) return;
    if (!isFaceEnrolled) {
      setCameraMode('ENROLL');
      return;
    }
    if (!hasCheckedIn) {
      if (!geofence.isWithinRadius) {
        setOverlayState({
          status: 'error',
          message: 'Check-In harus berada di dalam radius area gereja/satelit GSJA.',
        });
        return;
      }
      setCameraMode('CHECK_IN');
      return;
    }
    // Setelah Check-In (baik sebelum maupun sesudah Check-Out), tombol tengah membuka Tambah Visit
    setVisitOpen(true);
  };

  if (loading && !pegawai) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-semibold text-slate-500 animate-pulse">
          Memuat modul presensi GSJA...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SubmitOverlay
        status={overlayState.status}
        message={overlayState.message}
        onClose={() => setOverlayState({ status: 'idle', message: '' })}
      />

      <div className="w-full max-w-md min-h-screen bg-slate-50 relative shadow-xl flex flex-col">
        {/* Top Curved Header */}
        <div className="bg-gradient-to-br from-[#3B1F3D] via-[#4A254D] to-[#2B152D] text-white px-5 pt-5 pb-16 rounded-b-[28px] shadow-md">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-purple-200/90">
                Selamat melayani,
              </p>
              <h1 className="text-lg font-extrabold truncate">
                {pegawai ? pegawai.nama_lengkap : 'Presensi Pegawai GSJA'}
              </h1>
              <p className="text-[11px] text-purple-200/80 truncate">
                {pegawai
                  ? `${pegawai.id_pegawai} · ${pegawai.nama_jabatan || 'Staf Pastoral'}`
                  : 'Akun belum terhubung ke data pegawai'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setBranchesOpen(true)}
              className="px-2.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xs text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  geofence.isWithinRadius ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="max-w-[110px] truncate">
                {geofence.satelit?.nama_satelit || 'Lokasi GSJA'}
              </span>
            </button>
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="px-4 -mt-11 flex-1 pb-24">
          {!pegawai ? (
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 text-center">
              <UserCircle className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-extrabold text-slate-800">
                Akun Belum Terhubung ke Data Pegawai
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Akun Anda belum tertaut ke profil pegawai GSJA. Hubungi HRD untuk menautkan data pegawai Anda.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleSwitchRole}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <ArrowsLeftRight className="w-3.5 h-3.5" weight="bold" />
                  <span>Ganti Peran</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <SignOut className="w-3.5 h-3.5" weight="bold" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'home' ? (
            <div className="flex flex-col gap-4">
              <AttendanceHeroCard
                isWithinOffice={geofence.isWithinRadius}
                isLoadingLocation={gpsLoading}
                branchName={geofence.satelit?.nama_satelit}
                distanceMeters={geofence.distanceMeters}
                onOpenBranches={() => setBranchesOpen(true)}
                checkInTime={toWibTime(presensi?.check_in_at)}
                checkOutTime={toWibTime(presensi?.check_out_at)}
                workDuration={
                  presensi?.worked_minutes ? formatWorkedMinutes(presensi.worked_minutes) : null
                }
                hasCheckedIn={hasCheckedIn}
                hasCheckedOut={hasCheckedOut}
                isFaceEnrolled={isFaceEnrolled}
                onOpenCamera={(mode) => setCameraMode(mode)}
                onOpenVisit={() => setVisitOpen(true)}
              />

              {gpsError && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-center justify-between gap-2 text-xs text-amber-800">
                  <span>{gpsError}</span>
                  <button
                    type="button"
                    onClick={refreshGps}
                    className="font-bold underline shrink-0"
                  >
                    Muat Ulang GPS
                  </button>
                </div>
              )}

              {/* Quick Menu (4 Buttons) */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={!hasCheckedIn}
                  onClick={() => setVisitOpen(true)}
                  className="bg-white rounded-2xl border border-slate-100 shadow-xs p-2.5 flex flex-col items-center gap-1.5 disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#3B1F3D] flex items-center justify-center">
                    <PlusCircle className="w-5 h-5" weight="bold" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">Tambah Visit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="bg-white rounded-2xl border border-slate-100 shadow-xs p-2.5 flex flex-col items-center gap-1.5"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <CalendarDots className="w-5 h-5" weight="bold" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">Kalender</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="bg-white rounded-2xl border border-slate-100 shadow-xs p-2.5 flex flex-col items-center gap-1.5"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ClipboardText className="w-5 h-5" weight="bold" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">Overview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBranchesOpen(true)}
                  className="bg-white rounded-2xl border border-slate-100 shadow-xs p-2.5 flex flex-col items-center gap-1.5"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Buildings className="w-5 h-5" weight="bold" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">Satelit GPS</span>
                </button>
              </div>

              {/* Ringkasan Overview Harian Singkat */}
              {hasCheckedIn && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                      Overview Harian (1 Catatan & 1 Lampiran)
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className="text-[11px] font-bold text-[#3B1F3D] hover:underline"
                    >
                      {presensi?.overview_note ? 'Ubah' : 'Isi Sekarang'}
                    </button>
                  </div>
                  {presensi?.overview_note ? (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {presensi.overview_note}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Belum ada ringkasan aktivitas hari ini.
                    </p>
                  )}
                  {presensi?.overview_attachment_url && (
                    <a
                      href={presensi.overview_attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{presensi.overview_attachment_name || 'Lampiran Overview'}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Jurnal Kunjungan Hari Ini */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                    Jurnal Kunjungan Hari Ini ({visits.length})
                  </h3>
                  {hasCheckedIn && (
                    <button
                      type="button"
                      onClick={() => setVisitOpen(true)}
                      className="text-xs font-bold text-[#3B1F3D] hover:underline"
                    >
                      + Tambah
                    </button>
                  )}
                </div>

                {visits.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-center">
                    <p className="text-xs font-semibold text-slate-500">
                      Belum ada catatan kunjungan pastoral hari ini.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {hasCheckedIn
                        ? 'Tekan "Tambah Visit" untuk melampirkan selfie live, GPS, & catatan.'
                        : 'Lakukan Check-In terlebih dahulu untuk mencatat kunjungan.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {visits.map((v) => (
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
                          <span className="inline-block text-[10px] font-semibold text-indigo-600">
                            {v.kategori}
                          </span>
                          <p className="text-xs text-slate-600 mt-0.5 leading-snug">{v.notes}</p>
                          <a
                            href={`https://maps.google.com/?q=${v.lat},${v.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:underline"
                          >
                            <MapPin className="w-3 h-3" weight="fill" />
                            <span>Titik GPS</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'calendar' ? (
            <CalendarHistoryTab />
          ) : activeTab === 'overview' ? (
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5">
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Overview Aktivitas Harian
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Setiap hari kerja, Anda dapat mengisi 1 catatan ringkasan dan 1 lampiran pendukung
                (JPG/PNG/PDF maks. 5MB).
              </p>

              {!hasCheckedIn ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 font-semibold">
                  Silakan lakukan Check-In terlebih dahulu untuk mengisi Overview hari ini.
                </div>
              ) : (
                <form onSubmit={handleSaveOverview} className="flex flex-col gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                      Catatan Ringkasan Hari Ini
                    </label>
                    <textarea
                      rows={4}
                      value={overviewNote}
                      onChange={(e) => setOverviewNote(e.target.value)}
                      placeholder="Tuliskan ringkasan keseluruhan pelayanan / pekerjaan Anda hari ini..."
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#3B1F3D]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                      Lampiran Pendukung (Maks 1 File)
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => setOverviewFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-[#3B1F3D]"
                    />
                    {presensi?.overview_attachment_url && !overviewFile && (
                      <a
                        href={presensi.overview_attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>
                          Lampiran saat ini: {presensi.overview_attachment_name || 'Lihat File'}
                        </span>
                      </a>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingOverview}
                    className="w-full py-3 rounded-xl bg-[#3B1F3D] text-white font-bold text-sm shadow-md disabled:opacity-50"
                  >
                    {savingOverview ? 'Menyimpan...' : 'Simpan Overview Harian'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {pegawai.face_photo_url && !avatarError ? (
                  <img
                    src={pegawai.face_photo_url}
                    alt={pegawai.nama_lengkap}
                    onError={() => setAvatarError(true)}
                    className="w-14 h-14 rounded-full object-cover border-2 border-[#3B1F3D]"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-purple-100 text-[#3B1F3D] flex items-center justify-center font-extrabold text-lg">
                    {pegawai.nama_lengkap?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {pegawai.nama_lengkap}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {pegawai.id_pegawai} · {pegawai.nama_satelit || 'Pusat'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Status Face ID</span>
                {isFaceEnrolled ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle className="w-4 h-4" weight="fill" /> Terdaftar
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCameraMode('ENROLL')}
                    className="px-3 py-1 rounded-lg bg-[#3B1F3D] text-white text-xs font-bold"
                  >
                    Daftar Sekarang
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={refreshGps}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Perbarui Titik GPS Sekarang
              </button>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleSwitchRole}
                  className="py-2.5 px-3 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-indigo-100"
                >
                  <ArrowsLeftRight className="w-4 h-4" weight="bold" />
                  <span>Ganti Peran</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-2.5 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-rose-100"
                >
                  <SignOut className="w-4 h-4" weight="bold" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation Bar */}
        <BottomNavBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          hasCheckedIn={hasCheckedIn}
          onCenterAction={handleCenterAction}
        />

        {/* Camera & Face Recognition Drawer */}
        <CameraDrawer
          isOpen={cameraMode !== null}
          onClose={() => setCameraMode(null)}
          mode={cameraMode || 'CHECK_IN'}
          coords={coords}
          branchName={geofence.satelit?.nama_satelit}
          onSuccess={(msg) => {
            setOverlayState({ status: 'success', message: msg });
            loadTodayData();
          }}
        />

        {/* Visit Drawer */}
        <VisitDrawer
          isOpen={visitOpen}
          onClose={() => setVisitOpen(false)}
          satelits={satelits}
          coords={coords}
          onSuccess={(msg) => {
            setOverlayState({ status: 'success', message: msg });
            loadTodayData();
          }}
        />

        {/* Satelit Geofence List Modal */}
        {branchesOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Titik GPS Satelit GSJA (Check-In Area)
                </h3>
                <button
                  type="button"
                  onClick={() => setBranchesOpen(false)}
                  className="p-1.5 rounded-full bg-slate-100 text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex flex-col gap-2">
                {satelits.map((s) => {
                  const hasCoord = s.latitude != null && s.longitude != null;
                  const dist =
                    coords && hasCoord
                      ? Math.round(
                          calculateDistanceMeters(
                            coords.lat,
                            coords.lng,
                            Number(s.latitude),
                            Number(s.longitude)
                          )
                        )
                      : null;
                  const inside = dist != null && dist <= (Number(s.radius_meter) || 100);
                  return (
                    <div
                      key={s.id}
                      className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                        inside ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          {s.nama_satelit}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {hasCoord
                            ? `Radius ${s.radius_meter}m · ${s.gps_location || `${s.latitude}, ${s.longitude}`}`
                            : 'Koordinat GPS belum diatur oleh Super Admin'}
                        </div>
                      </div>
                      {dist != null && (
                        <span
                          className={`text-[11px] font-bold px-2 py-1 rounded-full shrink-0 ${
                            inside
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {dist}m
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
