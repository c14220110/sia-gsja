import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';
// Note: notifyMajelisRaSubmitted is NOT imported here — Majelis notifications fire from approve-ketua endpoint

// GET: Borong semua Anggaran Tahunan (ditambah opsional saringan)
export async function GET(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const satelitFilter = searchParams.get('satelit_id');
    const statusFilter  = searchParams.get('status'); // comma-separated e.g. "Disetujui Penuh,Disetujui Sebagian"

    const conditions: string[] = [];
    const values: any[] = [];

    if (!caller.is_super_admin && !caller.permissions.includes('anggaran_review')) {
      // Jika bukan admin/pusat, paksa hanya bisa lihat satelit sendiri
      if (caller.satelit_id) {
        values.push(caller.satelit_id);
        conditions.push(`at.satelit_id = $${values.length}`);
      } else {
        // Jika tidak punya satelit_id dan bukan pusat, jangan tampilkan apa-apa (atau return error)
        conditions.push(`1 = 0`); 
      }
    } else {
      // Admin/pusat bisa filter berdasarkan dropdown di UI
      if (satelitFilter) {
        values.push(parseInt(satelitFilter));
        conditions.push(`at.satelit_id = $${values.length}`);
      }
    }
    if (statusFilter) {
      const statuses = statusFilter.split(',').map(s => s.trim());
      values.push(statuses);
      conditions.push(`at.status = ANY($${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await pool.query(`
      SELECT 
        at.id,
        at.kode_dokumen,
        at.tahun,
        at.satelit_id,
        s.nama_satelit AS satelit,
        at.komisi_id,
        k.nama_komisi   AS komisi,
        at.total_anggaran,
        at.total_disetujui,
        at.status,
        at.kategori_ra,
        at.pola_penggunaan,
        at.nama_rancangan,
        at.estimasi_waktu,
        at.updated_at,
        -- Estimasi awal: Penerimaan - Pengeluaran (sebelum review)
        COALESCE((SELECT SUM(d.jumlah * d.harga_satuan) FROM public.anggaran_tahunan_detail d WHERE d.anggaran_tahunan_id = at.id AND d.jenis_anggaran = 'Penerimaan'), 0)
          - COALESCE((SELECT SUM(d.jumlah * d.harga_satuan) FROM public.anggaran_tahunan_detail d WHERE d.anggaran_tahunan_id = at.id AND d.jenis_anggaran = 'Pengeluaran'), 0)
          AS estimasi_awal,
        -- Estimasi setelah review: Penerimaan ACC - Pengeluaran ACC/ACC_DIPOTONG
        COALESCE((SELECT SUM(d.nominal_disetujui) FROM public.anggaran_tahunan_detail d WHERE d.anggaran_tahunan_id = at.id AND d.jenis_anggaran = 'Penerimaan' AND d.status_item = 'ACC'), 0)
          - COALESCE((SELECT SUM(d.nominal_disetujui) FROM public.anggaran_tahunan_detail d WHERE d.anggaran_tahunan_id = at.id AND d.jenis_anggaran = 'Pengeluaran' AND d.status_item IN ('ACC', 'ACC_DIPOTONG')), 0)
          AS estimasi_disetujui
      FROM public.anggaran_tahunan at
      LEFT JOIN public.satelit  s ON at.satelit_id::varchar = s.id::varchar
      LEFT JOIN public.komisi   k ON at.komisi_id::varchar   = k.id::varchar
      ${whereClause}
      ORDER BY at.tahun DESC, at.updated_at DESC
    `, values);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error fetching anggaran tahunan:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data anggaran', error: error.message }, { status: 500 });
  }
}

// POST: Create new Anggaran Tahunan (header + detail items in one transaction)
export async function POST(request: NextRequest) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!caller.is_super_admin && !caller.permissions.includes('anggaran_create')) {
    return NextResponse.json({ success: false, message: 'Akses Ditolak: Anda tidak memiliki izin mengelola anggaran' }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { satelit_id, komisi_id, tahun, kategori_ra, pola_penggunaan, jenis_kegiatan_id, nama_rancangan, estimasi_waktu, action, items } = body;

    // Validation
    if (!satelit_id || !tahun) {
      return NextResponse.json({ success: false, message: 'Satelit dan Tahun wajib diisi.' }, { status: 400 });
    }
    if (!nama_rancangan) {
      return NextResponse.json({ success: false, message: 'Nama Rancangan wajib diisi.' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Minimal harus ada 1 item rincian anggaran.' }, { status: 400 });
    }
    // Ensure every item has a coa_id (harga mati)
    const missingCoa = items.find((i: any) => !i.coa_id);
    if (missingCoa) {
      return NextResponse.json({ success: false, message: `Item "${missingCoa.uraian}" belum memiliki Akun COA. Semua item wajib ditautkan ke COA.` }, { status: 400 });
    }

    const status = action === 'ajukan' ? 'Menunggu Persetujuan Ketua' : 'Draft';

    // Generate kode_dokumen: RA-YY-XXX
    const yearCode = String(tahun).slice(-2);
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM public.anggaran_tahunan WHERE tahun = $1`, [tahun]
    );
    const seq = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
    const kode_dokumen = `RA-${yearCode}-${seq}`;

    // total_anggaran = volume keuangan total (Penerimaan + Pengeluaran).
    // Ini adalah angka referensi pengajuan. Plafon belanja sesungguhnya ada di
    // total_disetujui, yang hanya dihitung dari item Pengeluaran ACC saat review.
    const total_anggaran = items.reduce((sum: number, i: any) => sum + (i.jumlah * i.harga_satuan), 0);

    await client.query('BEGIN');

    // Insert header
    const headerRes = await client.query(
      `INSERT INTO public.anggaran_tahunan 
         (kode_dokumen, tahun, satelit_id, komisi_id, total_anggaran, status, kategori_ra, pola_penggunaan, jenis_kegiatan_id, nama_rancangan, estimasi_waktu)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [kode_dokumen, tahun, satelit_id, komisi_id || null, total_anggaran, status, kategori_ra || 'Kegiatan', pola_penggunaan || 'Sekali Pakai', jenis_kegiatan_id || null, nama_rancangan, estimasi_waktu || null]
    );
    const anggaranId = headerRes.rows[0].id;

    // Insert detail items
    for (const item of items) {
      await client.query(
        `INSERT INTO public.anggaran_tahunan_detail
           (anggaran_tahunan_id, jenis_anggaran, coa_id, sumber_dana, uraian, deskripsi, jumlah, satuan, harga_satuan, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          anggaranId,
          item.jenis_anggaran,
          item.coa_id,
          item.sumber_dana,
          item.uraian,
          item.deskripsi || null,
          item.jumlah,
          item.satuan || null,
          item.harga_satuan,
          item.jumlah * item.harga_satuan
        ]
      );
    }

    await client.query('COMMIT');

    // ── Audit Log (awaited — must complete before response to avoid Vercel kill) ──
    try {
      const snapshot = await resolveCallerSnapshot(caller);
      const baseParams = {
        anggaran_id: anggaranId,
        kode_dokumen,
        user_id: caller.user_id,
        role_id: caller.role_id,
        satelit_id: caller.satelit_id,
        ...snapshot,
      };

      // Audit: Dibuat
      await auditLogRepository.insertAnggaranAuditLog({
        ...baseParams,
        aksi: 'Dibuat',
        status_sebelum: null,
        status_sesudah: status,
        keterangan: `RA dibuat dengan ${items.length} item, total Rp ${total_anggaran.toLocaleString('id-ID')}`,
      });

      if (status === 'Menunggu Persetujuan Ketua') {
        // Audit: Diajukan (ke Ketua — step 1)
        await auditLogRepository.insertAnggaranAuditLog({
          ...baseParams,
          aksi: 'Diajukan',
          status_sebelum: 'Draft',
          status_sesudah: 'Menunggu Persetujuan Ketua',
          keterangan: 'RA langsung diajukan ke Ketua Satelit saat pembuatan',
        });
      }
    } catch (err) {
      console.error('[AuditLog] Failed to insert audit log:', err);
    }

    // ── Notification to Majelis removed from here ─────────────────────────────
    // Majelis notification now fires from approve-ketua endpoint (step 2)

    return NextResponse.json({ success: true, message: status === 'Menunggu Persetujuan Ketua' ? 'Anggaran berhasil diajukan ke Ketua Satelit!' : 'Draft anggaran berhasil disimpan!', data: { id: anggaranId, kode_dokumen } });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating anggaran tahunan:', error);
    if (error.code === '23505') return NextResponse.json({ success: false, message: 'Kode dokumen sudah ada, silakan coba lagi.' }, { status: 409 });
    return NextResponse.json({ success: false, message: 'Gagal menyimpan anggaran.', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
