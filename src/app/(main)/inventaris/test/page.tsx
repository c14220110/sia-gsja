'use client';

// TEST PAGE - clone 1:1 dari jemaat/page.tsx, hanya beda API endpoint
// Tujuan: membuktikan apakah loader stuck adalah masalah kode atau lingkungan

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';

export default function InventarisTestPage() {
  const { showLoader, hideLoader } = useLoader();

  const [status, setStatus] = useState('mounting...');
  const [count, setCount] = useState(0);

  // Identik 1:1 dengan jemaat: satu useEffect, showLoader, await fetch, hideLoader di finally tanpa guard
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const res = await fetch('/api/inventaris?limit=1&offset=0');
        const data = await res.json();
        setStatus('success: ' + JSON.stringify(data.success) + ' total=' + (data.meta?.total ?? 'N/A'));
        setCount(c => c + 1);
      } catch (error) {
        setStatus('error: ' + String(error));
      } finally {
        hideLoader();
      }
    };
    fetchData();
  }, []); // TRIGGER KOSONG - identik dengan jemaat

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Inventaris Test Page</h1>
      <p className="text-slate-600">Status: <strong>{status}</strong></p>
      <p className="text-slate-600">Fetch count: <strong>{count}</strong></p>
      <p className="text-xs text-slate-400 mt-4">Kalau loader berhenti dan fetch count = 1, kode inventaris sudah benar</p>
    </div>
  );
}
