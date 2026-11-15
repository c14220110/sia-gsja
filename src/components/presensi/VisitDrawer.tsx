'use client';

import React, { useState } from 'react';
import { Drawer } from 'vaul';
import { Camera, MapPin, X, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useHumanCamera } from '@/hooks/useHumanCamera';
import type { SatelitGeofence } from '@/lib/geofence';

export interface VisitDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  satelits: SatelitGeofence[];
  coords: { lat: number; lng: number; accuracy: number } | null;
  pegawaiIdOverride?: number | null;
  onSuccess: (message: string) => void;
}

const KATEGORI_OPTIONS = [
  'Doa & Ibadah Satelit',
  'Kunjungan Jemaat / RS',
  'Konseling Pastoral',
  'Kunjungan Kedukaan / Doa',
  'Pelayanan Lapangan Lainnya',
];

export const VisitDrawer: React.FC<VisitDrawerProps> = ({
  isOpen,
  onClose,
  satelits,
  coords,
  pegawaiIdOverride,
  onSuccess,
}) => {
  const { videoRef, cameraReady, cameraError, restartCamera, captureLiveSelfieOnly } =
    useHumanCamera(isOpen);

  const [kategori, setKategori] = useState(KATEGORI_OPTIONS[0]);
  const [locationType, setLocationType] = useState<'satelit' | 'bebas'>('satelit');
  const [satelitTujuanId, setSatelitTujuanId] = useState<string>(
    satelits[0]?.id ? String(satelits[0].id) : ''
  );
  const [lokasiBebas, setLokasiBebas] = useState('');
  const [notes, setNotes] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTakeSelfie = () => {
    setErrorMsg(null);
    try {
      const base64 = captureLiveSelfieOnly();
      setCapturedPhoto(base64);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengambil foto selfie.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!coords) {
      setErrorMsg('Koordinat GPS wajib aktif sebelum mengirim kunjungan.');
      return;
    }
    if (!capturedPhoto) {
      setErrorMsg('Selfie langsung dari kamera wajib diambil.');
      return;
    }
    if (!notes.trim()) {
      setErrorMsg('Catatan aktivitas pelayanan wajib diisi.');
      return;
    }
    if (locationType === 'bebas' && !lokasiBebas.trim()) {
      setErrorMsg('Isi nama lokasi kunjungan (misal: RS Siloam / Rumah Jemaat).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/pegawai/presensi/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kategori,
          satelitTujuanId: locationType === 'satelit' ? Number(satelitTujuanId) : null,
          lokasiBebas: locationType === 'bebas' ? lokasiBebas.trim() : null,
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
          photoBase64: capturedPhoto,
          notes: notes.trim(),
          pegawaiId: pegawaiIdOverride || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menyimpan kunjungan.');
      }

      setCapturedPhoto(null);
      setNotes('');
      setLokasiBebas('');
      onSuccess(json.message || 'Kunjungan berhasil dicatat!');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan saat menyimpan kunjungan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md bg-white rounded-t-3xl outline-none shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-300 mt-3 mb-1" />

          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <Drawer.Title className="text-base font-extrabold text-slate-900">
                Tambah Visit / Kunjungan Pastoral
              </Drawer.Title>
              <p className="text-xs text-slate-500 mt-0.5">
                Selfie langsung + GPS otomatis + catatan kegiatan per kunjungan
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5 overflow-y-auto">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                Kategori Pelayanan
              </label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:ring-2 focus:ring-[#3B1F3D]"
              >
                {KATEGORI_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                Tujuan Kunjungan
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setLocationType('satelit')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                    locationType === 'satelit'
                      ? 'bg-[#3B1F3D] text-white border-[#3B1F3D]'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  Gereja / Satelit GSJA
                </button>
                <button
                  type="button"
                  onClick={() => setLocationType('bebas')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                    locationType === 'bebas'
                      ? 'bg-[#3B1F3D] text-white border-[#3B1F3D]'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  Lokasi Bebas (RS / Rumah)
                </button>
              </div>

              {locationType === 'satelit' ? (
                <select
                  value={satelitTujuanId}
                  onChange={(e) => setSatelitTujuanId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:ring-2 focus:ring-[#3B1F3D]"
                >
                  {satelits.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama_satelit}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={lokasiBebas}
                  onChange={(e) => setLokasiBebas(e.target.value)}
                  placeholder="Contoh: RS Premier Ruang 302 / Rumah Bpk. Santoso"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#3B1F3D]"
                />
              )}
            </div>

            {/* Selfie Live Camera */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                Selfie Bukti Kunjungan (Wajib Kamera Langsung)
              </label>
              <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200">
                {capturedPhoto ? (
                  <img
                    src={capturedPhoto}
                    alt="Preview Selfie Visit"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                )}
                {cameraError && !capturedPhoto && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white p-3 text-center gap-2">
                    <ShieldAlert className="w-6 h-6 text-amber-400" />
                    <span className="text-[11px]">{cameraError}</span>
                    <button
                      type="button"
                      onClick={restartCamera}
                      className="px-2.5 py-1 rounded-lg bg-white text-slate-900 text-[11px] font-bold"
                    >
                      Buka Ulang Kamera
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                {capturedPhoto ? (
                  <button
                    type="button"
                    onClick={() => setCapturedPhoto(null)}
                    className="w-full py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Foto Ulang</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!cameraReady}
                    onClick={handleTakeSelfie}
                    className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Jepret Selfie Sekarang</span>
                  </button>
                )}
              </div>
            </div>

            {/* GPS Metadata Pill */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {coords
                    ? `GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                    : 'Menunggu kunci GPS...'}
                </span>
              </div>
              {coords && (
                <span className="text-[10px] font-bold text-slate-500">
                  ±{Math.round(coords.accuracy)}m
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                Catatan Pekerjaan / Hasil Kunjungan *
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Memimpin doa siang di Satelit Elim dan mendoakan jemaat yang sakit..."
                className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#3B1F3D]"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#3B1F3D] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Kunjungan...</span>
                </>
              ) : (
                <span>Simpan Kunjungan</span>
              )}
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
