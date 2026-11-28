'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface SatelitOption {
  id: number;
  nama_satelit: string;
}

interface ImportAnggaranModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: any;
  onImportSuccess: () => void;
}

type ImportStep = 'setup' | 'upload' | 'result';

interface SheetChoice {
  name: string;
  item_count: number;
  total_penerimaan: number;
  total_pengeluaran: number;
}

interface ImportSummary {
  id: string;
  kode_dokumen: string;
  nama_rancangan: string;
  sheet_used: string;
  total_items: number;
  penerimaan_count: number;
  pengeluaran_count: number;
  total_penerimaan: number;
  total_pengeluaran: number;
  skipped_rows: number;
}

const currentYear = new Date().getFullYear();
const tahunOptions = Array.from({ length: 7 }, (_, i) => currentYear - 1 + i);
const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

export default function ImportAnggaranModal({
  isOpen,
  onClose,
  userData,
  onImportSuccess,
}: ImportAnggaranModalProps) {
  const [step, setStep] = useState<ImportStep>('setup');
  const [satelitOptions, setSatelitOptions] = useState<SatelitOption[]>([]);
  const [selectedSatelitId, setSelectedSatelitId] = useState('');
  const [tahun, setTahun] = useState(String(currentYear));
  const [kategoriRa, setKategoriRa] = useState('Operasional');
  const [namaRancangan, setNamaRancangan] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [sheetChoices, setSheetChoices] = useState<SheetChoice[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canChooseSatelit =
    userData?.is_super_admin || userData?.permissions?.includes('multi_satelit_view');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/master-data?table=satelit')
      .then((r) => r.json())
      .then((json) => {
        if (!active || !json.success) return;
        const activeSatelits = (json.data || []).filter((s: any) => s.is_active);
        setSatelitOptions(activeSatelits);
        if (userData?.satelit_id) {
          setSelectedSatelitId(String(userData.satelit_id));
        } else if (activeSatelits[0]) {
          setSelectedSatelitId(String(activeSatelits[0].id));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, userData]);

  if (!isOpen) return null;

  const selectedSatelit = satelitOptions.find((s) => String(s.id) === selectedSatelitId);

  const handleDownloadTemplate = async () => {
    setDownloadLoading(true);
    setErrorMsg('');
    try {
      const q = new URLSearchParams({
        satelit_name: selectedSatelit?.nama_satelit || 'Satelit',
        tahun,
      });
      const res = await fetch(`/api/anggaran/import-template?${q.toString()}`);
      if (!res.ok) throw new Error('Gagal mengunduh template Excel.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Anggaran_${(selectedSatelit?.nama_satelit || 'Satelit').replace(/\s+/g, '_')}_${tahun}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStep('upload');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengunduh template.');
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleImport = async (overrideSheetName?: string) => {
    if (!uploadFile || !selectedSatelitId) return;
    setUploadLoading(true);
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('satelit_id', selectedSatelitId);
      fd.append('tahun', tahun);
      fd.append('kategori_ra', kategoriRa);
      if (namaRancangan.trim()) fd.append('nama_rancangan', namaRancangan.trim());
      const sheetToUse = overrideSheetName || selectedSheetName;
      if (sheetToUse) fd.append('sheet_name', sheetToUse);

      const res = await fetch('/api/anggaran/import-excel', {
        method: 'POST',
        body: fd,
      });
      const rawText = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error(`Respons server tidak valid (HTTP ${res.status}).`);
      }
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Import Excel gagal.');
      }
      if (json.needsSheetSelection && Array.isArray(json.sheets)) {
        setSheetChoices(json.sheets);
        setSelectedSheetName(json.sheets[0]?.name || '');
        return;
      }
      setResult(json.data);
      setStep('result');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Import gagal.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleClose = () => {
    setStep('setup');
    setUploadFile(null);
    setSheetChoices([]);
    setSelectedSheetName('');
    setResult(null);
    setErrorMsg('');
    setNamaRancangan('');
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
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-700 to-teal-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
              <span className="material-icons-round text-white text-[18px]">upload_file</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Import Rancangan Anggaran dari Excel</h3>
              <p className="text-xs text-white/75">
                {step === 'setup'
                  ? 'Langkah 1: Pengaturan & download template proker'
                  : step === 'upload'
                  ? 'Langkah 2: Upload file Excel (.xlsx) yang sudah diisi'
                  : 'Hasil Import Rancangan Anggaran (Draft)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={step === 'result' ? handleDone : handleClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <span className="material-icons-round text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2">
              <span className="material-icons-round text-rose-500 text-[16px] shrink-0 mt-0.5">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'setup' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Satelit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedSatelitId}
                    onChange={(e) => setSelectedSatelitId(e.target.value)}
                    disabled={!canChooseSatelit}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">-- Pilih Satelit --</option>
                    {satelitOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama_satelit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Tahun Anggaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white font-semibold"
                  >
                    {tahunOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Kategori RA
                  </label>
                  <select
                    value={kategoriRa}
                    onChange={(e) => setKategoriRa(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="Operasional">Operasional</option>
                    <option value="Kegiatan">Kegiatan</option>
                    <option value="Pengembangan">Pengembangan</option>
                    <option value="Penggajian">Penggajian</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Nama Rancangan <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={namaRancangan}
                    onChange={(e) => setNamaRancangan(e.target.value)}
                    placeholder={`RA ${selectedSatelit?.nama_satelit || 'Satelit'} ${tahun}`}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-col gap-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <span className="material-icons-round text-[16px] text-emerald-600">info</span>
                  Cara Kerja Template Anggaran GSJA
                </div>
                <p className="leading-relaxed text-emerald-800">
                  Isi nominal di sheet <strong>Template</strong> pada kolom <strong>PENERIMAAN</strong>,{' '}
                  <strong>KAS GEREJA</strong>, atau <strong>SWADAYA</strong>. Baris kosong dan baris{' '}
                  <em>Jumlah Total</em> dilewati otomatis. Hasil import akan masuk sebagai{' '}
                  <strong>Draft RA</strong> agar bisa diperiksa sebelum diajukan.
                </p>
              </div>
            </>
          )}

          {step === 'upload' && (
            <>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{selectedSatelit?.nama_satelit || 'Satelit'}</span> •{' '}
                  Tahun <strong>{tahun}</strong> • {kategoriRa}
                </div>
                <button
                  type="button"
                  onClick={() => setStep('setup')}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Ubah
                </button>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/60 hover:bg-emerald-50/30 transition-colors"
              >
                <span className="material-icons-round text-4xl text-emerald-600">table_view</span>
                <p className="text-sm font-bold text-slate-700">
                  {uploadFile ? uploadFile.name : 'Klik untuk pilih file Excel (.xlsx)'}
                </p>
                <p className="text-xs text-slate-400">
                  {uploadFile
                    ? `${(uploadFile.size / 1024).toFixed(1)} KB — siap diimpor`
                    : 'Gunakan template standar proker GSJA (.xlsx)'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] || null);
                    setSheetChoices([]);
                    setSelectedSheetName('');
                    setErrorMsg('');
                  }}
                />
              </div>

              {sheetChoices.length > 0 && (
                <div className="flex flex-col gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="material-icons-round text-[16px] text-amber-600">layers</span>
                    File berisi beberapa sheet satelit/wilayah — pilih sheet yang ingin diimpor:
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    {sheetChoices.map((sh) => (
                      <label
                        key={sh.name}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                          selectedSheetName === sh.name
                            ? 'border-emerald-500 bg-white shadow-sm'
                            : 'border-amber-200 bg-white/70 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="excel_sheet"
                            checked={selectedSheetName === sh.name}
                            onChange={() => setSelectedSheetName(sh.name)}
                            className="accent-emerald-600"
                          />
                          <div>
                            <div className="font-bold text-slate-800">{sh.name}</div>
                            <div className="text-[11px] text-slate-500">{sh.item_count} item ditemukan</div>
                          </div>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <div className="text-emerald-700 font-bold">+{fmt(sh.total_penerimaan)}</div>
                          <div className="text-rose-600 font-bold">-{fmt(sh.total_pengeluaran)}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'result' && result && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <span className="material-icons-round text-emerald-600 text-2xl">check_circle</span>
                <div>
                  <div className="text-sm font-bold text-emerald-900">
                    Draft {result.kode_dokumen} berhasil dibuat!
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    {result.nama_rancangan} (Sheet: <strong>{result.sheet_used}</strong>)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Penerimaan ({result.penerimaan_count} item)
                  </div>
                  <div className="text-base font-black text-emerald-600 mt-1">
                    {fmt(result.total_penerimaan)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Pengeluaran ({result.pengeluaran_count} item)
                  </div>
                  <div className="text-base font-black text-rose-600 mt-1">
                    {fmt(result.total_pengeluaran)}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Total <strong>{result.total_items} item</strong> berhasil diimpor sebagai <strong>Draft</strong>. Anda
                bisa langsung membuka Draft untuk melengkapi Tanggal Pelaksanaan atau memeriksa rincian sebelum
                mengajukan.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {step === 'setup' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={!selectedSatelitId}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 underline disabled:opacity-40"
              >
                Sudah punya file? Langsung Upload →
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={!selectedSatelitId || downloadLoading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
              >
                <span className="material-icons-round text-[18px]">download</span>
                {downloadLoading ? 'Mengunduh...' : 'Download Template Excel'}
              </button>
            </>
          )}

          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={() => setStep('setup')}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 hover:bg-white"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => handleImport()}
                disabled={!uploadFile || uploadLoading || (sheetChoices.length > 0 && !selectedSheetName)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
              >
                <span className="material-icons-round text-[18px]">cloud_upload</span>
                {uploadLoading ? 'Mengimpor...' : 'Import ke Draft RA'}
              </button>
            </>
          )}

          {step === 'result' && result && (
            <>
              <button
                type="button"
                onClick={handleDone}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 hover:bg-white"
              >
                Tutup
              </button>
              <Link
                href={`/anggaran/rancangan/edit/${result.id}`}
                onClick={handleDone}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
              >
                <span className="material-icons-round text-[18px]">edit_note</span>
                Buka &amp; Edit Draft RA
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
