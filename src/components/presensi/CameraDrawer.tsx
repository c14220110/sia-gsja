'use client';

import React, { useState } from 'react';
import { Drawer } from 'vaul';
import { motion } from 'framer-motion';
import { RefreshCw, X, Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Camera as PhosphorCamera } from '@phosphor-icons/react';
import { useHumanCamera } from '@/hooks/useHumanCamera';

export interface CameraDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'ENROLL' | 'CHECK_IN' | 'CHECK_OUT';
  coords: { lat: number; lng: number; accuracy: number } | null;
  branchName?: string | null;
  pegawaiIdOverride?: number | null;
  onSuccess: (message: string) => void;
}

export const CameraDrawer: React.FC<CameraDrawerProps> = ({
  isOpen,
  onClose,
  mode,
  coords,
  branchName,
  pegawaiIdOverride,
  onSuccess,
}) => {
  const {
    videoRef,
    cameraReady,
    cameraError,
    modelLoading,
    restartCamera,
    captureAndExtractFace,
  } = useHumanCamera(isOpen);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const titleMap = {
    ENROLL: 'Pendaftaran Wajah (Face ID)',
    CHECK_IN: 'Verifikasi Wajah Check-In',
    CHECK_OUT: 'Verifikasi Wajah Check-Out',
  };

  const subtitleMap = {
    ENROLL: 'Posisikan wajah di tengah bingkai dengan pencahayaan terang.',
    CHECK_IN: `Lokasi: ${branchName || 'Area Kantor GSJA'}`,
    CHECK_OUT: 'Check-Out dapat dilakukan dari lokasi mana saja.',
  };

  const handleCaptureAndSubmit = async () => {
    setErrorMsg(null);
    if (mode !== 'ENROLL' && !coords) {
      setErrorMsg('Koordinat GPS belum tersedia. Pastikan izin lokasi aktif.');
      return;
    }

    setSubmitting(true);
    try {
      const faceResult = await captureAndExtractFace();
      const endpoint =
        mode === 'ENROLL'
          ? '/api/pegawai/presensi/enroll-face'
          : mode === 'CHECK_IN'
          ? '/api/pegawai/presensi/check-in'
          : '/api/pegawai/presensi/check-out';

      const payload =
        mode === 'ENROLL'
          ? {
              descriptor: faceResult.descriptor,
              photoBase64: faceResult.photoBase64,
              pegawaiId: pegawaiIdOverride || undefined,
            }
          : {
              lat: coords!.lat,
              lng: coords!.lng,
              accuracy: coords!.accuracy,
              descriptor: faceResult.descriptor,
              photoBase64: faceResult.photoBase64,
              pegawaiId: pegawaiIdOverride || undefined,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memproses presensi');
      }

      onSuccess(json.message || 'Berhasil!');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan saat verifikasi wajah.');
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
                {titleMap[mode]}
              </Drawer.Title>
              <p className="text-xs text-slate-500 mt-0.5">{subtitleMap[mode]}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4 overflow-y-auto">
            {/* Live Camera Frame */}
            <div className="relative w-full aspect-[3/4] max-h-[360px] rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-200 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />

              {/* Face Guide Oval */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ opacity: [0.55, 0.95, 0.55] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-48 h-60 rounded-[50%] border-2 border-dashed border-emerald-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]"
                />
              </div>

              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/90 p-5 flex flex-col items-center justify-center text-center text-white gap-3">
                  <ShieldAlert className="w-10 h-10 text-amber-400" />
                  <p className="text-xs text-slate-200">{cameraError}</p>
                  <button
                    type="button"
                    onClick={restartCamera}
                    className="px-3.5 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Coba Buka Kamera Lagi</span>
                  </button>
                </div>
              )}

              {(submitting || modelLoading) && (
                <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center text-white gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs font-semibold">
                    {modelLoading ? 'Menganalisis Biometrik Wajah...' : 'Menyimpan Presensi...'}
                  </span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-700 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              disabled={!cameraReady || submitting || modelLoading}
              onClick={handleCaptureAndSubmit}
              className="w-full py-3.5 px-4 rounded-xl bg-[#3B1F3D] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-all"
            >
              {submitting || modelLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  {mode === 'ENROLL' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <PhosphorCamera className="w-5 h-5" weight="bold" />
                  )}
                  <span>
                    {mode === 'ENROLL'
                      ? 'Simpan Wajah Saya'
                      : mode === 'CHECK_IN'
                      ? 'Ambil Foto & Check-In'
                      : 'Ambil Foto & Check-Out'}
                  </span>
                </>
              )}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
