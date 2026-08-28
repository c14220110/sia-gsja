'use client';

import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
  title?: string;
  hint?: string;
}

/**
 * Barcode + QR Code scanner using @yudiel/react-qr-scanner (ZXing-based).
 * Supports: Code128, Code39, QR Code, EAN, UPC, etc.
 */
export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Barcode Aset',
  hint = 'Arahkan kamera ke barcode atau QR code pada label barang.',
}: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setLastScanned(null);
    let stopped = false;

    async function startScanner() {
      setScanning(true);
      try {
        await new Promise((r) => setTimeout(r, 150));
        const { Html5Qrcode } = await import('html5-qrcode');
        const elementId = 'gsja-barcode-scanner-container';
        const el = document.getElementById(elementId);
        if (!el || stopped) return;

        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 280, height: 120 } },
          (decoded) => {
            if (!decoded || cooldownRef.current) return;
            cooldownRef.current = true;
            // Beep
            try {
              const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ac.createOscillator();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, ac.currentTime);
              osc.connect(ac.destination);
              osc.start();
              osc.stop(ac.currentTime + 0.12);
            } catch {}
            setLastScanned(decoded);
            stopScanner().then(() => {
              onScanSuccess(decoded);
              onClose();
            });
          },
          () => {} // frame error — ignorable
        );
      } catch (err: any) {
        if (!stopped) {
          setError(err?.message || 'Gagal mengakses kamera. Pastikan izin kamera telah diberikan.');
          setScanning(false);
        }
      }
    }

    startScanner();

    return () => {
      stopped = true;
      stopScanner();
    };
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
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-amber-500 text-[20px]">photo_camera</span>
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          </div>
          <button
            onClick={() => { stopScanner(); onClose(); }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 text-center">{hint}</p>

          {/* Camera view */}
          <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border-2 border-dashed border-amber-500/50 flex items-center justify-center">
            <div id="gsja-barcode-scanner-container" className="w-full h-full" />

            {/* Scan guide lines */}
            {scanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-20 border-2 border-amber-400/70 rounded-lg relative">
                  {/* Corner marks */}
                  {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                    <div key={pos} className={`absolute w-5 h-5 border-amber-400 ${
                      pos.includes('top') ? 'top-[-2px]' : 'bottom-[-2px]'
                    } ${pos.includes('left') ? 'left-[-2px] border-l-2 border-t-2' : 'right-[-2px] border-r-2'} ${
                      pos.includes('bottom') ? 'border-b-2' : ''
                    } ${pos === 'top-right' ? 'border-t-2' : ''}`} />
                  ))}
                  {/* Scanning line animation */}
                  <div className="absolute w-full h-0.5 bg-amber-400/80 animate-bounce top-1/2" />
                </div>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="material-icons-round text-red-400 text-4xl">error_outline</span>
                <p className="text-xs text-red-300 font-medium">{error}</p>
                <button
                  onClick={() => { setError(null); setScanning(false); }}
                  className="mt-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <span className="material-icons-round text-[14px]">refresh</span>
                  Coba Lagi
                </button>
              </div>
            )}

            {/* Loading state */}
            {!scanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {lastScanned && (
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
              <span className="material-icons-round text-emerald-500 text-[16px]">check_circle</span>
              <span className="text-xs font-mono font-bold text-emerald-700">{lastScanned}</span>
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
