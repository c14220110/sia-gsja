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

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [pengurus, setPengurus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'data_pengurus' | 'riwayat_jabatan' | 'audit_log'>('data_pengurus');
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  const [userData, setUserData] = useState<any>(null);
  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoadingData(true);
      try {
        const [resPengurus, resUser] = await Promise.all([
          fetch(`/api/pengurus/${id}`),
          fetch('/api/auth/me'),
        ]);
        if (resUser.ok) setUserData(await resUser.json());
        if (resPengurus.ok) {
          const json = await resPengurus.json();
          if (json.success && json.data) setPengurus(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingData(false);
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

  if (isLoadingData) {
    return (
      <div className="w-full flex justify-center items-center py-20">
        <span className="material-icons-round animate-spin text-4xl text-slate-400">sync</span>
      </div>
    );
  }

  if (!pengurus) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <span className="material-icons-round text-5xl text-slate-300">error_outline</span>
        <p className="text-slate-500 font-['Inter']">Data pengurus tidak ditemukan.</p>
        <Link href="/pengurus" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
          Kembali ke Daftar Pengurus
        </Link>
      </div>
    );
  }

  const latestJabatan = pengurus.jabatan?.[0];

  return (
    <div className="w-full flex flex-col gap-6 pb-10">

      {/* Breadcrumb & Title Area */}
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="self-stretch inline-flex justify-start items-center gap-2 text-xs font-medium font-['Inter'] leading-4">
          <Link href="/pengurus" className="text-slate-500 hover:text-violet-600">Database Pengurus</Link>
          <span className="text-slate-500 material-icons-round text-[14px]">chevron_right</span>
          <span className="text-slate-700 font-bold">{isReadOnly ? 'Detail Pengurus' : 'Edit Pengurus'}</span>
        </div>
        <div className="self-stretch inline-flex justify-between items-end">
          <div className="inline-flex flex-col justify-start items-start">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">
              {isReadOnly ? 'Detail Data Pengurus' : 'Edit Data Pengurus'}
            </h1>
            <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 flex gap-1">
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

      {/* Tabs */}
      <div className="w-full border-b border-slate-200 inline-flex justify-start items-start gap-8">
        {([
          { key: 'data_pengurus', label: 'Data Pengurus' },
          { key: 'riwayat_jabatan', label: `Riwayat Jabatan${pengurus.jabatan?.length ? ` (${pengurus.jabatan.length})` : ''}` },
          { key: 'audit_log', label: 'Audit Log' },
        ] as { key: 'data_pengurus'|'riwayat_jabatan'|'audit_log', label: string }[]).map(tab => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-2 py-3 border-b-2 inline-flex flex-col justify-center items-center cursor-pointer transition-colors ${activeTab === tab.key ? 'border-slate-700' : 'border-transparent'}`}
          >
            <span className={`text-sm font-bold font-['Inter'] leading-5 ${activeTab === tab.key ? 'text-slate-700' : 'text-slate-400'}`}>
              {tab.label}
            </span>
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="w-full flex flex-col justify-start items-start gap-8 mt-2">

        {/* Top Identity Card */}
        <div className="w-full p-6 bg-white rounded-xl shadow-sm border border-slate-200 inline-flex justify-start items-center gap-6">
          <div className="relative inline-flex flex-col justify-start items-start">
            <div className="w-32 h-32 bg-slate-100 rounded-xl border-2 border-slate-200 inline-flex justify-center items-center overflow-hidden">
              {pengurus.foto_url ? (
                <img src={pengurus.foto_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="material-icons-round text-slate-300 text-[64px]">person</span>
              )}
            </div>
          </div>
          <div className="inline-flex flex-col justify-start items-start w-full">
            <div className="text-slate-900 text-2xl font-bold font-['Inter'] leading-8 mb-1">{pengurus.nama_lengkap}</div>
            <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6 mb-3">
              {isReadOnly ? 'Arsip detail informasi pengurus gereja.' : 'Silakan perbarui data pengurus yang relevan.'}
            </div>
            <div className="self-stretch pt-2 inline-flex justify-start items-start gap-2">
              <div className="px-3 py-1 bg-slate-100 rounded-full inline-flex">
                <div className="text-slate-700 text-[10px] font-bold font-['Inter'] uppercase leading-4 tracking-wide">
                  {isReadOnly ? 'Mode Lihat Data' : 'Mode Edit Data'}
                </div>
              </div>
              {latestJabatan && (
                <div className={`px-3 py-1 rounded-full inline-flex ${statusBadge(latestJabatan.status_jabatan)}`}>
                  <div className="text-[10px] font-bold font-['Inter'] uppercase leading-4 tracking-wide">
                    {latestJabatan.status_jabatan} — {latestJabatan.nama_jabatan}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================== TAB 1: DATA PENGURUS ==================== */}
        {activeTab === 'data_pengurus' && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

            {/* KOLOM KIRI */}
            <div className="flex flex-col gap-8">

              {/* Informasi Personal */}
              <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6">
                <div className="w-full inline-flex justify-start items-center gap-2">
                  <span className="material-icons-round text-slate-700 text-[18px]">badge</span>
                  <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Informasi Personal</span>
                </div>
                <div className="w-full flex-col gap-4 flex">
                  {[
                    { label: 'NIK', value: pengurus.nik || '-' },
                    { label: 'Jenis Kelamin', value: pengurus.jenis_kelamin || '-' },
                    { label: 'Status Pernikahan', value: pengurus.status_pernikahan || '-' },
                  ].map(item => (
                    <div key={item.label} className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">{item.label}</label>
                      <div className="text-slate-900 text-sm font-semibold font-['Public_Sans']">{item.value}</div>
                    </div>
                  ))}
                  <div className="w-full flex gap-4">
                    <div className="flex-1 flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Kota Lahir</label>
                      <div className="text-slate-900 text-sm font-semibold font-['Public_Sans']">{pengurus.tempat_lahir || '-'}</div>
                    </div>
                    <div className="flex-1 flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tanggal Lahir</label>
                      <div className="text-slate-900 text-sm font-semibold font-['Public_Sans']">{formatDate(pengurus.tanggal_lahir)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kontak */}
              <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6">
                <div className="w-full inline-flex justify-start items-center gap-2">
                  <span className="material-icons-round text-slate-700 text-[18px]">contact_phone</span>
                  <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Kontak</span>
                </div>
                <div className="w-full flex-col gap-4 flex">
                  {[
                    { label: 'No. HP', value: pengurus.no_hp || '-' },
                    { label: 'Email', value: pengurus.email || '-' },
                    { label: 'Alamat', value: pengurus.alamat || '-' },
                  ].map(item => (
                    <div key={item.label} className="w-full flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">{item.label}</label>
                      <div className="text-slate-900 text-sm font-semibold font-['Public_Sans']">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* KOLOM KANAN */}
            <div className="flex flex-col gap-8">

              {/* Status Baptis & Gereja */}
              <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-6">
                <div className="w-full inline-flex justify-start items-center gap-2">
                  <span className="material-icons-round text-slate-700 text-[20px]">how_to_reg</span>
                  <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Status Gereja</span>
                </div>
                <div className="w-full flex-col gap-4 flex">
                  <div className="w-full flex gap-4">
                    <div className="flex-1 flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Tanggal Baptis</label>
                      <div className="text-slate-900 text-sm font-semibold font-['Public_Sans']">{formatDate(pengurus.tanggal_baptis)}</div>
                    </div>
                    <div className="flex-1 flex-col gap-1 flex">
                      <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Status Baptis</label>
                      <div className="text-slate-900 text-sm font-semibold font-['Public_Sans']">{pengurus.status_baptis ? 'Sudah Baptis' : 'Belum Baptis'}</div>
                    </div>
                  </div>
                  <div className="w-full flex-col gap-1 flex">
                    <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Satelit Asal</label>
                    <div className="text-slate-900 text-sm font-semibold font-['Public_Sans']">{pengurus.nama_satelit_jemaat || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Link ke Profil Jemaat */}
              <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col justify-start items-start gap-4">
                <div className="w-full inline-flex justify-start items-center gap-2">
                  <span className="material-icons-round text-slate-700 text-[18px]">link</span>
                  <span className="text-slate-700 text-xs font-bold font-['Inter'] uppercase leading-4 tracking-wider">Profil Jemaat Terhubung</span>
                </div>
                <div className="w-full flex-col gap-1 flex">
                  <label className="text-slate-400 text-xs font-bold font-['Inter'] uppercase leading-4">Nomor Jemaat</label>
                  <div className="text-slate-900 text-sm font-bold font-mono">{pengurus.jemaat_nomor || '-'}</div>
                </div>
                <Link
                  href={`/jemaat/${pengurus.jemaat_id}?mode=view`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 font-semibold transition-colors font-['Inter']"
                >
                  <span className="material-icons-round text-[16px] text-slate-500">open_in_new</span>
                  Lihat Profil Jemaat Lengkap
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: RIWAYAT JABATAN ==================== */}
        {activeTab === 'riwayat_jabatan' && (
          <div className="w-full flex flex-col gap-4">
            {pengurus.jabatan?.length === 0 ? (
              <div className="w-full py-16 bg-white rounded-xl border border-slate-200 flex flex-col items-center gap-3 text-slate-400">
                <span className="material-icons-round text-5xl opacity-40">workspace_premium</span>
                <span className="text-sm font-['Public_Sans']">Belum ada riwayat jabatan.</span>
              </div>
            ) : (
              pengurus.jabatan?.map((jab: any) => (
                <div key={jab.id} className="w-full p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                        <span className="material-icons-round text-violet-700 text-[20px]">workspace_premium</span>
                      </div>
                      <div>
                        <div className="text-slate-900 font-black text-lg font-['Inter']">{jab.nama_jabatan}</div>
                        <div className="text-slate-500 text-sm font-['Public_Sans'] mt-0.5">
                          {jab.lingkup} — {jab.nama_satelit || jab.nama_komisi || jab.nama_departemen || 'Umum'}
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase shrink-0 font-['Inter'] ${statusBadge(jab.status_jabatan)}`}>
                      {jab.status_jabatan}
                    </span>
                  </div>
                  <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                    {[
                      { label: 'Periode', value: `${jab.nama_periode} (${jab.tahun_mulai}–${jab.tahun_akhir})` },
                      { label: 'Jalur Pengangkatan', value: jab.jalur_pengangkatan || '-' },
                      { label: 'Mulai Menjabat', value: formatDate(jab.tanggal_mulai) },
                      { label: 'Akhir Menjabat', value: jab.tanggal_akhir_menjabat ? formatDate(jab.tanggal_akhir_menjabat) : 'Belum Berakhir' },
                    ].map(item => (
                      <div key={item.label} className="flex flex-col gap-0.5">
                        <span className="text-slate-400 text-[10px] font-bold font-['Inter'] uppercase tracking-wider">{item.label}</span>
                        <span className="text-slate-700 text-sm font-semibold font-['Public_Sans']">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {jab.catatan && (
                    <div className="px-4 py-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600 font-['Public_Sans'] italic">
                      📝 {jab.catatan}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== TAB 3: AUDIT LOG ==================== */}
        {activeTab === 'audit_log' && (
          <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
            {pengurus.audit_log?.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
                <span className="material-icons-round text-5xl opacity-40">history</span>
                <span className="text-sm font-['Public_Sans']">Belum ada catatan aktivitas.</span>
              </div>
            ) : (
              pengurus.audit_log?.map((log: any, idx: number) => {
                const { icon, cls } = auditIcon(log.aksi);
                return (
                  <div key={log.id} className={`flex items-start gap-4 p-5 ${idx !== 0 ? 'border-t border-slate-100' : ''}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
                      <span className="material-icons-round text-[20px]">{icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-slate-800 font-bold text-sm font-['Inter']">{log.aksi}</span>
                        <span className="text-slate-400 text-xs font-['Public_Sans']">oleh {log.user_email || 'Sistem'}</span>
                      </div>
                      <div className="text-slate-600 text-sm font-['Public_Sans']">{log.keterangan}</div>
                    </div>
                    <div className="text-slate-400 text-xs font-['Public_Sans'] shrink-0 text-right">
                      {formatDate(log.created_at)}<br />
                      <span className="text-[10px]">{new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>

      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />
    </div>
  );
}
