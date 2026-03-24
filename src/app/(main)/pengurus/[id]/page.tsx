'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function PengurusDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const isReadOnly = searchParams.get('mode') !== 'edit';

  const [isLoading, setIsLoading] = useState(true);
  const [pengurus, setPengurus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profil' | 'jabatan' | 'audit'>('profil');
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  const [userData, setUserData] = useState<any>(null);
  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [resPengurus, resUser] = await Promise.all([
          fetch(`/api/pengurus/${id}`),
          fetch('/api/auth/me'),
        ]);
        if (resUser.ok) setUserData(await resUser.json());
        if (resPengurus.ok) {
          const json = await resPengurus.json();
          if (json.success) setPengurus(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchAll();
  }, [id]);

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const statusBadge = (status: string) => {
    if (status === 'Aktif') return 'bg-emerald-100 text-emerald-700';
    if (status === 'Demisioner') return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const auditIcon = (aksi: string) => {
    if (aksi === 'CREATE') return { icon: 'person_add', cls: 'bg-emerald-100 text-emerald-600' };
    if (aksi === 'UPDATE') return { icon: 'edit', cls: 'bg-blue-100 text-blue-600' };
    if (aksi === 'DEACTIVATE') return { icon: 'person_off', cls: 'bg-amber-100 text-amber-600' };
    return { icon: 'info', cls: 'bg-slate-100 text-slate-500' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-violet-600 animate-spin"></div>
      </div>
    );
  }

  if (!pengurus) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <span className="material-icons-round text-5xl text-slate-300">error_outline</span>
        <p className="text-slate-500">Data pengurus tidak ditemukan.</p>
        <Link href="/pengurus" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
          Kembali ke Daftar Pengurus
        </Link>
      </div>
    );
  }

  const latestJabatan = pengurus.jabatan?.[0];

  return (
    <div className="w-full flex flex-col gap-6 pb-12">

      {/* Breadcrumb */}
      <div className="w-full flex flex-col gap-4">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/pengurus" className="hover:text-violet-600">Database Pengurus</Link>
          <span className="material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">{pengurus.nama_lengkap}</span>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-slate-900 text-3xl font-black leading-9 mb-1">
              {isReadOnly ? 'Detail Pengurus' : 'Edit Pengurus'}
            </h1>
            <div className="text-slate-500 text-base font-medium flex gap-1">
              <span>ID Pengurus:</span>
              <span className="text-slate-700 font-bold font-mono">{pengurus.id_pengurus}</span>
            </div>
          </div>
          {isReadOnly && hasPermission('pengurus_manage') && (
            <Link
              href={`/pengurus/${id}?mode=edit`}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2 font-bold text-sm shadow-sm transition-colors"
            >
              <span className="material-icons-round text-[18px]">edit</span> Edit Data
            </Link>
          )}
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="w-full flex flex-col lg:flex-row gap-6 items-start">

        {/* === KOLOM KIRI: PROFILE CARD === */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">

          {/* Avatar + Nama */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={pengurus.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pengurus.nama_lengkap)}&background=random&size=128`}
                alt="avatar"
                className="w-28 h-28 rounded-2xl object-cover border-2 border-white shadow-md"
              />
              <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusBadge(latestJabatan?.status_jabatan || 'non-aktif')}`}>
                {latestJabatan?.status_jabatan || 'Non-Aktif'}
              </span>
            </div>
            <div className="text-center mt-2">
              <div className="text-slate-900 text-xl font-black leading-tight">{pengurus.nama_lengkap}</div>
              <div className="text-slate-500 text-sm mt-1 font-mono">{pengurus.id_pengurus}</div>
            </div>
          </div>

          {/* Info Jabatan Aktif */}
          {latestJabatan && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3">
              <h3 className="text-slate-400 text-[10px] uppercase font-black tracking-wider">Jabatan Terakhir</h3>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-violet-100 text-violet-700 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-icons-round text-[20px]">workspace_premium</span>
                </div>
                <div>
                  <div className="text-slate-800 font-bold text-sm">{latestJabatan.nama_jabatan}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{latestJabatan.nama_satelit || latestJabatan.nama_komisi || latestJabatan.nama_departemen || '-'}</div>
                  <div className="text-slate-400 text-xs mt-1">{latestJabatan.nama_periode}</div>
                </div>
              </div>
            </div>
          )}

          {/* Info Satelit & Bergabung */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3">
            <h3 className="text-slate-400 text-[10px] uppercase font-black tracking-wider">Informasi Dasar</h3>
            <div className="flex flex-col gap-2">
              {[
                { icon: 'satellite_alt', label: 'Satelit Asal', value: pengurus.nama_satelit_jemaat || '-' },
                { icon: 'calendar_today', label: 'Terdaftar', value: formatDate(pengurus.created_at) },
                { icon: 'badge', label: 'NIK', value: pengurus.nik || '-' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="material-icons-round text-slate-400 text-[16px] w-5 shrink-0">{item.icon}</span>
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase">{item.label}</div>
                    <div className="text-slate-700 text-xs font-semibold">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* === KOLOM KANAN: TABS === */}
        <div className="flex-1 flex flex-col gap-0">

          {/* Tab Header */}
          <div className="w-full border-b border-slate-200 flex gap-6 bg-white rounded-t-2xl px-6 pt-4">
            {([
              { key: 'profil', label: 'Informasi Profil', icon: 'person' },
              { key: 'jabatan', label: 'Riwayat Jabatan', icon: 'workspace_premium' },
              { key: 'audit', label: 'Audit Log', icon: 'history' },
            ] as { key: 'profil'|'jabatan'|'audit', label: string, icon: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 pb-4 text-sm font-bold transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="material-icons-round text-[16px]">{tab.icon}</span>
                {tab.label}
                {tab.key === 'jabatan' && pengurus.jabatan?.length > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black flex items-center justify-center">
                    {pengurus.jabatan.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-b-2xl shadow-sm border border-slate-200 border-t-0 p-6">

            {/* ---- TAB 1: PROFIL ---- */}
            {activeTab === 'profil' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Nama Lengkap', value: pengurus.nama_lengkap },
                  { label: 'NIK', value: pengurus.nik || '-' },
                  { label: 'Jenis Kelamin', value: pengurus.jenis_kelamin || '-' },
                  { label: 'Tempat, Tanggal Lahir', value: `${pengurus.tempat_lahir || '-'}, ${formatDate(pengurus.tanggal_lahir)}` },
                  { label: 'Status Pernikahan', value: pengurus.status_pernikahan || '-' },
                  { label: 'Alamat', value: pengurus.alamat || '-' },
                  { label: 'No. HP', value: pengurus.no_hp || '-' },
                  { label: 'Email', value: pengurus.email || '-' },
                  { label: 'Tanggal Baptis', value: formatDate(pengurus.tanggal_baptis) },
                  { label: 'Tanggal Sidi', value: formatDate(pengurus.tanggal_sidi) },
                ].map(item => (
                  <div key={item.label} className="flex flex-col gap-1">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                    <span className="text-slate-800 text-sm font-semibold">{item.value}</span>
                  </div>
                ))}
                <div className="col-span-full">
                  <Link
                    href={`/jemaat/${pengurus.jemaat_id}?mode=view`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 font-semibold transition-colors"
                  >
                    <span className="material-icons-round text-[16px] text-slate-500">open_in_new</span>
                    Lihat Profil Jemaat Lengkap
                  </Link>
                </div>
              </div>
            )}

            {/* ---- TAB 2: RIWAYAT JABATAN ---- */}
            {activeTab === 'jabatan' && (
              <div className="flex flex-col gap-4">
                {pengurus.jabatan?.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                    <span className="material-icons-round text-5xl opacity-40">workspace_premium</span>
                    <span className="text-sm">Belum ada riwayat jabatan.</span>
                  </div>
                ) : (
                  pengurus.jabatan.map((jab: any) => (
                    <div key={jab.id} className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                            <span className="material-icons-round text-violet-600 text-[20px]">workspace_premium</span>
                          </div>
                          <div>
                            <div className="text-slate-900 font-black text-base">{jab.nama_jabatan}</div>
                            <div className="text-slate-500 text-xs mt-0.5">
                              {jab.lingkup} — {jab.nama_satelit || jab.nama_komisi || jab.nama_departemen || 'Umum'}
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase shrink-0 ${statusBadge(jab.status_jabatan)}`}>
                          {jab.status_jabatan}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { label: 'Periode', value: `${jab.nama_periode} (${jab.tahun_mulai}–${jab.tahun_akhir})` },
                          { label: 'Jalur', value: jab.jalur_pengangkatan || '-' },
                          { label: 'Mulai Menjabat', value: formatDate(jab.tanggal_mulai) },
                          { label: 'Akhir Menjabat', value: jab.tanggal_akhir_menjabat ? formatDate(jab.tanggal_akhir_menjabat) : '(Belum Berakhir)' },
                        ].map(i => (
                          <div key={i.label} className="flex flex-col gap-0.5">
                            <span className="text-slate-400 text-[10px] uppercase font-black">{i.label}</span>
                            <span className="text-slate-700 text-xs font-semibold">{i.value}</span>
                          </div>
                        ))}
                      </div>

                      {jab.catatan && (
                        <div className="px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 italic">
                          📝 {jab.catatan}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ---- TAB 3: AUDIT LOG ---- */}
            {activeTab === 'audit' && (
              <div className="flex flex-col gap-3">
                {pengurus.audit_log?.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                    <span className="material-icons-round text-5xl opacity-40">history</span>
                    <span className="text-sm">Belum ada catatan aktivitas.</span>
                  </div>
                ) : (
                  pengurus.audit_log.map((log: any) => {
                    const { icon, cls } = auditIcon(log.aksi);
                    return (
                      <div key={log.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cls}`}>
                          <span className="material-icons-round text-[18px]">{icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-slate-800 font-bold text-sm">{log.aksi}</span>
                            <span className="text-slate-400 text-xs">oleh {log.user_email || 'Sistem'}</span>
                          </div>
                          <div className="text-slate-600 text-xs">{log.keterangan}</div>
                        </div>
                        <div className="text-slate-400 text-[10px] shrink-0 text-right">
                          {formatDate(log.created_at)}<br />
                          {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />
    </div>
  );
}
