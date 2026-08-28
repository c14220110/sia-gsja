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
  const scannerRef = useRef<any>(null);
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    let stopped = false;

    async function startScanner() {
      setScanning(false);
      try {
        await new Promise((r) => setTimeout(r, 200));
        const { Html5Qrcode } = await import('html5-qrcode');
        const elementId = 'gsja-barcode-scanner-container';
        const el = document.getElementById(elementId);
        if (!el || stopped) return;

        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;
        setScanning(true);

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            // Rectangular scan box — fits barcodes better
            qrbox: { width: 300, height: 100 },
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

  async function stopScanner() {
    cooldownRef.current = false;
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
          <button
            onClick={() => { stopScanner(); onClose(); }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera view — html5-qrcode renders its own scan guide, no need for custom overlay */}
          <div className="relative w-full bg-slate-950 rounded-2xl overflow-hidden" style={{ height: 280 }}>
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

          {/* Tip */}
          {scanning && !error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="material-icons-round text-amber-500 text-[16px]">tips_and_updates</span>
              <p className="text-xs text-amber-700">Dekatkan barcode ke kotak scan. Pastikan cahaya cukup.</p>
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
