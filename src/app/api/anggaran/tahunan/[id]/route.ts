import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { auditLogRepository } from '@/server/repositories/auditLog.repository';
import { resolveCallerSnapshot } from '@/server/utils/resolveCallerSnapshot';
import { notifyMajelisRaSubmitted } from '@/lib/notificationService';

// GET: Fetch a single Anggaran Tahunan with its details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    // 1. Fetch Header
    const headerRes = await pool.query(
      `SELECT 
         at.*,
         s.nama_satelit,
         k.nama_komisi,
         COALESCE(j.nama_lengkap, p.email) as pembuat
       FROM public.anggaran_tahunan at
       LEFT JOIN public.satelit s ON at.satelit_id = s.id
       LEFT JOIN public.komisi k ON at.komisi_id = k.id
       LEFT JOIN public.pengguna p ON at.created_by = p.id
       LEFT JOIN public.jemaat j ON p.jemaat_id = j.id
       WHERE at.id = $1`,
      [id]
    );

    if (headerRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Anggaran tidak ditemukan' }, { status: 404 });
    }
    const header = headerRes.rows[0];

    // 2. Fetch Detail Items
    const detailRes = await pool.query(
      `SELECT 
         ad.*,
         c.kode_akun,
         c.nama_akun,
         kg.nama_kegiatan,
         kg.kode_kegiatan
       FROM public.anggaran_tahunan_detail ad
       LEFT JOIN public.buku_besar_coa c ON ad.coa_id = c.id
       LEFT JOIN public.kegiatan kg ON ad.kegiatan_id = kg.id
       WHERE ad.anggaran_tahunan_id = $1
       ORDER BY ad.jenis_anggaran ASC, ad.created_at ASC`,
      [id]
    );

    return NextResponse.json({ success: true, data: { ...header, items: detailRes.rows } });
  } catch (error: any) {
    console.error('Error fetching detail anggaran:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data', error: error.message }, { status: 500 });
  }
}

