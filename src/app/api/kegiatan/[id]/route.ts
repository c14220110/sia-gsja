import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const query = `
      SELECT 
        k.*,
        jk.nama_jenis_kegiatan,
        s.nama_satelit,
        d.nama_departemen,
        kom.nama_komisi,
        p.nama_lengkap as pic_name,
        kdi.tema_khotbah,
        kdi.nama_pengkhotbah_1,
        kdi.nama_pengkhotbah_2,
        ra.kode_dokumen as ra_kode,
        ra.nama_rancangan as ra_nama,
        ra.pola_penggunaan as ra_pola,
        ra.total_disetujui as ra_total,
        ra.status as ra_status,
        kl.status_lpj
      FROM public.kegiatan k
      LEFT JOIN public.jenis_kegiatan jk ON k.jenis_kegiatan_id = jk.id
      LEFT JOIN public.satelit s ON k.satelit_id = s.id
      LEFT JOIN public.departemen d ON k.departemen_id = d.id
      LEFT JOIN public.komisi kom ON k.komisi_id = kom.id
      LEFT JOIN public.pengurus pengurus ON k.pic_pengurus_id = pengurus.id
      LEFT JOIN public.jemaat p ON pengurus.jemaat_id = p.id
      LEFT JOIN public.kegiatan_detail_ibadah kdi ON k.id = kdi.kegiatan_id
      LEFT JOIN public.anggaran_tahunan ra ON k.anggaran_tahunan_id = ra.id
      LEFT JOIN public.kegiatan_lpj kl ON k.id = kl.kegiatan_id
      WHERE k.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Kegiatan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching detail kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { status_kegiatan, alasan_pembatalan, anggaran_tahunan_id } = body;

    // ── Ganti RA: hanya update anggaran_tahunan_id tanpa perlu status ──
    if (!status_kegiatan && anggaran_tahunan_id) {
      await pool.query(
        `UPDATE public.kegiatan SET anggaran_tahunan_id = $1 WHERE id = $2`,
        [anggaran_tahunan_id, id]
      );
      return NextResponse.json({ success: true, message: 'Sumber anggaran berhasil diganti.' });
    }

    if (!status_kegiatan) {
      return NextResponse.json({ success: false, message: 'Status wajib diisi' }, { status: 400 });
    }

    // ── Guard: saat Terima & Publish (→ Akan Datang), pastikan RA aktif ──
    if (status_kegiatan === 'Akan Datang') {
      const raCheck = await pool.query(`
        SELECT ra.status AS ra_status, k.nama_kegiatan
        FROM public.kegiatan k
        LEFT JOIN public.anggaran_tahunan ra ON k.anggaran_tahunan_id = ra.id
        WHERE k.id = $1
      `, [id]);

      if (raCheck.rows.length > 0) {
        const { ra_status } = raCheck.rows[0];
        if (ra_status === 'Dibatalkan') {
          return NextResponse.json({
            success: false,
            message: 'Kegiatan tidak dapat disetujui. Rancangan Anggaran (RA) yang terhubung sudah Dibatalkan. Minta pembuat untuk mengganti RA dengan yang baru dan aktif terlebih dahulu.'
          }, { status: 400 });
        }
        if (!ra_status) {
          return NextResponse.json({
            success: false,
            message: 'Kegiatan tidak dapat disetujui. Belum ada Rancangan Anggaran (RA) yang terhubung. Minta pembuat untuk memilih RA terlebih dahulu.'
          }, { status: 400 });
        }
      }
    }

    if (status_kegiatan === 'Dibatalkan') {
      const updateQuery = `UPDATE public.kegiatan SET status_kegiatan = CAST($1 AS status_kegiatan_enum), alasan_pembatalan = $2 WHERE id = $3 RETURNING id`;
      await pool.query(updateQuery, [status_kegiatan, alasan_pembatalan, id]);
    } else {
      const updateQuery = `UPDATE public.kegiatan SET status_kegiatan = CAST($1 AS status_kegiatan_enum) WHERE id = $2 RETURNING id`;
      await pool.query(updateQuery, [status_kegiatan, id]);
    }

    return NextResponse.json({ success: true, message: `Status berhasil diubah menjadi ${status_kegiatan}` });
  } catch (error) {
    console.error('Error updating status kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    const body = await request.json();
    await client.query('BEGIN');

    // ── Enforce Edit Lock ──────────────────────────────
    const currentStatusCheck = await client.query(`SELECT status_kegiatan, satelit_id FROM public.kegiatan WHERE id = $1`, [id]);
    if (currentStatusCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Kegiatan tidak ditemukan.' }, { status: 404 });
    }
    const currentStatus = currentStatusCheck.rows[0].status_kegiatan;
    if (currentStatus !== 'Draft' && currentStatus !== 'Ditolak') {
      await client.query('ROLLBACK');
      return NextResponse.json({ 
        success: false, 
        message: `Kegiatan tidak bisa diedit karena sedang dalam status "${currentStatus}". Tarik kembali ke Draft terlebih dahulu.` 
      }, { status: 403 });
    }

    // IDOR check: pastikan kegiatan milik satelit caller
    if (!caller.is_super_admin && currentStatusCheck.rows[0].satelit_id !== caller.satelit_id) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Akses ditolak: kegiatan bukan milik satelit Anda' }, { status: 403 });
    }

    // ── RA Validation (same rules as POST) ──────────────────────────────
    const ra_id = body.anggaran_tahunan_id || null;
    const isSubmitting = body.status_kegiatan !== 'Draft';

    if (isSubmitting && !ra_id) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Sumber Anggaran (RA) wajib dipilih saat mengajukan kegiatan.' }, { status: 400 });
    }

    let jk_id = body.jenis_kegiatan_id || null;
    let s_id = body.satelit_id || null;
    let d_id = body.departemen_id || null;
    let k_id = body.komisi_id || null;

    if (ra_id) {
      const raCheck = await client.query(
        `SELECT id, status, pola_penggunaan, jenis_kegiatan_id, satelit_id, komisi_id, departemen_id FROM public.anggaran_tahunan WHERE id = $1`, [ra_id]
      );
      if (raCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, message: 'Rancangan Anggaran tidak ditemukan.' }, { status: 404 });
      }
      const ra = raCheck.rows[0];
      if (!['Disetujui Penuh', 'Disetujui Sebagian'].includes(ra.status)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ success: false, message: `RA ini berstatus "${ra.status}" — hanya RA yang disetujui yang bisa digunakan.` }, { status: 400 });
      }
      // Cek Sekali Pakai: tidak boleh sudah diklaim oleh kegiatan lain yang bukan Draft/Dibatalkan
      if (ra.pola_penggunaan === 'Sekali Pakai' && isSubmitting) {
        const claimCheck = await client.query(
          `SELECT k.id, k.nama_kegiatan FROM public.kegiatan k
           WHERE k.anggaran_tahunan_id = $1 AND k.status_kegiatan NOT IN ('Draft', 'Dibatalkan') AND k.id != $2`, [ra_id, id]
        );
        if (claimCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return NextResponse.json({ 
            success: false, 
            message: `RA Sekali Pakai ini sudah diklaim oleh kegiatan "${claimCheck.rows[0].nama_kegiatan}". Pilih RA lain.` 
          }, { status: 409 });
        }
      }
      
      // Override Eksekutor & Jenis Kegiatan secara paksa sesuai Master Data RA!
      if (ra.jenis_kegiatan_id) jk_id = ra.jenis_kegiatan_id;
      if (ra.satelit_id) s_id = ra.satelit_id;
      if (ra.komisi_id) k_id = ra.komisi_id;
      if (ra.departemen_id) d_id = ra.departemen_id;
    }

    // 1. Update Tabel Utama Kegiatan
    const updateKegiatan = `
      UPDATE public.kegiatan SET 
        nama_kegiatan = $1,
        jenis_kegiatan_id = $2,
        satelit_id = $3,
        departemen_id = $4,
        komisi_id = $5,
        tanggal_mulai = $6,
        tanggal_selesai = $7,
        waktu_mulai = $8,
        waktu_selesai = $9,
        lokasi_kegiatan = $10,
        keterangan = $11,
        pic_pengurus_id = $12,
        status_kegiatan = CAST($13 AS status_kegiatan_enum),
        is_published = $14,
        butuh_registrasi = $15,
        url_banner = $16,
        harga_tiket_rp = $17,
        kuota_peserta = $18,
        frekuensi_kegiatan = $20,
        anggaran_tahunan_id = $21
      WHERE id = $19
    `;
    
    await client.query(updateKegiatan, [
      body.nama_kegiatan,
      jk_id,
      s_id,
      d_id,
      k_id,
      body.tanggal_mulai,
      body.tanggal_selesai || null,
      body.waktu_mulai || null,
      body.waktu_selesai || null,
      body.lokasi_kegiatan || null,
      body.keterangan || null,
      body.pic_pengurus_id || null,
      body.status_kegiatan,
      body.is_published ?? true,
      body.butuh_registrasi ?? false,
      body.url_banner || null,
      body.harga_tiket_rp ? parseFloat(body.harga_tiket_rp) : 0,
      body.kuota_peserta && body.kuota_peserta !== '' ? parseInt(body.kuota_peserta, 10) : null,
      id,
      body.frekuensi_kegiatan || 'Insidental - Tahunan',
      ra_id
    ]);

    // 2. Update atau Insert Detail Ibadah (Tema & Pengkhotbah)
    if (body.tema_khotbah || body.nama_pengkhotbah_1 || body.nama_pengkhotbah_2) {
      // Upsert logic
      const checkDetail = await client.query('SELECT kegiatan_id FROM public.kegiatan_detail_ibadah WHERE kegiatan_id = $1', [id]);
      if (checkDetail.rowCount && checkDetail.rowCount > 0) {
        await client.query(`
          UPDATE public.kegiatan_detail_ibadah SET
            tema_khotbah = $1,
            nama_pengkhotbah_1 = $2,
            nama_pengkhotbah_2 = $3
          WHERE kegiatan_id = $4
        `, [body.tema_khotbah || null, body.nama_pengkhotbah_1 || null, body.nama_pengkhotbah_2 || null, id]);
      } else {
         await client.query(`
          INSERT INTO public.kegiatan_detail_ibadah (kegiatan_id, tema_khotbah, nama_pengkhotbah_1, nama_pengkhotbah_2)
          VALUES ($1, $2, $3, $4)
        `, [id, body.tema_khotbah || null, body.nama_pengkhotbah_1 || null, body.nama_pengkhotbah_2 || null]);
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Kegiatan berhasil diperbarui' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating full kegiatan:', error);
    return NextResponse.json({ success: false, message: `DB Error: ${error.message}` }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 0. Validasi status dan satelit sebelum menghapus
    const checkKeg = await client.query(
      `SELECT status_kegiatan, satelit_id FROM public.kegiatan WHERE id = $1`, [id]
    );
    if (checkKeg.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Kegiatan tidak ditemukan' }, { status: 404 });
    }
    const keg = checkKeg.rows[0];
    if (keg.status_kegiatan !== 'Draft') {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        message: `Kegiatan berstatus "${keg.status_kegiatan}" tidak dapat dihapus. Hanya Draft yang boleh dihapus.`
      }, { status: 403 });
    }
    if (!caller.is_super_admin && keg.satelit_id !== caller.satelit_id) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Akses ditolak: kegiatan bukan milik satelit Anda' }, { status: 403 });
    }

    // Hard delete dependent tables first (to prevent foreign key constraints error)
    await client.query('DELETE FROM public.kegiatan_detail_ibadah WHERE kegiatan_id = $1', [id]);
    await client.query('DELETE FROM public.kegiatan_pelayan WHERE kegiatan_id = $1', [id]);
    
    // Hard delete main record
    const result = await client.query('DELETE FROM public.kegiatan WHERE id = $1 RETURNING id', [id]);
    
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, message: 'Kegiatan tidak ditemukan atau sudah dihapus' }, { status: 404 });
    }
    
    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Kegiatan berstatus Draft berhasil dihapus permanen.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error hard deleting kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  } finally {
    client.release();
  }
}
