'use client';
import React, { useEffect, useRef, useState } from 'react';

interface PhotoCaptureButtonProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  captureMode?: 'user' | 'environment';
  buttonClassName?: string;
  iconClassName?: string;
}

/**
 * Dual-input photo trigger supporting both direct camera capture (Android & iOS)
 * and gallery/file selection without forcing users to leave the web app on Android.
 */
export function PhotoCaptureButton({
  onChange,
  captureMode = 'environment',
  buttonClassName = 'w-8 h-8 absolute right-[-10px] bottom-[-10px] bg-slate-700 rounded-full border-2 border-white cursor-pointer inline-flex justify-center items-center hover:bg-slate-800 transition-colors shadow-lg z-10',
  iconClassName = 'material-icons-round text-white text-[16px]',
}: PhotoCaptureButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOpen(false);
    onChange(e);
    // Reset value so picking/capturing the same file again still triggers onChange
    e.target.value = '';
  };

  return (
    <div ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Pilih atau ambil foto"
        className={buttonClassName}
      >
        <span className={iconClassName}>add_a_photo</span>
      </button>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture={captureMode}
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {open && (
        <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50">
          <button
            type="button"
            onClick={() => {
              if (cameraInputRef.current) {
                cameraInputRef.current.value = '';
                cameraInputRef.current.click();
              }
            }}
            className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors"
          >
            <span className="material-icons-round text-[18px] text-indigo-600">photo_camera</span>
            Ambil Foto (Kamera)
          </button>
          <button
            type="button"
            onClick={() => {
              if (galleryInputRef.current) {
                galleryInputRef.current.value = '';
                galleryInputRef.current.click();
              }
            }}
            className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors border-t border-slate-100"
          >
            <span className="material-icons-round text-[18px] text-emerald-600">photo_library</span>
            Pilih dari Galeri
          </button>
        </div>
      )}
    </div>
  );
}