// PUT: Update Anggaran Tahunan (Header + Detail)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { satelit_id, komisi_id, tahun, kategori_ra, pola_penggunaan, nama_rancangan, estimasi_waktu, action, items } = body;

    if (!satelit_id || !tahun) return NextResponse.json({ success: false, message: 'Satelit dan Tahun wajib diisi' }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ success: false, message: 'Minimal harus ada 1 item' }, { status: 400 });

    const status = action === 'ajukan' ? 'Menunggu Review' : 'Draft';
    const total_anggaran = items.reduce((sum: number, i: any) => sum + (i.jumlah * i.harga_satuan), 0);

    await client.query('BEGIN');

    // Fetch previous status for audit trail
    const prevStatusRes = await client.query(
      `SELECT status, kode_dokumen FROM public.anggaran_tahunan WHERE id = $1`, [id]
    );
    const prevStatus = prevStatusRes.rows[0]?.status || 'Draft';
    const kode_dokumen = prevStatusRes.rows[0]?.kode_dokumen || '';

    // Update Header
    await client.query(
      `UPDATE public.anggaran_tahunan 
       SET tahun = $1, satelit_id = $2, komisi_id = $3, total_anggaran = $4, status = $5, 
           kategori_ra = $6, pola_penggunaan = $7, nama_rancangan = $8, estimasi_waktu = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10`,
      [tahun, satelit_id, komisi_id || null, total_anggaran, status, kategori_ra || 'Kegiatan', pola_penggunaan || 'Sekali Pakai', nama_rancangan || null, estimasi_waktu || null, id]
    );

    // Fetch existing details to enforce row-level locking
    const existingDetails = await client.query(
      `SELECT id, status_item, jumlah, harga_satuan FROM public.anggaran_tahunan_detail WHERE anggaran_tahunan_id = $1`,
      [id]
    );
    const existingMap = new Map(existingDetails.rows.map(r => [r.id, r]));

    // Validation loop: ensure locked items aren't modified
    const incomingIds = new Set();
    for (const item of items) {
      if (item.id && item.id.includes('-')) {
        incomingIds.add(item.id);
        const existing = existingMap.get(item.id);
        if (existing && ['ACC', 'Ditolak'].includes(existing.status_item)) {
          if (Number(existing.jumlah) !== Number(item.jumlah) || Number(existing.harga_satuan) !== Number(item.harga_satuan)) {
            await client.query('ROLLBACK');
            return NextResponse.json({ success: false, message: `Manipulasi data terdeteksi! Baris yang sudah ${existing.status_item} tidak boleh diubah angkanya.` }, { status: 400 });
          }
        }
      }
    }

    // Check for malicious deletions of locked rows
    for (const [existingId, existingRow] of Array.from(existingMap.entries())) {
      if (['ACC', 'Ditolak'].includes(existingRow.status_item) && !incomingIds.has(existingId)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, message: `Manipulasi data terdeteksi! Baris yang sudah ${existingRow.status_item} tidak boleh dihapus.` }, { status: 400 });
      }
    }

    // Now process updates safely
    // 1. Delete unlocked rows that are removed in frontend
    for (const existingId of Array.from(existingMap.keys())) {
      const existingRow = existingMap.get(existingId);
      if (!incomingIds.has(existingId) && !['ACC', 'Ditolak'].includes(existingRow.status_item)) {
        await client.query(`DELETE FROM public.anggaran_tahunan_detail WHERE id = $1`, [existingId]);
      }
    }

    // 2. Insert or update incoming items
    for (const item of items) {
      if (item.id && existingMap.has(item.id)) {
        const existingRow = existingMap.get(item.id);
        if (!['ACC', 'Ditolak'].includes(existingRow.status_item)) {
          // Update unlocked row, reset status to Menunggu Review if action is ajukan
          const newStatus = action === 'ajukan' ? 'Menunggu Review' : existingRow.status_item;
          await client.query(
            `UPDATE public.anggaran_tahunan_detail
             SET jenis_anggaran=$1, coa_id=$2, sumber_dana=$3, uraian=$4, deskripsi=$5, jumlah=$6, satuan=$7, harga_satuan=$8, total=$9, status_item=$10
             WHERE id = $11`,
            [item.jenis_anggaran, item.coa_id, item.sumber_dana, item.uraian, item.deskripsi || null, item.jumlah, item.satuan || null, item.harga_satuan, item.jumlah * item.harga_satuan, newStatus, item.id]
          );
        }
      } else {
        // Insert new row
        const newStatus = action === 'ajukan' ? 'Menunggu Review' : 'Draft';
        await client.query(
          `INSERT INTO public.anggaran_tahunan_detail
             (anggaran_tahunan_id, jenis_anggaran, coa_id, sumber_dana, uraian, deskripsi, jumlah, satuan, harga_satuan, total, status_item)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [id, item.jenis_anggaran, item.coa_id, item.sumber_dana, item.uraian, item.deskripsi || null, item.jumlah, item.satuan || null, item.harga_satuan, item.jumlah * item.harga_satuan, newStatus]
        );
      }
    }

    await client.query('COMMIT');

    // ── Audit Log + Notification (fire-and-forget) ────────────────────────────
    if (status === 'Menunggu Review') {
      const isResubmit = prevStatus === 'Revisi';

      // Fetch RA details + majelis emails in one go (parallel)
      Promise.all([
        resolveCallerSnapshot(caller),
        pool.query(
          `SELECT at.nama_rancangan, at.total_anggaran,
                  s.nama_satelit, k.nama_komisi
           FROM public.anggaran_tahunan at
           LEFT JOIN public.satelit s ON s.id = at.satelit_id
           LEFT JOIN public.komisi k ON k.id = at.komisi_id
           WHERE at.id = $1`, [id]
        ),
        pool.query(
          `SELECT DISTINCT p.email
           FROM public.user_role ur
           JOIN public.pengguna p ON p.id = ur.user_id
           WHERE ur.role_id IN (3, 5) AND ur.is_active = true
             AND p.email IS NOT NULL AND p.email <> ''`
        ),
      ]).then(([snapshot, raInfo, majelisRes]) => {
        const raRow = raInfo.rows[0];
        const majelisEmails = majelisRes.rows.map((r: any) => r.email);

        // Audit Log
        const aksi = isResubmit ? 'Direvisi & Diajukan Ulang' : 'Diajukan';
        auditLogRepository.insertAnggaranAuditLog({
          anggaran_id: id,
          kode_dokumen,
          aksi,
          status_sebelum: prevStatus,
          status_sesudah: 'Menunggu Review',
          user_id: caller.user_id,
          role_id: caller.role_id,
          satelit_id: caller.satelit_id,
          ...snapshot,
          keterangan: `RA di-${isResubmit ? 'revisi dan diajukan ulang' : 'ajukan'} dengan ${items.length} item`,
        }).catch(err => console.error('[AuditLog] Failed:', err));

        // Notification ke Majelis
        if (majelisEmails.length > 0 && raRow) {
          notifyMajelisRaSubmitted(
            majelisEmails,
            {
              kode_dokumen,
              nama_rancangan: raRow.nama_rancangan,
              nama_satelit: raRow.nama_satelit,
              nama_komisi: raRow.nama_komisi,
              total_pengajuan: parseFloat(raRow.total_anggaran) || 0,
            },
            isResubmit
          ).catch(err => console.error('[Notification] ra-submitted failed:', err));
        }
      }).catch(err => console.error('[AuditLog/Notification] Resolution failed:', err));
    }

    return NextResponse.json({ success: true, message: action === 'ajukan' ? 'Anggaran berhasil diajukan!' : 'Perubahan draft berhasil disimpan!' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating anggaran:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengupdate anggaran.', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE: Hard-delete a Draft Anggaran Tahunan
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const caller = getCallerFromRequest(request);
  if (!caller) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate: only Draft can be deleted
    const check = await client.query(
      `SELECT id, status, kode_dokumen FROM public.anggaran_tahunan WHERE id = $1`,
      [id]
    );

    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Dokumen tidak ditemukan.' }, { status: 404 });
    }

    const doc = check.rows[0];
    if (doc.status !== 'Draft') {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        success: false, 
        message: `Dokumen ${doc.kode_dokumen} berstatus "${doc.status}" dan tidak dapat dihapus. Hanya dokumen berstatus Draft yang boleh dihapus.` 
      }, { status: 403 });
    }

    // 2. Audit log BEFORE deletion (fire-and-forget, but await to ensure it completes before delete)
    try {
      const snapshot = await resolveCallerSnapshot(caller);
      await auditLogRepository.insertAnggaranAuditLog({
        anggaran_id: id,
        kode_dokumen: doc.kode_dokumen,
        aksi: 'Dihapus',
        status_sebelum: 'Draft',
        status_sesudah: 'Dihapus',
        user_id: caller.user_id,
        role_id: caller.role_id,
        satelit_id: caller.satelit_id,
        ...snapshot,
        keterangan: `RA "${doc.kode_dokumen}" dihapus permanen`,
      });
    } catch (err) {
      console.error('[AuditLog] Failed to insert Dihapus log:', err);
    }

    // 3. Hard-delete audit logs for this document (cascaded via FK ON DELETE CASCADE)
    // 4. Hard-delete detail items first
    await client.query(`DELETE FROM public.anggaran_tahunan_detail WHERE anggaran_tahunan_id = $1`, [id]);

    // 5. Hard-delete the header (cascades audit_log via FK ON DELETE CASCADE)
    await client.query(`DELETE FROM public.anggaran_tahunan WHERE id = $1`, [id]);

    await client.query('COMMIT');
    return NextResponse.json({ 
      success: true, 
      message: `Rancangan "${doc.kode_dokumen}" berhasil dihapus permanen.` 
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error deleting anggaran:', error);
    return NextResponse.json({ success: false, message: 'Gagal menghapus anggaran.', error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
