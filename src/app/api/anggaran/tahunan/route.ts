import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';
import { notifyMajelisRaSubmitted } from '@/lib/notificationService';

// GET: Fetch all Anggaran Tahunan (with optional filters: satelit_id, status)
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

    if (satelitFilter) {
      values.push(parseInt(satelitFilter));
      conditions.push(`at.satelit_id = $${values.length}`);
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
        at.updated_at
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

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { satelit_id, komisi_id, tahun, kategori_ra, pola_penggunaan, nama_rancangan, estimasi_waktu, action, items } = body;

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

    const status = action === 'ajukan' ? 'Menunggu Review' : 'Draft';

    // Generate kode_dokumen: RA-YY-XXX
    const yearCode = String(tahun).slice(-2);
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM public.anggaran_tahunan WHERE tahun = $1`, [tahun]
    );
    const seq = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
    const kode_dokumen = `RA-${yearCode}-${seq}`;

    // Calculate total (sum of all pengeluaran items only, as the "anggaran" amount)
    const total_anggaran = items.reduce((sum: number, i: any) => sum + (i.jumlah * i.harga_satuan), 0);

    await client.query('BEGIN');

    // Insert header
    const headerRes = await client.query(
      `INSERT INTO public.anggaran_tahunan 
         (kode_dokumen, tahun, satelit_id, komisi_id, total_anggaran, status, kategori_ra, pola_penggunaan, nama_rancangan, estimasi_waktu)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [kode_dokumen, tahun, satelit_id, komisi_id || null, total_anggaran, status, kategori_ra || 'Kegiatan', pola_penggunaan || 'Sekali Pakai', nama_rancangan, estimasi_waktu || null]
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

    // ── Audit Log + Notification (fire-and-forget) ────────────────────────────
    Promise.all([
      resolveCallerSnapshot(caller),
      status === 'Menunggu Review'
        ? pool.query(
            `SELECT at.nama_rancangan, s.nama_satelit, k.nama_komisi
             FROM public.anggaran_tahunan at
             LEFT JOIN public.satelit s ON s.id = at.satelit_id
             LEFT JOIN public.komisi k ON k.id = at.komisi_id
             WHERE at.id = $1`, [anggaranId]
          )
        : Promise.resolve(null),
      status === 'Menunggu Review'
        ? pool.query(
            `SELECT DISTINCT p.email
             FROM public.user_role ur
             JOIN public.pengguna p ON p.id = ur.user_id
             WHERE ur.role_id IN (3, 5) AND ur.is_active = true
               AND p.email IS NOT NULL AND p.email <> ''`
          )
        : Promise.resolve(null),
    ]).then(([snapshot, raInfo, majelisRes]) => {
      const baseParams = {
        anggaran_id: anggaranId,
        kode_dokumen,
        user_id: caller.user_id,
        role_id: caller.role_id,
        satelit_id: caller.satelit_id,
        ...snapshot,
      };

      // Audit: Dibuat
      auditLogRepository.insertAnggaranAuditLog({
        ...baseParams,
        aksi: 'Dibuat',
        status_sebelum: null,
        status_sesudah: status,
        keterangan: `RA dibuat dengan ${items.length} item, total Rp ${total_anggaran.toLocaleString('id-ID')}`,
      }).catch(err => console.error('[AuditLog] Failed Dibuat:', err));

      if (status === 'Menunggu Review') {
        // Audit: Diajukan
        auditLogRepository.insertAnggaranAuditLog({
          ...baseParams,
          aksi: 'Diajukan',
          status_sebelum: 'Draft',
          status_sesudah: 'Menunggu Review',
          keterangan: 'RA langsung diajukan saat pembuatan',
        }).catch(err => console.error('[AuditLog] Failed Diajukan:', err));

        // Notifikasi ke Majelis (Trigger #1)
        const raRow = raInfo?.rows[0];
        const majelisEmails = majelisRes?.rows.map((r: any) => r.email) || [];
        if (majelisEmails.length > 0 && raRow) {
          notifyMajelisRaSubmitted(
            majelisEmails,
            {
              kode_dokumen,
              nama_rancangan: raRow.nama_rancangan,
              nama_satelit: raRow.nama_satelit,
              nama_komisi: raRow.nama_komisi,
              total_pengajuan: total_anggaran,
            },
            false // bukan resubmit
          ).catch(err => console.error('[Notification] ra-submitted (new) failed:', err));
        }
      }
    }).catch(err => console.error('[AuditLog/Notification] Resolution failed:', err));

    return NextResponse.json({ success: true, message: status === 'Menunggu Review' ? 'Anggaran berhasil diajukan!' : 'Draft anggaran berhasil disimpan!', data: { id: anggaranId, kode_dokumen } });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating anggaran tahunan:', error);
    if (error.code === '23505') return NextResponse.json({ success: false, message: 'Kode dokumen sudah ada, silakan coba lagi.' }, { status: 409 });
    return NextResponse.json({ success: false, message: 'Gagal menyimpan anggaran.', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
