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

  const [showAddUnit, setShowAddUnit] = useState(false);
  const [addUnitForm, setAddUnitForm] = useState({
    no_seri: '',
    kondisi: 'Baik',
    lokasi_satelit_id: '',
    lokasi_sublokasi_id: '',
  });
  const [addUnitState, setAddUnitState] = useState<{ status: 'idle'|'loading'|'success'|'error'; message: string }>({ status: 'idle', message: '' });
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [sublokasiOptions, setSublokasiOptions] = useState<any[]>([]);

  // Load satelit options once
  useEffect(() => {
    fetch('/api/options?type=satelit')
      .then(r => r.json())
      .then(d => { if (d.success) setSatelitOptions(d.data); })
      .catch(() => {});
  }, []);

  // Load sublokasi when satelit changes in addUnitForm
  useEffect(() => {
    if (!addUnitForm.lokasi_satelit_id) { setSublokasiOptions([]); return; }
    fetch(`/api/options?type=sublokasi&satelit_id=${addUnitForm.lokasi_satelit_id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setSublokasiOptions(d.data); })
      .catch(() => {});
  }, [addUnitForm.lokasi_satelit_id]);

  // When modal opens, pre-fill lokasi from current item
  useEffect(() => {
    if (showAddUnit && data) {
      setAddUnitForm(prev => ({
        ...prev,
        lokasi_satelit_id: data.lokasi_satelit_id?.toString() || '',
        lokasi_sublokasi_id: data.lokasi_sublokasi_id?.toString() || '',
      }));
    }
  }, [showAddUnit]);

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
        // Lokasi from form (user can change per unit)
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
        setAddUnitForm({ no_seri: '', kondisi: 'Baik', lokasi_satelit_id: data.lokasi_satelit_id?.toString() || '', lokasi_sublokasi_id: data.lokasi_sublokasi_id?.toString() || '' });
        setTimeout(() => { setShowAddUnit(false); setAddUnitState({ status: 'idle', message: '' }); }, 2000);
      } else {
        setAddUnitState({ status: 'error', message: result.message || 'Gagal menambahkan unit' });
      }
    } catch (err: any) {
      setAddUnitState({ status: 'error', message: err.message || 'Koneksi error' });
    }
  };

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
              {data?.tipe_barang === 'satuan' && (
                <button
                  onClick={() => setShowAddUnit(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                  <span className="material-icons-round text-[18px]">add_circle</span>
                  Tambah Unit Serupa
                </button>
              )}
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
        defaultCopies={data.tipe_barang === 'massal' ? (data.jumlah ?? 1) : 1}
        defaultTab={data.tipe_barang === 'massal' ? 'pdf' : 'png'}
      />
      {/* Tambah Unit Serupa Modal */}
      {showAddUnit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Tambah Unit Serupa</h3>
                <p className="text-xs text-slate-500 mt-0.5">Data dari: <strong>{data?.nama}</strong></p>
              </div>
              <button onClick={() => { setShowAddUnit(false); setAddUnitState({ status: 'idle', message: '' }); setAddUnitForm({ no_seri: '', kondisi: 'Baik', lokasi_satelit_id: '', lokasi_sublokasi_id: '' }); }} className="p-2 rounded-lg hover:bg-slate-100">
                <span className="material-icons-round text-slate-500">close</span>
              </button>
            </div>
            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Pre-filled info (nama + kategori only — lokasi is editable below) */}
              <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-500 flex flex-col gap-1">
                <div className="flex justify-between"><span>Nama</span><span className="font-semibold text-slate-700">{data?.nama}</span></div>
                <div className="flex justify-between"><span>Kategori</span><span className="font-semibold text-slate-700">{data?.nama_kategori}</span></div>
              </div>

              {/* No. Seri */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">
                  No. Seri Unit Baru
                  <span className="ml-2 text-xs font-normal text-slate-400">(dari label fisik produk — opsional)</span>
                </label>
                <input
                  type="text"
                  value={addUnitForm.no_seri}
                  onChange={e => setAddUnitForm(prev => ({ ...prev, no_seri: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Contoh: C02ABC123DEF"
                  autoFocus
                />
              </div>

              {/* Kondisi */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Kondisi Unit Baru</label>
                <select
                  value={addUnitForm.kondisi}
                  onChange={e => setAddUnitForm(prev => ({ ...prev, kondisi: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="Baik">Baik</option>
                  <option value="Rusak Ringan">Rusak Ringan</option>
                  <option value="Rusak Berat">Rusak Berat</option>
                </select>
              </div>

              {/* Lokasi Satelit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">
                  Lokasi Satelit
                  <span className="ml-2 text-xs font-normal text-slate-400">(bisa berbeda dari unit sebelumnya)</span>
                </label>
                <select
                  value={addUnitForm.lokasi_satelit_id}
                  onChange={e => setAddUnitForm(prev => ({ ...prev, lokasi_satelit_id: e.target.value, lokasi_sublokasi_id: '' }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">-- Pilih Satelit --</option>
                  {satelitOptions.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                  ))}
                </select>
              </div>

              {/* Sub-Lokasi */}
              {addUnitForm.lokasi_satelit_id && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Sub-Lokasi / Ruangan</label>
                  <select
                    value={addUnitForm.lokasi_sublokasi_id}
                    onChange={e => setAddUnitForm(prev => ({ ...prev, lokasi_sublokasi_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="">-- Pilih Ruangan (opsional) --</option>
                    {sublokasiOptions.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.nama}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Error/Success */}
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
            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddUnit(false); setAddUnitState({ status: 'idle', message: '' }); setAddUnitForm({ no_seri: '', kondisi: 'Baik', lokasi_satelit_id: '', lokasi_sublokasi_id: '' }); }}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                disabled={addUnitState.status === 'loading'}
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
    <div className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm font-medium">{label}</span>
      <span className="text-slate-800 text-sm font-semibold text-right max-w-[60%]">{value}</span>
    </div>
  );
}
