'use client';

import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
  title?: string;
  hint?: string;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Barcode Aset',
  hint = 'Arahkan kamera ke barcode atau QR code pada label barang.',
}: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef<any>(null);
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setHasTorch(false);
    setTorchOn(false);
    let stopped = false;

    async function startScanner() {
      setScanning(false);
      try {
        await new Promise((r) => setTimeout(r, 200));
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        const elementId = 'gsja-barcode-scanner-container';
        const el = document.getElementById(elementId);
        if (!el || stopped) return;

        // Inisialisasi scanner dengan prioritas QR Code & barcode umum serta akselerasi hardware
        const scanner = new Html5Qrcode(elementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });
        scannerRef.current = scanner;
        setScanning(true);

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            // Kotak scan persegi responsif — QR Code (1:1) dan barcode tidak lagi terpotong
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.max(180, Math.min(Math.floor(minEdge * 0.78), 260));
              return { width: size, height: size };
            },
          },
          (decoded) => {
            if (!decoded || cooldownRef.current) return;
            cooldownRef.current = true;
            try {
              const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ac.createOscillator();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, ac.currentTime);
              osc.connect(ac.destination);
              osc.start();
              osc.stop(ac.currentTime + 0.12);
            } catch {}
            stopScanner().then(() => {
              onScanSuccess(decoded);
              onClose();
            });
          },
          () => {}
        );

        // Cek kemampuan lampu senter (flashlight / torch) dari kamera aktif
        if (!stopped) {
          try {
            const capabilities = scanner.getRunningTrackCameraCapabilities?.();
            if (capabilities && capabilities.torchFeature && capabilities.torchFeature().isSupported()) {
              setHasTorch(true);
            } else {
              const track = (scanner as any).getRunningTrackCapabilities?.();
              if (track && (track as any).torch) {
                setHasTorch(true);
              }
            }
          } catch {
            // Perangkat / browser tidak mendukung API torch
          }
        }
      } catch (err: any) {
        if (!stopped) {
          setError(err?.message || 'Gagal mengakses kamera. Pastikan izin kamera telah diberikan.');
          setScanning(false);
        }
      }
    }

    startScanner();
    return () => { stopped = true; stopScanner(); };
  }, [isOpen]);

  async function toggleTorch() {
    if (!scannerRef.current) return;
    try {
      const next = !torchOn;
      const capabilities = scannerRef.current.getRunningTrackCameraCapabilities?.();
      if (capabilities && capabilities.torchFeature && capabilities.torchFeature().isSupported()) {
        await capabilities.torchFeature().apply(next);
        setTorchOn(next);
      } else {
        await scannerRef.current.applyVideoConstraints?.({
          advanced: [{ torch: next } as any],
        });
        setTorchOn(next);
      }
    } catch (e) {
      console.error('Failed to toggle flashlight/torch', e);
    }
  }

  async function stopScanner() {
    cooldownRef.current = false;
    setTorchOn(false);
    setHasTorch(false);
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-amber-500 text-[22px]">photo_camera</span>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title={torchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  torchOn
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-2 ring-amber-300'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span className="material-icons-round text-[16px]">
                  {torchOn ? 'flashlight_on' : 'flashlight_off'}
                </span>
                <span className="text-xs">{torchOn ? 'Senter ON' : 'Senter'}</span>
              </button>
            )}
            <button
              onClick={() => { stopScanner(); onClose(); }}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <span className="material-icons-round text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera view — html5-qrcode renders its own scan guide, no need for custom overlay */}
          <div className="relative w-full bg-slate-950 rounded-2xl overflow-hidden" style={{ height: 320 }}>
            <div id="gsja-barcode-scanner-container" className="w-full h-full" />

            {/* Loading spinner — shown before scanner initializes */}
            {!scanning && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-400">Membuka kamera...</p>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="material-icons-round text-red-400 text-5xl">no_photography</span>
                <p className="text-sm text-red-300 font-medium leading-snug">{error}</p>
                <button
                  onClick={() => { setError(null); }}
                  className="mt-1 px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold flex items-center gap-1.5"
                >
                  <span className="material-icons-round text-[16px]">refresh</span>
                  Coba Lagi
                </button>
              </div>
            )}
          </div>

          {/* Tip & Torch banner */}
          {scanning && !error && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="material-icons-round text-amber-500 text-[18px]">qr_code_scanner</span>
                <p className="text-xs text-amber-800">Arahkan kotak scan ke seluruh QR Code stiker.</p>
              </div>
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 ${
                    torchOn
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100/50'
                  }`}
                >
                  <span className="material-icons-round text-[14px]">
                    {torchOn ? 'flashlight_on' : 'flashlight_off'}
                  </span>
                  {torchOn ? 'Matikan' : 'Nyalakan Senter'}
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => { stopScanner(); onClose(); }}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
          >
            Tutup Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
