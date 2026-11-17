'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  Paperclip,
  RotateCcw,
  Settings2,
  X,
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Eye,
  Smartphone,
  Save,
  Trash2,
  MessageSquare,
  Send,
} from 'lucide-react';
import { formatWorkedMinutes } from '@/lib/presensiTime';

function getTodayWib(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function formatWibDateTime(iso?: string | null): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function formatWibTime(iso?: string | null): string {
  if (!iso) return '--:--';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export default function PresensiMonitoringPage() {
  const todayStr = useMemo(() => getTodayWib(), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [roleId, setRoleId] = useState('');
  const [satelitId, setSatelitId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [rows, setRows] = useState<any[]>([]);
  const [roles, setRoles] = useState<{ id: number; nama_role: string }[]>([]);
  const [satelits, setSatelits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((auth) => {
        if (auth) {
          setCanManage(Boolean(auth.is_super_admin || auth.permissions?.includes('presensi_monitoring_manage')));
        }
      })
      .catch(() => {});
  }, []);

  // Detail modal (Form + Chatter Audit Log)
  const [detailRow, setDetailRow] = useState<any | null>(null);
  const [overlayState, setOverlayState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [editCheckInTime, setEditCheckInTime] = useState('');
  const [editCheckOutTime, setEditCheckOutTime] = useState('');
  const [editStatus, setEditStatus] = useState<'TEPAT_WAKTU' | 'TERLAMBAT'>('TEPAT_WAKTU');
  const [editOverviewNote, setEditOverviewNote] = useState('');
  const [editReason, setEditReason] = useState('');
  const [savingPresensi, setSavingPresensi] = useState(false);
  const [deletingPresensi, setDeletingPresensi] = useState(false);
  const [chatterInput, setChatterInput] = useState('');
  const [sendingNote, setSendingNote] = useState(false);

  const openDetailModal = (row: any) => {
    setDetailRow(row);
    setEditCheckInTime(row.check_in_at ? formatWibTime(row.check_in_at).replace('.', ':') : '');
    setEditCheckOutTime(row.check_out_at ? formatWibTime(row.check_out_at).replace('.', ':') : '');
    setEditStatus(row.check_in_status === 'TERLAMBAT' ? 'TERLAMBAT' : 'TEPAT_WAKTU');
    setEditOverviewNote(row.overview_note || '');
    setEditReason('');
    setChatterInput('');
  };

  // Modal Pengaturan GPS Satelit
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [editSatelitId, setEditSatelitId] = useState<string>('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editRadius, setEditRadius] = useState('100');
  const [savingGps, setSavingGps] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (roleId) params.set('role_id', roleId);
      if (satelitId) params.set('satelit_id', satelitId);
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/pegawai/presensi/monitoring?${params.toString()}`);
      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        const nextRows = json.data.rows || [];
        setRows(nextRows);
        setDetailRow((prev: any) => {
          if (!prev) return null;
          return nextRows.find((r: any) => r.pegawai_id === prev.pegawai_id) || null;
        });
        setRoles(json.data.roles || []);
        setSatelits(json.data.satelits || []);
        if (!editSatelitId && json.data.satelits?.length > 0) {
          const first = json.data.satelits[0];
          setEditSatelitId(String(first.id));
          setEditLat(first.latitude != null ? String(first.latitude) : '');
          setEditLng(first.longitude != null ? String(first.longitude) : '');
          setEditRadius(String(first.radius_meter || 100));
        }
      }
    } catch (e) {
      console.error('[MonitoringPage] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, roleId, satelitId, statusFilter, search, editSatelitId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const total = rows.length;
    const hadir = rows.filter((r) => Boolean(r.check_in_at)).length;
    const tidakAbsen = total - hadir;
    const terlambat = rows.filter((r) => r.check_in_status === 'TERLAMBAT').length;
    const totalVisits = rows.reduce((acc, r) => acc + (Array.isArray(r.visits) ? r.visits.length : 0), 0);
    return { total, hadir, tidakAbsen, terlambat, totalVisits };
  }, [rows]);

  const handleResetFace = (pegawaiId: number, nama: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Reset Face ID Pegawai?',
      message: `Reset Face ID untuk ${nama}? Pegawai harus mendaftarkan wajah ulang saat presensi berikutnya.`,
      confirmText: 'Ya, Reset Face ID',
      onConfirm: async () => {
        setConfirmState((p) => ({ ...p, isOpen: false }));
        setOverlayState({ status: 'loading', message: 'Mereset Face ID...' });
        try {
          const res = await fetch('/api/pegawai/presensi/monitoring', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_face', pegawaiId }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.message);
          setOverlayState({ status: 'success', message: json.message });
          setDetailRow(null);
          loadData();
        } catch (err: any) {
          setOverlayState({ status: 'error', message: err?.message || 'Gagal mereset Face ID' });
        }
      },
    });
  };

  const handleAdminSavePresensi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailRow) return;
    setSavingPresensi(true);
    setOverlayState({ status: 'loading', message: 'Menyimpan koreksi presensi...' });
    try {
      const res = await fetch('/api/pegawai/presensi/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_save_presensi',
          pegawaiId: detailRow.pegawai_id,
          tanggal: selectedDate,
          checkInTime: editCheckInTime || null,
          checkOutTime: editCheckOutTime || null,
          checkInStatus: editStatus,
          overviewNote: editOverviewNote || null,
          reason: editReason || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setOverlayState({ status: 'success', message: json.message });
      setEditReason('');
      await loadData();
    } catch (err: any) {
      setOverlayState({ status: 'error', message: err?.message || 'Gagal menyimpan koreksi presensi.' });
    } finally {
      setSavingPresensi(false);
    }
  };

  const handleAdminHardDeletePresensi = () => {
    if (!detailRow || !detailRow.presensi_id) return;
    setConfirmState({
      isOpen: true,
      title: 'Hapus Permanen Presensi?',
      message: `Hapus permanen presensi ${detailRow.nama_lengkap} pada tanggal ${selectedDate}? Pegawai dapat melakukan Check-In ulang dan riwayat penghapusan tetap tercatat di Chatter.`,
      confirmText: 'Ya, Hapus Permanen',
      onConfirm: async () => {
        setConfirmState((p) => ({ ...p, isOpen: false }));
        setDeletingPresensi(true);
        setOverlayState({ status: 'loading', message: 'Menghapus presensi...' });
        try {
          const res = await fetch('/api/pegawai/presensi/monitoring', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'admin_delete_presensi',
              pegawaiId: detailRow.pegawai_id,
              tanggal: selectedDate,
              reason: editReason || undefined,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.message);
          setOverlayState({ status: 'success', message: json.message });
          setEditCheckInTime('');
          setEditCheckOutTime('');
          setEditOverviewNote('');
          setEditReason('');
          await loadData();
        } catch (err: any) {
          setOverlayState({ status: 'error', message: err?.message || 'Gagal menghapus presensi.' });
        } finally {
          setDeletingPresensi(false);
        }
      },
    });
  };

  const handleSendChatterNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailRow || !chatterInput.trim()) return;
    setSendingNote(true);
    setOverlayState({ status: 'loading', message: 'Mengirim Log Note...' });
    try {
      const res = await fetch('/api/pegawai/presensi/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_chatter_note',
          pegawaiId: detailRow.pegawai_id,
          tanggal: selectedDate,
          presensiId: detailRow.presensi_id || null,
          message: chatterInput.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setOverlayState({ status: 'success', message: json.message });
      setChatterInput('');
      await loadData();
    } catch (err: any) {
      setOverlayState({ status: 'error', message: err?.message || 'Gagal mengirim Log Note.' });
    } finally {
      setSendingNote(false);
    }
  };

  const handleSelectEditSatelit = (sid: string) => {
    setEditSatelitId(sid);
    const found = satelits.find((s) => String(s.id) === sid);
    if (found) {
      setEditLat(found.latitude != null ? String(found.latitude) : '');
      setEditLng(found.longitude != null ? String(found.longitude) : '');
      setEditRadius(String(found.radius_meter || 100));
    }
  };

  const handleSaveSatelitGps = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGps(true);
    try {
      const res = await fetch('/api/pegawai/presensi/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_satelit_gps',
          satelitId: Number(editSatelitId),
          latitude: Number(editLat),
          longitude: Number(editLng),
          radiusMeter: Number(editRadius) || 100,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setOverlayState({ status: 'success', message: json.message });
      setGpsModalOpen(false);
      loadData();
    } catch (err: any) {
      setOverlayState({ status: 'error', message: err?.message || 'Gagal menyimpan koordinat satelit.' });
    } finally {
      setSavingGps(false);
    }
  };

  if (forbidden) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center shadow-sm">
          <h2 className="text-lg font-extrabold text-rose-700">Akses Terbatas</h2>
          <p className="text-sm text-slate-600 mt-1">
            Role Anda belum memiliki izin <b>Presensi Monitoring View</b> pada Matrix Edit Hak Akses.
          </p>
          <Link
            href="/pegawai/presensi"
            className="mt-4 inline-block px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            Kembali ke Presensi Saya
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-5">
      <SubmitOverlay
        status={overlayState.status}
        message={overlayState.message}
        onClose={() => setOverlayState({ status: 'idle', message: '' })}
      />
      <AlertModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((p) => ({ ...p, isOpen: false }))}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Attendance & Jurnal Kunjungan Pastoral
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Monitoring kehadiran harian pegawai (hadir & tidak hadir), filter tanggal & role, serta
            audit foto selfie & jurnal kunjungan pastoral.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setGpsModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-50 shadow-xs"
            >
              <Settings2 className="w-4 h-4 text-indigo-600" />
              <span>Atur GPS Satelit</span>
            </button>
          )}
          <Link
            href="/pegawai/presensi"
            className="px-3.5 py-2 rounded-xl bg-[#3B1F3D] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:opacity-95"
          >
            <Smartphone className="w-4 h-4" />
            <span>Tampilan HP Pegawai</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase">
            <Users className="w-4 h-4 text-slate-600" /> Total Pegawai
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase">
            <CheckCircle2 className="w-4 h-4" /> Sudah Absen
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{stats.hadir}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase">
            <UserX className="w-4 h-4" /> Tidak Absen
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">{stats.tidakAbsen}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase">
            <Clock className="w-4 h-4" /> Terlambat (&gt;08:15)
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.terlambat}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase">
            <MapPin className="w-4 h-4" /> Total Visit
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-1">{stats.totalVisits}</div>
        </div>
      </div>

      {/* Filter & Date Navigation Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedDate === todayStr
                  ? 'bg-[#3B1F3D] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(shiftDate(todayStr, -1))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedDate === shiftDate(todayStr, -1)
                  ? 'bg-[#3B1F3D] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Kemarin
            </button>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                className="p-1.5 hover:bg-slate-100 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 outline-none py-1"
                />
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                className="p-1.5 hover:bg-slate-100 text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama / ID..."
                className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-[#3B1F3D] w-44"
              />
            </div>

            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white outline-none"
            >
              <option value="">Semua Role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nama_role.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            <select
              value={satelitId}
              onChange={(e) => setSatelitId(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white outline-none"
            >
              <option value="">Semua Satelit</option>
              {satelits.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama_satelit}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white outline-none"
            >
              <option value="">Semua Status</option>
              <option value="HADIR">Sudah Absen</option>
              <option value="BELUM_ABSEN">Tidak Absen</option>
              <option value="TERLAMBAT">Terlambat</option>
            </select>
          </div>
        </div>
      </div>

      {/* Odoo-Style Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Satelit / Role</th>
                <th className="py-3 px-3">Absen Bulan Ini</th>
                <th className="py-3 px-3">Check In</th>
                <th className="py-3 px-3">Check Out</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Visit</th>
                <th className="py-3 px-3">Worked Hours</th>
                <th className="py-3 px-4 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Memuat data presensi...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Tidak ada data pegawai yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const hasIn = Boolean(row.check_in_at);
                  const visitCount = Array.isArray(row.visits) ? row.visits.length : 0;
                  return (
                    <tr
                      key={row.pegawai_id}
                      onClick={() => openDetailModal(row)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.nama_lengkap}</div>
                        <div className="text-[11px] text-slate-400">
                          {row.id_pegawai} · {row.nama_jabatan || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-700">
                          {row.nama_satelit || 'Pusat'}
                        </div>
                        {Array.isArray(row.role_names) && row.role_names.length > 0 && (
                          <div className="text-[10px] text-indigo-600 font-semibold">
                            {row.role_names.map((r: string) => r.replace(/_/g, ' ')).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {row.monthly_attendance_count ?? 0} hari
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {hasIn ? (
                          <div>
                            <div className="font-bold">{formatWibTime(row.check_in_at)} WIB</div>
                            <div className="text-[10px] text-slate-400">
                              {row.check_in_satelit_nama || 'Kantor'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">--:--</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {row.check_out_at ? (
                          <span className="font-bold">{formatWibTime(row.check_out_at)} WIB</span>
                        ) : (
                          <span className="text-slate-300">--:--</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {!hasIn ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            Tidak Absen
                          </span>
                        ) : row.check_in_status === 'TERLAMBAT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Terlambat
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            Tepat Waktu
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            visitCount > 0
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {visitCount} Visit
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {row.worked_minutes > 0
                          ? formatWorkedMinutes(row.worked_minutes)
                          : hasIn
                          ? 'Berjalan'
                          : '00:00'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetailModal(row);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 text-[11px] font-bold"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Odoo-Style Detail Modal (Form Kiri + Chatter Foto Kanan) */}
      {detailRow && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                  Attendance Detail · {selectedDate}
                </span>
                <h2 className="text-base font-black text-slate-900">
                  {detailRow.nama_lengkap} ({detailRow.id_pegawai})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
                  Absen Bulan Ini: {detailRow.monthly_attendance_count ?? 0} hari
                </span>
                {canManage && detailRow.is_face_enrolled && (
                  <button
                    type="button"
                    onClick={() => handleResetFace(detailRow.pegawai_id, detailRow.nama_lengkap)}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold inline-flex items-center gap-1 hover:bg-rose-100"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Face ID
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  className="p-1.5 rounded-lg bg-slate-200/70 text-slate-600 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 overflow-y-auto flex-1">
              {/* Left Column: Editable Odoo Attendance Form + Overview + Visits */}
              <div className="md:col-span-7 p-5 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col gap-4">
                <form onSubmit={handleAdminSavePresensi} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                      {canManage ? 'Koreksi & Edit Presensi Manual' : 'Detail Presensi (Mode Baca)'}
                    </h4>
                    {canManage && detailRow.presensi_id && (
                      <button
                        type="button"
                        disabled={deletingPresensi}
                        onClick={handleAdminHardDeletePresensi}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold inline-flex items-center gap-1 hover:bg-rose-700 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{deletingPresensi ? 'Menghapus...' : 'Hapus Permanen'}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">Check In (WIB)</label>
                      <input
                        type="time"
                        value={editCheckInTime}
                        onChange={(e) => setEditCheckInTime(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">Check Out (WIB)</label>
                      <input
                        type="time"
                        value={editCheckOutTime}
                        onChange={(e) => setEditCheckOutTime(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as 'TEPAT_WAKTU' | 'TERLAMBAT')}
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                      >
                        <option value="TEPAT_WAKTU">Tepat Waktu</option>
                        <option value="TERLAMBAT">Terlambat</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">Overview Harian</label>
                      <input
                        type="text"
                        value={editOverviewNote}
                        onChange={(e) => setEditOverviewNote(e.target.value)}
                        placeholder="Catatan overview harian..."
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">Alasan Koreksi (Chatter)</label>
                      <input
                        type="text"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="Contoh: Lupa clock-out saat pelayanan..."
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      Durasi Kerja: <b>{detailRow.worked_minutes > 0 ? formatWorkedMinutes(detailRow.worked_minutes) : '-'}</b>
                      {detailRow.check_in_satelit_nama ? ` · Lokasi: ${detailRow.check_in_satelit_nama} (${detailRow.check_in_distance_m ?? 0}m)` : ''}
                    </span>
                    {canManage && (
                      <button
                        type="submit"
                        disabled={savingPresensi}
                        className="px-3.5 py-2 rounded-lg bg-[#3B1F3D] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-95 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingPresensi ? 'Menyimpan...' : detailRow.presensi_id ? 'Simpan Perubahan' : 'Buat Presensi Manual'}</span>
                      </button>
                    )}
                  </div>
                </form>

                {detailRow.overview_attachment_url && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900">Lampiran Overview Pegawai</span>
                    <a
                      href={detailRow.overview_attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{detailRow.overview_attachment_name || 'Buka Lampiran Overview'}</span>
                    </a>
                  </div>
                )}

                {/* Visit Details */}
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-2">
                    Rincian Visit / Kunjungan ({detailRow.visits?.length || 0})
                  </h4>
                  {!detailRow.visits || detailRow.visits.length === 0 ? (
                    <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3 text-center">
                      Tidak ada visit tercatat pada tanggal ini.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {detailRow.visits.map((v: any) => (
                        <div
                          key={v.id}
                          className="rounded-xl border border-slate-200 p-3 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900">
                              {v.satelit_tujuan_nama || v.lokasi_bebas}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {formatWibTime(v.waktu_kunjungan)} WIB · {v.kategori}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{v.notes}</p>
                          <a
                            href={`https://maps.google.com/?q=${v.lat},${v.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline w-fit"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>
                              Buka di Google Maps ({Number(v.lat).toFixed(5)}, {Number(v.lng).toFixed(5)})
                            </span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Odoo Chatter (Audit Trail + Log Note + Bukti Foto) */}
              <div className="md:col-span-5 p-5 bg-slate-50/70 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider inline-flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#3B1F3D]" />
                    <span>Chatter & Audit Log Presensi</span>
                  </h4>
                </div>

                {canManage && (
                  <form onSubmit={handleSendChatterNote} className="bg-white rounded-xl border border-slate-200 p-2.5 flex gap-2 shadow-xs">
                    <input
                      type="text"
                      value={chatterInput}
                      onChange={(e) => setChatterInput(e.target.value)}
                      placeholder="Tulis Log note di Chatter..."
                      className="flex-1 text-xs outline-none px-2 text-slate-800"
                    />
                    <button
                      type="submit"
                      disabled={sendingNote || !chatterInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-[#3B1F3D] text-white text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      <Send className="w-3 h-3" /> Log note
                    </button>
                  </form>
                )}

                {/* Audit Trail & Log Notes */}
                {Array.isArray(detailRow.chatter) && detailRow.chatter.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {detailRow.chatter.map((c: any) => (
                      <div key={`ch-${c.id}`} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-extrabold text-slate-900">{c.actor_name}</span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {formatWibDateTime(c.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{c.message}</p>
                        {Array.isArray(c.changes) && c.changes.length > 0 && (
                          <ul className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1">
                            {c.changes.map((chg: any, idx: number) => (
                              <li key={idx} className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-800">{chg.field}:</span>
                                <span className="line-through text-rose-500">{chg.old}</span>
                                <span>→</span>
                                <span className="font-bold text-emerald-700">{chg.new}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!detailRow.check_in_at &&
                (!detailRow.visits || detailRow.visits.length === 0) &&
                (!detailRow.chatter || detailRow.chatter.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">
                    Belum ada aktivitas chatter atau bukti foto presensi pada tanggal ini.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {detailRow.check_out_photo_url && (
                      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                        <div className="text-xs font-bold text-slate-900 mb-1">
                          Presensi Keluar (Check-Out)
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">
                          {formatWibDateTime(detailRow.check_out_at)} · Kecocokan Wajah:{' '}
                          {detailRow.check_out_face_score
                            ? `${Math.round(Number(detailRow.check_out_face_score) * 100)}%`
                            : '-'}
                        </p>
                        <img
                          src={detailRow.check_out_photo_url}
                          alt="Selfie Check-Out"
                          className="w-full max-h-56 object-cover rounded-lg border border-slate-200"
                        />
                      </div>
                    )}

                    {Array.isArray(detailRow.visits) &&
                      detailRow.visits.map((v: any) => (
                        <div key={`chatter-v-${v.id}`} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                          <div className="text-xs font-bold text-indigo-700 mb-1">
                            Visit: {v.satelit_tujuan_nama || v.lokasi_bebas}
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2">
                            {formatWibDateTime(v.waktu_kunjungan)} · {v.notes}
                          </p>
                          <img
                            src={v.selfie_url}
                            alt="Selfie Visit"
                            className="w-full max-h-56 object-cover rounded-lg border border-slate-200"
                          />
                        </div>
                      ))}

                    {detailRow.check_in_photo_url && (
                      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
                        <div className="text-xs font-bold text-emerald-700 mb-1">
                          Presensi Masuk (Check-In)
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">
                          {formatWibDateTime(detailRow.check_in_at)} ·{' '}
                          {detailRow.check_in_satelit_nama || 'Kantor'} · Kecocokan Wajah:{' '}
                          {detailRow.check_in_face_score
                            ? `${Math.round(Number(detailRow.check_in_face_score) * 100)}%`
                            : '-'}
                        </p>
                        <img
                          src={detailRow.check_in_photo_url}
                          alt="Selfie Check-In"
                          className="w-full max-h-56 object-cover rounded-lg border border-slate-200"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengaturan GPS Satelit */}
      {gpsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Pengaturan Titik GPS & Radius Satelit
              </h3>
              <button
                type="button"
                onClick={() => setGpsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSatelitGps} className="p-5 flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Pilih Satelit</label>
                <select
                  value={editSatelitId}
                  onChange={(e) => handleSelectEditSatelit(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  {satelits.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama_satelit}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    placeholder="-7.257500"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    placeholder="112.752100"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Radius Check-In (Meter)
                </label>
                <input
                  type="number"
                  min={20}
                  max={5000}
                  required
                  value={editRadius}
                  onChange={(e) => setEditRadius(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={savingGps}
                className="mt-1 w-full py-3 rounded-xl bg-[#3B1F3D] text-white text-sm font-bold disabled:opacity-50"
              >
                {savingGps ? 'Menyimpan...' : 'Simpan Titik GPS Satelit'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
