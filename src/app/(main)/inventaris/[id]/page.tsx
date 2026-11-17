'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';
import QRCodeModal from '@/components/ui/QRCodeModal';

function fotoUrlToProxy(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const key = new URL(url).pathname.slice(1);
    if (!key.startsWith('inventaris/')) return null;
    return `/api/inventaris/image?key=${encodeURIComponent(key)}`;
  } catch {
    return null;
  }
}

function formatDateIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default function DetailBarangPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'spec' | 'moves' | 'loans' | 'opname'>('spec');

  // Move & Loan & Opname states
  const [mutasiList, setMutasiList] = useState<any[]>([]);
  const [peminjamanList, setPeminjamanList] = useState<any[]>([]);
  const [opnameList, setOpnameList] = useState<any[]>([]);

  // Global overlay feedback
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });
  const [alertState, setAlertState] = useState<{ isOpen: boolean }>({ isOpen: false });

  // Photo lightbox
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // QR Code modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Tambah Unit Serupa modal
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [addUnitForm, setAddUnitForm] = useState({
    no_seri: '',
    kondisi: 'Baik',
    lokasi_satelit_id: '',
    lokasi_sublokasi_id: '',
  });
  const [addUnitState, setAddUnitState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });

  // Modal Pindahkan Ruangan
  const [showMutasiModal, setShowMutasiModal] = useState(false);
  const [mutasiForm, setMutasiForm] = useState({
    ke_satelit_id: '',
    ke_sublokasi_id: '',
    tanggal_mutasi: new Date().toISOString().split('T')[0],
    alasan: '',
  });
  const [mutasiSublokasiOptions, setMutasiSublokasiOptions] = useState<any[]>([]);
  const [mutasiLoading, setMutasiLoading] = useState(false);

  // Modal Catat Peminjaman
  const [showPinjamModal, setShowPinjamModal] = useState(false);
  const [pinjamForm, setPinjamForm] = useState({
    peminjam_tipe: 'Jemaat' as 'Jemaat' | 'Lain-lain' | 'Satelit',
    peminjam_satelit_id: '',
    peminjam_jemaat_id: '',
    peminjam_nama_lain: '',
    tanggal_pinjam: new Date().toISOString().split('T')[0],
    tanggal_rencana_kembali: '',
    catatan: '',
  });
  const [pinjamLoading, setPinjamLoading] = useState(false);
  const [jemaatSearchQuery, setJemaatSearchQuery] = useState('');
  const [jemaatSearchResults, setJemaatSearchResults] = useState<any[]>([]);
  const [selectedJemaatName, setSelectedJemaatName] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Modal Konfirmasi Pengembalian
  const [showKembaliModal, setShowKembaliModal] = useState(false);
  const [selectedPeminjamanId, setSelectedPeminjamanId] = useState<number | null>(null);
  const [catatanKembali, setCatatanKembali] = useState('');
  const [kembaliLoading, setKembaliLoading] = useState(false);

  // Shared Satelit Options
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [sublokasiOptions, setSublokasiOptions] = useState<any[]>([]);

  // Load satelit options
  useEffect(() => {
    fetch('/api/options?type=satelit')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSatelitOptions(d.data);
      })
      .catch(() => {});
  }, []);

  // Sublokasi for Add Unit
  useEffect(() => {
    if (!addUnitForm.lokasi_satelit_id) {
      setSublokasiOptions([]);
      return;
    }
    fetch(`/api/inventaris/master?type=sublokasi&satelit_id=${addUnitForm.lokasi_satelit_id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSublokasiOptions(d.data);
      })
      .catch(() => {});
  }, [addUnitForm.lokasi_satelit_id]);

  // Sublokasi for Mutasi Modal
  useEffect(() => {
    if (!mutasiForm.ke_satelit_id) {
      setMutasiSublokasiOptions([]);
      return;
    }
    fetch(`/api/inventaris/master?type=sublokasi&satelit_id=${mutasiForm.ke_satelit_id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMutasiSublokasiOptions(d.data);
      })
      .catch(() => {});
  }, [mutasiForm.ke_satelit_id]);

  // Jemaat Autocomplete for Peminjaman Modal
  useEffect(() => {
    if (pinjamForm.peminjam_tipe !== 'Jemaat') return;
    if (!jemaatSearchQuery || jemaatSearchQuery.length < 2) {
      setJemaatSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/options?type=jemaat_search&q=${encodeURIComponent(jemaatSearchQuery)}&only_active=true`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setJemaatSearchResults(json.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [jemaatSearchQuery, pinjamForm.peminjam_tipe]);

  // Load Main Data & Histories
  const refreshAllData = async () => {
    try {
      const [resBarang, resUser, resMutasi, resPinjam, resOpname] = await Promise.all([
        fetch(`/api/inventaris/${id}`),
        fetch('/api/auth/me'),
        fetch(`/api/inventaris/${id}/mutasi`),
        fetch(`/api/inventaris/${id}/peminjaman`),
        fetch(`/api/inventaris/${id}/opname-history`),
      ]);

      const barangData = await resBarang.json();
      const authData = resUser.ok ? await resUser.json() : null;
      const mutasiData = resMutasi.ok ? await resMutasi.json() : null;
      const pinjamData = resPinjam.ok ? await resPinjam.json() : null;
      const opnameData = resOpname.ok ? await resOpname.json() : null;

      if (barangData.success) setData(barangData.data);
      if (authData) setUserData(authData);
      if (mutasiData?.success) setMutasiList(mutasiData.data || []);
      if (pinjamData?.success) setPeminjamanList(pinjamData.data || []);
      if (opnameData?.success) setOpnameList(opnameData.data || []);
    } catch (error) {
      console.error('Failed to fetch barang and history', error);
    }
  };

  useEffect(() => {
    showLoader();
    refreshAllData().finally(() => hideLoader());
  }, [id]);

  // Permission helper
  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  // Mutasi Handler
  const handleOpenMutasiModal = () => {
    if (!data) return;
    setMutasiForm({
      ke_satelit_id: data.lokasi_satelit_id ? data.lokasi_satelit_id.toString() : '',
      ke_sublokasi_id: '',
      tanggal_mutasi: new Date().toISOString().split('T')[0],
      alasan: '',
    });
    setShowMutasiModal(true);
  };

  const handleSubmitMutasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mutasiForm.ke_satelit_id) return;

    setMutasiLoading(true);
    try {
      const res = await fetch(`/api/inventaris/${id}/mutasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mutasiForm),
      });
      const result = await res.json();
      if (result.success) {
        setShowMutasiModal(false);
        setSubmitState({ status: 'success', message: 'Lokasi ruangan berhasil dipindahkan!' });
        await refreshAllData();
        setActiveTab('moves');
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 1500);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal memindahkan ruangan' });
      }
    } catch (err: any) {
      setSubmitState({ status: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setMutasiLoading(false);
    }
  };

  // Peminjaman Handler
  const handleOpenPinjamModal = () => {
    if (!data) return;
    setPinjamForm({
      peminjam_tipe: 'Jemaat',
      peminjam_satelit_id: '',
      peminjam_jemaat_id: '',
      peminjam_nama_lain: '',
      tanggal_pinjam: new Date().toISOString().split('T')[0],
      tanggal_rencana_kembali: '',
      catatan: '',
    });
    setSelectedJemaatName('');
    setJemaatSearchQuery('');
    setJemaatSearchResults([]);
    setShowPinjamModal(true);
  };

  const handleSubmitPinjam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinjamForm.peminjam_tipe === 'Jemaat' && !pinjamForm.peminjam_jemaat_id) {
      alert('Pilih jemaat yang meminjam');
      return;
    }
    if (pinjamForm.peminjam_tipe === 'Lain-lain' && !pinjamForm.peminjam_nama_lain.trim()) {
      alert('Isi nama peminjam');
      return;
    }

    setPinjamLoading(true);
    try {
      const res = await fetch(`/api/inventaris/${id}/peminjaman`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pinjamForm),
      });
      const result = await res.json();
      if (result.success) {
        setShowPinjamModal(false);
        setSubmitState({ status: 'success', message: 'Peminjaman barang berhasil dicatat!' });
        await refreshAllData();
        setActiveTab('loans');
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 1500);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal mencatat peminjaman' });
      }
    } catch (err: any) {
      setSubmitState({ status: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setPinjamLoading(false);
    }
  };

  // Pengembalian Handler
  const handleOpenKembaliModal = (peminjamanId: number) => {
    setSelectedPeminjamanId(peminjamanId);
    setCatatanKembali('');
    setShowKembaliModal(true);
  };

  const handleSubmitKembali = async () => {
    if (!selectedPeminjamanId) return;
    setKembaliLoading(true);
    try {
      const res = await fetch(`/api/inventaris/${id}/peminjaman/kembali`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peminjaman_id: selectedPeminjamanId,
          catatan_kembali: catatanKembali,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowKembaliModal(false);
        setSubmitState({ status: 'success', message: 'Barang berhasil dikembalikan ke inventaris!' });
        await refreshAllData();
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 1500);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal memproses pengembalian' });
      }
    } catch (err: any) {
      setSubmitState({ status: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setKembaliLoading(false);
    }
  };

  // Add Unit Handler
  const handleAddUnit = async () => {
    if (!data) return;
    setAddUnitState({ status: 'loading', message: '' });
    try {
      const payload = {
        tipe_barang: 'satuan',
        nama: data.nama,
        kategori_id: data.kategori_id,
        merk: data.merk || '',
        no_seri: addUnitForm.no_seri,
        jumlah: '1',
        kondisi: addUnitForm.kondisi,
        tahun_perolehan: data.tahun_perolehan || '',
        nilai_perolehan: data.nilai_perolehan || '',
        pemilik_tipe: data.pemilik_satelit_id ? 'satelit' : 'individu',
        pemilik_satelit_id: data.pemilik_satelit_id?.toString() || '',
        pemilik_nama_lain: data.pemilik_nama_lain || '',
        lokasi_satelit_id: addUnitForm.lokasi_satelit_id,
        lokasi_sublokasi_id: addUnitForm.lokasi_sublokasi_id,
        foto_url: '',
      };
      const res = await fetch('/api/inventaris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        setAddUnitState({ status: 'success', message: `Unit baru (${result.data?.kode_barang || 'baru'}) berhasil ditambahkan` });
        setAddUnitForm({
          no_seri: '',
          kondisi: 'Baik',
          lokasi_satelit_id: data.lokasi_satelit_id?.toString() || '',
          lokasi_sublokasi_id: data.lokasi_sublokasi_id?.toString() || '',
        });
        setTimeout(() => {
          setShowAddUnit(false);
          setAddUnitState({ status: 'idle', message: '' });
        }, 1500);
      } else {
        setAddUnitState({ status: 'error', message: result.message || 'Gagal menambahkan unit' });
      }
    } catch (err: any) {
      setAddUnitState({ status: 'error', message: err.message || 'Koneksi error' });
    }
  };

  // Delete Handler
  const handleDelete = async () => {
    setAlertState({ isOpen: false });
    try {
      setSubmitState({ status: 'loading', message: '' });
      const res = await fetch(`/api/inventaris/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Barang berhasil dihapus' });
        setTimeout(() => router.push('/inventaris'), 1500);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal menghapus barang' });
      }
    } catch (error) {
      console.error(error);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi.' });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  if (!data) return null;

  const proxyFoto = fotoUrlToProxy(data.foto_url);
  const isDipinjam = data.status === 'Dipinjam';

  return (
    <div className="w-full flex flex-col gap-6 pb-14">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />

      <AlertModal
        isOpen={alertState.isOpen}
        title="Hapus Barang"
        message={`Apakah Anda yakin ingin menghapus barang "${data.nama}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus Permanen"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => setAlertState({ isOpen: false })}
      />

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/inventaris" className="hover:text-indigo-600 transition-colors">
          Inventaris
        </Link>
        <span className="material-icons-round text-[14px] text-slate-400">chevron_right</span>
        <span>{data.nama_kategori || 'Kategori'}</span>
        <span className="material-icons-round text-[14px] text-slate-400">chevron_right</span>
        <span className="text-slate-800 font-semibold truncate max-w-xs">{data.nama}</span>
      </div>

      {/* Main ERP Sheet Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Header & Smart Stat Buttons (Odoo-Inspired) */}
        <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 bg-gradient-to-b from-slate-50/60 to-white">
          {/* Title, Kode, & Badges */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-mono font-bold rounded-md border border-slate-200">
                {data.kode_barang}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isDipinjam
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : data.status === 'Tersedia'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                ● {data.status}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  data.kondisi === 'Baik'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : data.kondisi === 'Rusak Ringan'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {data.kondisi}
              </span>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
                {data.tipe_barang === 'satuan' ? '🏷️ Aset Satuan' : '📦 Stok Massal'}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{data.nama}</h1>
            <p className="text-sm text-slate-500 font-medium">
              {data.merk ? `${data.merk} • ` : ''}
              {data.nama_kategori}
              {data.no_seri ? ` (SN: ${data.no_seri})` : ''}
            </p>
          </div>

          {/* Smart Stat Pills (Header Kanan Atas) */}
          <div className="flex items-center gap-2 flex-wrap self-start">
            {/* Stat: Lokasi Saat Ini */}
            <div className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2.5 transition-colors shadow-sm cursor-default">
              <span className="material-icons-round text-indigo-600 text-[20px]">room</span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">Ruangan Sekarang</span>
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  {data.lokasi_nama_sublokasi || data.lokasi_nama_satelit || 'Belum diatur'}
                </span>
              </div>
            </div>

            {/* Stat: Perpindahan Lokasi */}
            <button
              onClick={() => setActiveTab('moves')}
              className={`px-3.5 py-2 border rounded-xl flex items-center gap-2.5 transition-all shadow-sm ${
                activeTab === 'moves'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <span className={`material-icons-round text-[20px] ${activeTab === 'moves' ? 'text-white' : 'text-indigo-600'}`}>
                local_shipping
              </span>
              <div className="flex flex-col text-left">
                <span className={`text-[10px] uppercase font-bold leading-none ${activeTab === 'moves' ? 'text-indigo-200' : 'text-slate-400'}`}>
                  Riwayat Mutasi
                </span>
                <span className="text-xs font-bold leading-tight">{mutasiList.length} Moves</span>
              </div>
            </button>

            {/* Stat: Peminjaman */}
            <button
              onClick={() => setActiveTab('loans')}
              className={`px-3.5 py-2 border rounded-xl flex items-center gap-2.5 transition-all shadow-sm ${
                activeTab === 'loans'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-amber-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <span className={`material-icons-round text-[20px] ${activeTab === 'loans' ? 'text-white' : 'text-amber-600'}`}>
                handshake
              </span>
              <div className="flex flex-col text-left">
                <span className={`text-[10px] uppercase font-bold leading-none ${activeTab === 'loans' ? 'text-amber-200' : 'text-slate-400'}`}>
                  Riwayat Pinjam
                </span>
                <span className="text-xs font-bold leading-tight">{peminjamanList.length} Loans</span>
              </div>
            </button>

            {/* Stat: Opname */}
            <button
              onClick={() => setActiveTab('opname')}
              className={`px-3.5 py-2 border rounded-xl flex items-center gap-2.5 transition-all shadow-sm ${
                activeTab === 'opname'
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sky-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <span className={`material-icons-round text-[20px] ${activeTab === 'opname' ? 'text-white' : 'text-sky-600'}`}>
                fact_check
              </span>
              <div className="flex flex-col text-left">
                <span className={`text-[10px] uppercase font-bold leading-none ${activeTab === 'opname' ? 'text-sky-200' : 'text-slate-400'}`}>
                  Stok Opname
                </span>
                <span className="text-xs font-bold leading-tight">{opnameList.length} Audit</span>
              </div>
            </button>
          </div>
        </div>

        {/* Operations Action Bar */}
        <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          {/* Quick Primary Operations */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasPermission('inventaris_manage') && (
              <>
                <button
                  onClick={handleOpenMutasiModal}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
                >
                  <span className="material-icons-round text-[18px]">drive_file_move</span>
                  Pindahkan Ruangan
                </button>

                <button
                  onClick={handleOpenPinjamModal}
                  disabled={isDipinjam}
                  title={isDipinjam ? 'Barang sedang dipinjam' : 'Catat peminjaman barang'}
                  className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-sm ${
                    isDipinjam
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                  }`}
                >
                  <span className="material-icons-round text-[18px]">handshake</span>
                  {isDipinjam ? 'Sedang Dipinjam' : 'Catat Peminjaman'}
                </button>
              </>
            )}

            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <span className="material-icons-round text-slate-500 text-[18px]">qr_code_2</span>
              QR Code
            </button>
          </div>

          {/* Secondary / Edit / Delete Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasPermission('inventaris_manage') && (
              <>
                <Link
                  href={`/inventaris/${id}/edit`}
                  className="px-3.5 py-2 bg-white border border-slate-200 text-blue-600 text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-blue-50 hover:border-blue-200 transition-colors shadow-sm"
                >
                  <span className="material-icons-round text-[18px]">edit</span>
                  Edit
                </Link>

                {data?.tipe_barang === 'satuan' && (
                  <button
                    onClick={() => setShowAddUnit(true)}
                    className="px-3.5 py-2 bg-white border border-slate-200 text-indigo-600 text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm"
                  >
                    <span className="material-icons-round text-[18px]">add_circle_outline</span>
                    Tambah Unit Serupa
                  </button>
                )}

                <button
                  onClick={() => setAlertState({ isOpen: true })}
                  className="px-3 py-2 bg-white border border-slate-200 text-red-600 text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm"
                >
                  <span className="material-icons-round text-[18px]">delete_outline</span>
                  Hapus
                </button>
              </>
            )}

            <Link
              href="/inventaris"
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <span className="material-icons-round text-[18px] text-slate-400">arrow_back</span>
              Daftar
            </Link>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-6 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('spec')}
            className={`py-3.5 border-b-2 text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'spec'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <span className="material-icons-round text-[18px]">tune</span>
            Spesifikasi & Kepemilikan
          </button>

          <button
            onClick={() => setActiveTab('moves')}
            className={`py-3.5 border-b-2 text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'moves'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <span className="material-icons-round text-[18px]">local_shipping</span>
            Riwayat Perpindahan Lokasi
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
              {mutasiList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('loans')}
            className={`py-3.5 border-b-2 text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'loans'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <span className="material-icons-round text-[18px]">handshake</span>
            Riwayat Peminjaman
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
              {peminjamanList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('opname')}
            className={`py-3.5 border-b-2 text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'opname'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <span className="material-icons-round text-[18px]">fact_check</span>
            Riwayat Stok Opname Fisik
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
              {opnameList.length}
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6">
          {/* TAB 1: SPESIFIKASI & KEPEMILIKAN */}
          {activeTab === 'spec' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box Spesifikasi Teknis */}
              <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                  <span className="material-icons-round text-slate-500 text-[20px]">info</span>
                  <h3 className="font-bold text-slate-800 text-sm">Spesifikasi Teknis</h3>
                </div>
                <InfoRow label="Kode Barang" value={data.kode_barang} />
                <InfoRow label="Nama Barang" value={data.nama} />
                <InfoRow label="Kategori" value={data.nama_kategori} />
                <InfoRow label="Merk" value={data.merk || '-'} />
                <InfoRow label="Nomor Seri (SN)" value={data.no_seri || '-'} />
                <InfoRow label="Jumlah Unit" value={`${data.jumlah ?? 1} unit`} />
                <InfoRow label="Kondisi Fisik" value={data.kondisi} />
                <InfoRow label="Status Barang" value={data.status} />
                <InfoRow label="Deskripsi / Catatan" value={data.deskripsi || '-'} />
              </div>

              {/* Box Keuangan, Lokasi & Foto */}
              <div className="flex flex-col gap-6">
                <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                    <span className="material-icons-round text-slate-500 text-[20px]">account_balance_wallet</span>
                    <h3 className="font-bold text-slate-800 text-sm">Finansial & Lokasi</h3>
                  </div>
                  <InfoRow label="Tahun Perolehan" value={data.tahun_perolehan?.toString() || '-'} />
                  <InfoRow label="Nilai Perolehan" value={formatCurrency(data.nilai_perolehan || 0)} />
                  <InfoRow label="Aktiva Tetap" value={data.is_aktiva_tetap ? 'Ya (Aset Tetap Gereja)' : 'Bukan Aktiva Tetap'} />
                  <InfoRow label="Tipe Kepemilikan" value={data.pemilik_tipe === 'satelit' ? 'Satelit Gereja' : 'Individu / Donatur'} />
                  <InfoRow label="Pemilik / Donatur" value={data.pemilik_nama || '-'} />
                  <InfoRow label="Lokasi Satelit" value={data.lokasi_nama_satelit || '-'} />
                  <InfoRow label="Sub-Lokasi / Ruangan" value={data.lokasi_nama_sublokasi || 'Belum Ditentukan'} />
                </div>

                {/* Foto Preview Box */}
                {proxyFoto && (
                  <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-round text-slate-500 text-[20px]">photo_camera</span>
                        <h3 className="font-bold text-slate-800 text-sm">Foto Fisik Barang</h3>
                      </div>
                      <span className="text-[11px] text-slate-400">Klik untuk perbesar</span>
                    </div>
                    <div className="relative group cursor-pointer max-w-sm" onClick={() => setIsPhotoModalOpen(true)}>
                      <img
                        src={proxyFoto}
                        alt={data.nama}
                        className="rounded-lg border border-slate-200 object-cover w-full h-48 hover:opacity-95 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-[1px]">
                        <span className="material-icons-round text-[18px]">zoom_in</span>
                        Lihat Foto Penuh
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RIWAYAT PERPINDAHAN RUANGAN (ODINI-STYLE MOVE HISTORY) */}
          {activeTab === 'moves' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Riwayat Perpindahan Ruangan (Traceability Log)</h3>
                  <p className="text-xs text-slate-500">
                    Catatan historis perpindahan fisik barang antar satelit dan antar sub-lokasi/ruangan.
                  </p>
                </div>
                {hasPermission('inventaris_manage') && (
                  <button
                    onClick={handleOpenMutasiModal}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <span className="material-icons-round text-[16px]">add</span>
                    Pindahkan Ruangan Baru
                  </button>
                )}
              </div>

              {mutasiList.length === 0 ? (
                <div className="py-12 px-4 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center bg-slate-50/50">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                    <span className="material-icons-round text-[26px]">local_shipping</span>
                  </div>
                  <h4 className="font-bold text-slate-700 text-sm">Belum Ada Riwayat Perpindahan</h4>
                  <p className="text-xs text-slate-400 max-w-md mt-1">
                    Barang ini belum pernah dipindahkan lokasinya. Gunakan tombol &quot;Pindahkan Ruangan&quot; ketika barang dipindahkan ke ruangan atau satelit lain.
                  </p>
                  {hasPermission('inventaris_manage') && (
                    <button
                      onClick={handleOpenMutasiModal}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <span className="material-icons-round text-[16px]">drive_file_move</span>
                      Pindahkan Ruangan Sekarang
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                        <th className="py-3 px-4">Tanggal Mutasi</th>
                        <th className="py-3 px-4">Dari Lokasi</th>
                        <th className="py-3 px-4">Ke Lokasi</th>
                        <th className="py-3 px-4">Alasan / Acara</th>
                        <th className="py-3 px-4">Dicatat Oleh</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {mutasiList.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                            {formatDateIndo(m.tanggal_mutasi)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">
                                {m.nama_ruangan_asal || 'Ruangan Belum Diatur'}
                              </span>
                              <span className="text-[10px] text-slate-400">{m.nama_satelit_asal || 'Satelit Utama'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-indigo-700">
                              <span className="material-icons-round text-[14px]">arrow_forward</span>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">
                                  {m.nama_ruangan_tujuan || 'Tanpa Ruangan'}
                                </span>
                                <span className="text-[10px] text-indigo-500">{m.nama_satelit_tujuan || 'Satelit Utama'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700 max-w-xs">{m.alasan || '-'}</td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{m.dicatat_oleh_nama || 'Petugas'}</td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {m.status || 'Selesai'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RIWAYAT PEMINJAMAN (LOAN TRACKER) */}
          {activeTab === 'loans' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Riwayat Peminjaman Barang</h3>
                  <p className="text-xs text-slate-500">
                    Daftar peminjaman barang oleh jemaat, satelit lain, atau pihak eksternal, lengkap dengan status pengembalian.
                  </p>
                </div>
                {hasPermission('inventaris_manage') && !isDipinjam && (
                  <button
                    onClick={handleOpenPinjamModal}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <span className="material-icons-round text-[16px]">add</span>
                    Catat Peminjaman Baru
                  </button>
                )}
              </div>

              {peminjamanList.length === 0 ? (
                <div className="py-12 px-4 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center bg-slate-50/50">
                  <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                    <span className="material-icons-round text-[26px]">handshake</span>
                  </div>
                  <h4 className="font-bold text-slate-700 text-sm">Belum Ada Riwayat Peminjaman</h4>
                  <p className="text-xs text-slate-400 max-w-md mt-1">
                    Barang ini belum pernah dicatat dalam log peminjaman. Klik tombol &quot;Catat Peminjaman&quot; jika ada jemaat atau satelit yang meminjam barang ini.
                  </p>
                  {hasPermission('inventaris_manage') && !isDipinjam && (
                    <button
                      onClick={handleOpenPinjamModal}
                      className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <span className="material-icons-round text-[16px]">handshake</span>
                      Catat Peminjaman Sekarang
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Peminjam</th>
                        <th className="py-3 px-4">Tgl Pinjam</th>
                        <th className="py-3 px-4">Target Kembali</th>
                        <th className="py-3 px-4">Kembali Aktual</th>
                        <th className="py-3 px-4">Catatan</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {peminjamanList.map((p) => {
                        const isCurrentlyBorrowed = p.status === 'Dipinjam';
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  isCurrentlyBorrowed
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{p.peminjam_nama}</span>
                                <span className="text-[10px] text-slate-400">Tipe: {p.peminjam_tipe}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                              {formatDateIndo(p.tanggal_pinjam)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                              {formatDateIndo(p.tanggal_rencana_kembali)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                              {formatDateIndo(p.tanggal_kembali_aktual)}
                            </td>
                            <td className="py-3 px-4 text-slate-600 max-w-xs">{p.catatan || '-'}</td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {isCurrentlyBorrowed && hasPermission('inventaris_manage') ? (
                                <button
                                  onClick={() => handleOpenKembaliModal(p.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-sm transition-colors text-[11px] flex items-center gap-1 mx-auto"
                                >
                                  <span className="material-icons-round text-[14px]">assignment_return</span>
                                  Kembalikan
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RIWAYAT STOK OPNAME FISIK */}
          {activeTab === 'opname' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Riwayat Audit Fisik (Stok Opname)</h3>
                  <p className="text-xs text-slate-500">
                    Hasil pemeriksaan fisik barang dari seluruh sesi stok opname inventaris yang pernah diadakan.
                  </p>
                </div>
              </div>

              {opnameList.length === 0 ? (
                <div className="py-12 px-4 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center bg-slate-50/50">
                  <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
                    <span className="material-icons-round text-[26px]">fact_check</span>
                  </div>
                  <h4 className="font-bold text-slate-700 text-sm">Belum Ada Data Stok Opname</h4>
                  <p className="text-xs text-slate-400 max-w-md mt-1">
                    Barang ini belum pernah tercatat dalam sesi audit stok opname yang diverifikasi.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                        <th className="py-3 px-4">Sesi Stok Opname</th>
                        <th className="py-3 px-4">Tanggal Audit</th>
                        <th className="py-3 px-4 text-center">Tercatat vs Fisik</th>
                        <th className="py-3 px-4 text-center">Selisih</th>
                        <th className="py-3 px-4">Kondisi Fisik Saat Audit</th>
                        <th className="py-3 px-4">Keterangan / Temuan</th>
                        <th className="py-3 px-4">Pemeriksa (Checker)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {opnameList.map((op) => (
                        <tr key={op.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{op.judul_opname}</span>
                              <span className="text-[10px] text-slate-400">Status: {op.status_opname}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                            {formatDateIndo(op.tanggal_opname)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono whitespace-nowrap">
                            <span className="font-semibold text-slate-700">{op.jumlah_tercatat}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="font-bold text-slate-900">{op.jumlah_fisik ?? '-'}</span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap font-mono">
                            {op.selisih === null || op.selisih === undefined ? (
                              <span className="text-slate-400">-</span>
                            ) : op.selisih === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                                Cocok (0)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700">
                                {op.selisih > 0 ? `+${op.selisih}` : op.selisih}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                            {op.kondisi_fisik || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs">{op.keterangan || '-'}</td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{op.checked_by_nama || 'Petugas'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: PINDAHKAN RUANGAN (MUTASI) */}
      {showMutasiModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <span className="material-icons-round text-[20px]">drive_file_move</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Pindahkan Ruangan</h3>
                  <p className="text-xs text-slate-500">Mutasi fisik lokasi barang dalam inventaris</p>
                </div>
              </div>
              <button
                onClick={() => setShowMutasiModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitMutasi} className="p-6 flex flex-col gap-4">
              {/* Highlight Ruangan Asal */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-1 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Lokasi Ruangan Saat Ini:</span>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <span className="material-icons-round text-slate-500 text-[16px]">room</span>
                  <span>{data.lokasi_nama_satelit || 'Satelit Belum Diatur'}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-indigo-600">{data.lokasi_nama_sublokasi || 'Belum Ada Ruangan'}</span>
                </div>
              </div>

              {/* Satelit Tujuan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Satelit Tujuan <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={mutasiForm.ke_satelit_id}
                  onChange={(e) => setMutasiForm((prev) => ({ ...prev, ke_satelit_id: e.target.value, ke_sublokasi_id: '' }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Pilih Satelit Tujuan --</option>
                  {satelitOptions.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.nama_satelit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ruangan/Sublokasi Tujuan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Sub-Lokasi / Ruangan Tujuan</label>
                <select
                  value={mutasiForm.ke_sublokasi_id}
                  onChange={(e) => setMutasiForm((prev) => ({ ...prev, ke_sublokasi_id: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Pilih Ruangan (Opsional) --</option>
                  {mutasiSublokasiOptions.map((sub: any) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal Mutasi */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Tanggal Mutasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={mutasiForm.tanggal_mutasi}
                  onChange={(e) => setMutasiForm((prev) => ({ ...prev, tanggal_mutasi: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Alasan / Acara */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Alasan Perpindahan / Acara
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Dipindahkan ke Ruang Ibadah Anak untuk kebaktian sekolah minggu"
                  value={mutasiForm.alasan}
                  onChange={(e) => setMutasiForm((prev) => ({ ...prev, alasan: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMutasiModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={mutasiLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {mutasiLoading ? (
                    <span className="material-icons-round animate-spin text-[16px]">sync</span>
                  ) : (
                    <span className="material-icons-round text-[16px]">check</span>
                  )}
                  Simpan Perpindahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CATAT PEMINJAMAN */}
      {showPinjamModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <span className="material-icons-round text-[20px]">handshake</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Catat Peminjaman Barang</h3>
                  <p className="text-xs text-slate-500">Pencatatan peminjam, tanggal, dan rencana pengembalian</p>
                </div>
              </div>
              <button
                onClick={() => setShowPinjamModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitPinjam} className="p-6 flex flex-col gap-4">
              {/* Tipe Peminjam */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Tipe Peminjam</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Jemaat', 'Lain-lain', 'Satelit'] as const).map((tipe) => (
                    <button
                      type="button"
                      key={tipe}
                      onClick={() => {
                        setPinjamForm((prev) => ({
                          ...prev,
                          peminjam_tipe: tipe,
                          peminjam_jemaat_id: '',
                          peminjam_nama_lain: '',
                          peminjam_satelit_id: '',
                        }));
                        setSelectedJemaatName('');
                        setJemaatSearchQuery('');
                      }}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        pinjamForm.peminjam_tipe === tipe
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {tipe}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Input Sesuai Tipe */}
              {pinjamForm.peminjam_tipe === 'Jemaat' && (
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-xs font-bold text-slate-700">
                    Cari Nama Jemaat <span className="text-rose-500">*</span>
                  </label>
                  {selectedJemaatName ? (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                      <span className="font-bold text-emerald-800">{selectedJemaatName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJemaatName('');
                          setPinjamForm((prev) => ({ ...prev, peminjam_jemaat_id: '' }));
                        }}
                        className="text-emerald-600 hover:text-emerald-800 font-bold"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Ketik minimal 2 huruf nama jemaat..."
                        value={jemaatSearchQuery}
                        onChange={(e) => setJemaatSearchQuery(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      {jemaatSearchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-10 divide-y divide-slate-100">
                          {jemaatSearchResults.map((j) => (
                            <button
                              type="button"
                              key={j.id}
                              onClick={() => {
                                setPinjamForm((prev) => ({ ...prev, peminjam_jemaat_id: j.id.toString() }));
                                setSelectedJemaatName(j.nama_lengkap);
                                setJemaatSearchQuery('');
                                setJemaatSearchResults([]);
                              }}
                              className="w-full text-left p-2.5 hover:bg-slate-50 text-xs flex justify-between items-center"
                            >
                              <span className="font-bold text-slate-800">{j.nama_lengkap}</span>
                              <span className="text-[10px] text-slate-400">{j.no_telp || j.kode_jemaat || ''}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {pinjamForm.peminjam_tipe === 'Lain-lain' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Nama Peminjam / Pihak Luar <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bpk. Hendra (Vendor Sound)"
                    value={pinjamForm.peminjam_nama_lain}
                    onChange={(e) => setPinjamForm((prev) => ({ ...prev, peminjam_nama_lain: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {pinjamForm.peminjam_tipe === 'Satelit' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Satelit Peminjam <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={pinjamForm.peminjam_satelit_id}
                    onChange={(e) => setPinjamForm((prev) => ({ ...prev, peminjam_satelit_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih Satelit Peminjam --</option>
                    {satelitOptions.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.nama_satelit}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tanggal Pinjam & Tanggal Rencana Kembali */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Tanggal Pinjam <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={pinjamForm.tanggal_pinjam}
                    onChange={(e) => setPinjamForm((prev) => ({ ...prev, tanggal_pinjam: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Rencana Kembali</label>
                  <input
                    type="date"
                    value={pinjamForm.tanggal_rencana_kembali}
                    onChange={(e) => setPinjamForm((prev) => ({ ...prev, tanggal_rencana_kembali: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Catatan / Keperluan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Catatan / Keperluan</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Dipinjam untuk retreat komisi pemuda di Batu"
                  value={pinjamForm.catatan}
                  onChange={(e) => setPinjamForm((prev) => ({ ...prev, catatan: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinjamModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pinjamLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {pinjamLoading ? (
                    <span className="material-icons-round animate-spin text-[16px]">sync</span>
                  ) : (
                    <span className="material-icons-round text-[16px]">check</span>
                  )}
                  Catat Peminjaman
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PENGEMBALIAN BARANG */}
      {showKembaliModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <span className="material-icons-round text-[20px]">assignment_return</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">Konfirmasi Pengembalian</h3>
              </div>
              <button
                onClick={() => setShowKembaliModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Konfirmasi bahwa barang <strong>{data.nama}</strong> telah dikembalikan ke inventaris gereja hari ini. Status barang akan otomatis dipulihkan menjadi <strong>Tersedia</strong>.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Catatan Pengembalian (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Dikembalikan dalam kondisi lengkap dan bersih"
                  value={catatanKembali}
                  onChange={(e) => setCatatanKembali(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowKembaliModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmitKembali}
                  disabled={kembaliLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {kembaliLoading ? (
                    <span className="material-icons-round animate-spin text-[16px]">sync</span>
                  ) : (
                    <span className="material-icons-round text-[16px]">check_circle</span>
                  )}
                  Ya, Kembalikan Barang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal (Preserved) */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title={data.nama}
        qrValue={data.kode_barang}
        subtitle={data.nama_kategori}
        defaultCopies={data.tipe_barang === 'massal' ? data.jumlah ?? 1 : 1}
        defaultTab={data.tipe_barang === 'massal' ? 'pdf' : 'png'}
      />

      {/* Photo Preview Modal (Preserved) */}
      {isPhotoModalOpen && proxyFoto && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setIsPhotoModalOpen(false)}
        >
          <div className="relative max-w-3xl w-full p-2 flex flex-col items-center">
            <button
              className="absolute -top-12 right-0 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex justify-center items-center text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsPhotoModalOpen(false);
              }}
            >
              <span className="material-icons-round">close</span>
            </button>
            <img
              src={proxyFoto}
              alt={data.nama}
              className="max-h-[85vh] w-auto object-contain rounded-xl shadow-2xl border border-white/20 bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Tambah Unit Serupa Modal (Preserved) */}
      {showAddUnit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Tambah Unit Serupa</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Data dari: <strong>{data?.nama}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddUnit(false);
                  setAddUnitState({ status: 'idle', message: '' });
                }}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <span className="material-icons-round text-slate-500">close</span>
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-500 flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>Nama</span>
                  <span className="font-semibold text-slate-700">{data?.nama}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kategori</span>
                  <span className="font-semibold text-slate-700">{data?.nama_kategori}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">No. Seri Unit Baru</label>
                <input
                  type="text"
                  value={addUnitForm.no_seri}
                  onChange={(e) => setAddUnitForm((prev) => ({ ...prev, no_seri: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Contoh: C02ABC123DEF"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Kondisi</label>
                <select
                  value={addUnitForm.kondisi}
                  onChange={(e) => setAddUnitForm((prev) => ({ ...prev, kondisi: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="Baik">Baik</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                  <option value="Rusak Berat">Rusak Berat</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Lokasi Satelit</label>
                <select
                  value={addUnitForm.lokasi_satelit_id}
                  onChange={(e) =>
                    setAddUnitForm((prev) => ({ ...prev, lokasi_satelit_id: e.target.value, lokasi_sublokasi_id: '' }))
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">-- Pilih Satelit --</option>
                  {satelitOptions.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.nama_satelit}
                    </option>
                  ))}
                </select>
              </div>

              {addUnitForm.lokasi_satelit_id && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Sub-Lokasi / Ruangan</label>
                  <select
                    value={addUnitForm.lokasi_sublokasi_id}
                    onChange={(e) => setAddUnitForm((prev) => ({ ...prev, lokasi_sublokasi_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">-- Pilih Ruangan (opsional) --</option>
                    {sublokasiOptions.map((sub: any) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.nama}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {addUnitState.status === 'error' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  <span className="material-icons-round text-[16px]">error</span>
                  {addUnitState.message}
                </div>
              )}
              {addUnitState.status === 'success' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <span className="material-icons-round text-[16px]">check_circle</span>
                  {addUnitState.message}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddUnit(false);
                  setAddUnitState({ status: 'idle', message: '' });
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleAddUnit}
                disabled={addUnitState.status === 'loading' || addUnitState.status === 'success'}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {addUnitState.status === 'loading' ? (
                  <span className="material-icons-round animate-spin text-[16px]">sync</span>
                ) : (
                  <span className="material-icons-round text-[16px]">add_circle</span>
                )}
                Tambah Unit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0 text-xs">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className="text-slate-800 font-semibold text-right max-w-[65%]">{value}</span>
    </div>
  );
}
