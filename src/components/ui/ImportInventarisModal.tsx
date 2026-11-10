'use client';

import { useState, useRef } from 'react';

interface ImportInventarisModalProps {
  isOpen: boolean;
  onClose: () => void;
  satelitOptions: Array<{ id: number; nama_satelit: string }>;
  onImportSuccess: () => void;
}

type ImportStep = 'select' | 'upload' | 'result';

interface ImportResult {
  totalInserted: number;
  results: Array<{
    sheet: string;
    sublokasi_id: number;
    inserted: number;
    skipped: number;
    errors: string[];
  }>;
}

export default function ImportInventarisModal({
  isOpen, onClose, satelitOptions, onImportSuccess,
}: ImportInventarisModalProps) {
  const [step, setStep] = useState<ImportStep>('select');
  const [selectedSatelitId, setSelectedSatelitId] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const selectedSatelit = satelitOptions.find(s => s.id.toString() === selectedSatelitId);

  const handleDownloadTemplate = async () => {
    if (!selectedSatelitId) return;
    setDownloadLoading(true);
    try {
      const res = await fetch(`/api/inventaris/import-template?satelit_id=${selectedSatelitId}`);
      if (!res.ok) throw new Error('Gagal generate template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Inventaris_${selectedSatelit?.nama_satelit.replace(/\s+/g, '_') || 'Satelit'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Advance to upload step
      setStep('upload');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal download template');
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setUploadFile(f);
    setErrorMsg('');
  };

  const handleImport = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const res = await fetch('/api/inventaris/import-excel', {
        method: 'POST',
        body: fd,
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      setImportResult(result.data);
      setStep('result');
    } catch (err: any) {
      setErrorMsg(err.message || 'Import gagal');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedSatelitId('');
    setUploadFile(null);
    setImportResult(null);
    setErrorMsg('');
    onClose();
  };

  const handleDone = () => {
    handleClose();
    onImportSuccess();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <span className="material-icons-round text-white text-[18px]">upload_file</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Import Inventaris dari Excel</h3>
              <p className="text-xs text-white/60">
                {step === 'select' ? 'Langkah 1: Pilih satelit & download template'
                  : step === 'upload' ? 'Langkah 2: Upload file yang sudah diisi'
                  : 'Import selesai'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <span className="material-icons-round text-white/80 text-[20px]">close</span>
          </button>
        </div>

        {/* Step indicators */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
          {['select', 'upload', 'result'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                step === s ? 'bg-slate-700 text-white'
                  : ['select', 'upload', 'result'].indexOf(step) > i ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {['select', 'upload', 'result'].indexOf(step) > i
                  ? <span className="material-icons-round text-[13px]">check</span>
                  : i + 1}
              </div>
              <span className={`text-xs font-medium ${step === s ? 'text-slate-700' : 'text-slate-400'}`}>
                {s === 'select' ? 'Satelit & Template' : s === 'upload' ? 'Upload & Import' : 'Hasil'}
              </span>
              {i < 2 && <div className="w-8 h-px bg-slate-200 mx-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

          {/* ── STEP 1: SELECT SATELIT ─────────────────────────────── */}
          {step === 'select' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                <p className="font-semibold mb-1">📋 Cara Pakai:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Pilih satelit yang ingin diimport inventarisnya</li>
                  <li>Download template Excel — sudah ada sheet per ruangan + dropdown validasi</li>
                  <li>Isi data di Excel (tanpa ubah nama sheet atau header)</li>
                  <li>Upload file kembali di langkah berikutnya</li>
                </ol>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">
                  Pilih Satelit <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSatelitId}
                  onChange={e => setSelectedSatelitId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">-- Pilih Satelit --</option>
                  {satelitOptions.map(s => (
                    <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                  ))}
                </select>
              </div>

              {selectedSatelitId && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700 mb-1">Template yang akan digenerate untuk <strong>{selectedSatelit?.nama_satelit}</strong>:</p>
                  <ul className="space-y-0.5">
                    <li>📌 Sheet <strong>PETUNJUK</strong> — panduan pengisian</li>
                    <li>📄 Sheet per ruangan — Ruang Ibadah, Gudang, dll.</li>
                    <li>✅ Dropdown validasi untuk Kategori, Tipe, Kondisi</li>
                    <li>📷 Kolom Link Foto (Google Drive) — otomatis upload ke sistem</li>
                    <li>🔒 Metadata tersembunyi untuk verifikasi import</li>
                  </ul>
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: UPLOAD ─────────────────────────────────────── */}
          {step === 'upload' && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                <p className="font-semibold">✅ Template berhasil didownload untuk <strong>{selectedSatelit?.nama_satelit}</strong></p>
                <p className="text-xs mt-1 text-emerald-600">Isi data di Excel, simpan, lalu upload file di bawah ini.</p>
              </div>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                  uploadFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className={`material-icons-round text-[36px] ${uploadFile ? 'text-emerald-500' : 'text-slate-300'}`}>
                  {uploadFile ? 'check_circle' : 'cloud_upload'}
                </span>
                {uploadFile ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-700">{uploadFile.name}</p>
                    <p className="text-xs text-emerald-500">{(uploadFile.size / 1024).toFixed(1)} KB · Klik untuk ganti file</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-600">Klik atau drag file .xlsx ke sini</p>
                    <p className="text-xs text-slate-400">Hanya file template resmi SIA GSJA yang didukung</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                <strong>⚠️ Perhatian:</strong> Import akan langsung memasukkan data ke database. Pastikan data sudah benar sebelum import.
              </div>
            </>
          )}

          {/* ── STEP 3: RESULT ─────────────────────────────────────── */}
          {step === 'result' && importResult && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <p className="font-bold text-emerald-700 text-sm">
                  ✅ Import Selesai — <strong>{importResult.totalInserted.toLocaleString('id-ID')}</strong> barang berhasil dimasukkan
                </p>
              </div>

              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {importResult.results.map((r, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2.5 text-xs ${r.errors.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-700">📍 {r.sheet}</span>
                      <div className="flex items-center gap-2">
                        {r.inserted > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                            +{r.inserted} barang
                          </span>
                        )}
                        {r.skipped > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                            {r.skipped} dilewati
                          </span>
                        )}
                      </div>
                    </div>
                    {r.errors.map((err, j) => (
                      <p key={j} className="text-amber-600 mt-0.5">⚠️ {err}</p>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <span className="material-icons-round text-[16px]">error</span>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center gap-3">
          {step === 'upload' && (
            <button
              onClick={() => setStep('select')}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <span className="material-icons-round text-[14px]">chevron_left</span>
              Kembali
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            {step === 'result' ? 'Tutup' : 'Batal'}
          </button>

          {step === 'select' && (
            <button
              onClick={handleDownloadTemplate}
              disabled={!selectedSatelitId || downloadLoading}
              className="px-5 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {downloadLoading ? (
                <span className="material-icons-round animate-spin text-[16px]">sync</span>
              ) : (
                <span className="material-icons-round text-[16px]">download</span>
              )}
              Download Template
            </button>
          )}

          {step === 'upload' && (
            <button
              onClick={handleImport}
              disabled={!uploadFile || uploadLoading}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {uploadLoading ? (
                <>
                  <span className="material-icons-round animate-spin text-[16px]">sync</span>
                  Memproses...
                </>
              ) : (
                <>
                  <span className="material-icons-round text-[16px]">upload</span>
                  Import Sekarang
                </>
              )}
            </button>
          )}

          {step === 'result' && (
            <button
              onClick={handleDone}
              className="px-5 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <span className="material-icons-round text-[16px]">refresh</span>
              Refresh Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
