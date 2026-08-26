'use client';

import { useState, useEffect, use } from 'react';
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
  } catch { return null; }
}

export default function DetailBarangPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });
  const [alertState, setAlertState] = useState<{ isOpen: boolean }>({ isOpen: false });
  const [userData, setUserData] = useState<any>(null);

  // Photo lightbox (persis jemaat)
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // QR Code modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const [resBarang, resUser] = await Promise.all([
          fetch(`/api/inventaris/${id}`),
          fetch('/api/auth/me')
        ]);
        const barangData = await resBarang.json();
        const authData = resUser.ok ? await resUser.json() : null;
        if (barangData.success) setData(barangData.data);
        if (authData) setUserData(authData);
      } catch (error) {
        console.error('Failed to fetch barang detail', error);
      } finally {
        hideLoader();
      }
    };
    fetchData();
  }, [id]); // TRIGGER: id

  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

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

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />
      <AlertModal
        isOpen={alertState.isOpen}
        title="Hapus Barang"
        message={`Apakah Anda yakin ingin menghapus barang "${data.nama}"?`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => setAlertState({ isOpen: false })}
      />

      {/* Header */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Detail Barang</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">{data.kode_barang}</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <Link href="/inventaris" className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg flex justify-center items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm">
            <span className="material-icons-round text-slate-500 text-[20px]">arrow_back</span>
            <span className="text-sm font-bold font-sans leading-5">Kembali</span>
          </Link>
          {/* Tombol QR Code — selalu tampil */}
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="px-5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg flex justify-center items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm"
          >
            <span className="material-icons-round text-indigo-500 text-[20px]">qr_code_2</span>
            <span className="text-sm font-bold font-sans leading-5">QR Code</span>
          </button>
          {hasPermission('inventaris_manage') && (
            <>
              <Link href={`/inventaris/${id}/edit`} className="px-5 py-2.5 bg-blue-600 rounded-lg flex justify-start items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm">
                <span className="material-icons-round text-white text-[20px]">edit</span>
                <span className="text-white text-sm font-bold font-sans leading-5">Edit</span>
              </Link>
              <button onClick={() => setAlertState({ isOpen: true })} className="px-5 py-2.5 bg-red-600 rounded-lg flex justify-start items-center gap-2 hover:bg-red-700 transition-colors shadow-sm">
                <span className="material-icons-round text-white text-[20px]">delete</span>
                <span className="text-white text-sm font-bold font-sans leading-5">Hapus</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informasi Umum */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-slate-800 text-lg font-bold mb-4">Informasi Umum</h2>
          <div className="flex flex-col gap-3">
            <InfoRow label="Kode Barang" value={data.kode_barang} />
            <InfoRow label="Nama" value={data.nama} />
            <InfoRow label="Kategori" value={data.nama_kategori} />
            <InfoRow label="Merk" value={data.merk || '-'} />
            <InfoRow label="No. Seri" value={data.no_seri || '-'} />
            <InfoRow label="Deskripsi" value={data.deskripsi || '-'} />
            <InfoRow label="Jumlah" value={data.jumlah?.toString()} />
            <InfoRow label="Kondisi" value={data.kondisi} />
            <InfoRow label="Status" value={data.status} />
            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-500 text-sm font-medium">Tipe</span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                data.tipe_barang === 'satuan'
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                  : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}>
                {data.tipe_barang === 'satuan' ? '🏷️ Aset Satuan' : '📦 Stok Massal'}
              </span>
            </div>
          </div>
        </div>

        {/* Keuangan & Kepemilikan */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-slate-800 text-lg font-bold mb-4">Keuangan & Kepemilikan</h2>
          <div className="flex flex-col gap-3">
            <InfoRow label="Tahun Perolehan" value={data.tahun_perolehan?.toString() || '-'} />
            <InfoRow label="Nilai Perolehan" value={formatCurrency(data.nilai_perolehan || 0)} />
            <InfoRow label="Aktiva Tetap" value={data.is_aktiva_tetap ? 'Ya' : 'Tidak'} />
            <InfoRow label="Tipe Pemilik" value={data.pemilik_tipe === 'satelit' ? 'Satelit' : 'Individu'} />
            <InfoRow label="Pemilik" value={data.pemilik_nama || '-'} />
            <InfoRow label="Lokasi Satelit" value={data.lokasi_nama_satelit || '-'} />
            <InfoRow label="Sub-Lokasi" value={data.lokasi_nama_sublokasi || '-'} />
          </div>
        </div>
      </div>

      {/* Foto — click to zoom (persis jemaat) */}
      {proxyFoto && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-slate-800 text-lg font-bold mb-4">Foto</h2>
          <img
            src={proxyFoto}
            alt={data.nama}
            className="max-w-md rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setIsPhotoModalOpen(true)}
            title="Klik untuk perbesar"
          />
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <span className="material-icons-round text-[14px]">zoom_in</span>
            Klik foto untuk memperbesar
          </p>
        </div>
      )}

      {/* Photo Preview Modal — persis jemaat */}
      {isPhotoModalOpen && proxyFoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsPhotoModalOpen(false)}
        >
          <div className="relative max-w-2xl w-full p-4 flex flex-col items-center">
            <button
              className="absolute top-0 right-0 m-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex justify-center items-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsPhotoModalOpen(false); }}
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

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title={data.nama}
        qrValue={data.kode_barang}
        subtitle={data.nama_kategori}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm font-medium">{label}</span>
      <span className="text-slate-800 text-sm font-semibold text-right max-w-[60%]">{value}</span>
    </div>
  );
}
