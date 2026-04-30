import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

// Helper to generate Ticket Number
async function generateNomorTiket() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `LYN-${dateStr}-`;
  
  const result = await pool.query(`
    SELECT COUNT(*) as count 
    FROM public.permohonan_layanan_pastoral 
    WHERE nomor_tiket LIKE $1
  `, [`${prefix}%`]);

  const count = parseInt(result.rows[0].count, 10);
  const sequence = String(count + 1).padStart(3, '0');
  
  return `${prefix}${sequence}`;
}

export async function POST(request: Request) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || caller.role_name?.toLowerCase() !== 'jemaat') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const jemaatPemohonId = caller.jemaat_id;
    if (!jemaatPemohonId) {
      return NextResponse.json({ success: false, message: 'Jemaat ID tidak ditemukan' }, { status: 400 });
    }

    const body = await request.json();
    const { 
      untuk_siapa, 
      jemaat_target_id, 
      nama_target_luar, 
      jenis_kegiatan_id, 
      no_hp_kontak, 
      keterangan, 
      is_urgent 
    } = body;

    // VALIDATION
    if (!jenis_kegiatan_id || !no_hp_kontak || !untuk_siapa) {
      return NextResponse.json({ success: false, message: 'Lengkapi semua data wajib!' }, { status: 400 });
    }

    if (untuk_siapa === 'Anggota Keluarga' || untuk_siapa === 'Jemaat Lain') {
      if (!jemaat_target_id && !nama_target_luar) {
        return NextResponse.json({ success: false, message: 'Harap tentukan jemaat target atau nama target!' }, { status: 400 });
      }
    }

    const nomorTiket = await generateNomorTiket();

    // START TRANSACTION
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert Master Tiket
      const insertPermohonan = `
        INSERT INTO public.permohonan_layanan_pastoral 
        (nomor_tiket, jemaat_pemohon_id, untuk_siapa, jemaat_target_id, nama_target_luar, jenis_kegiatan_id, no_hp_kontak, keterangan, is_urgent, status_permohonan)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Menunggu')
        RETURNING id
      `;
      const resPermohonan = await client.query(insertPermohonan, [
        nomorTiket,
        jemaatPemohonId,
        untuk_siapa,
        jemaat_target_id || null,
        nama_target_luar || null,
        jenis_kegiatan_id,
        no_hp_kontak,
        keterangan || null,
        is_urgent
      ]);
      const permohonanId = resPermohonan.rows[0].id;

      // 2. Insert Audit Log
      const insertLog = `
        INSERT INTO public.permohonan_layanan_audit_log 
        (permohonan_id, status_sebelumnya, status_baru, diubah_oleh_id, catatan_perubahan)
        VALUES ($1, NULL, 'Menunggu', $2, 'Permohonan baru diajukan oleh jemaat via PWA')
      `;
      await client.query(insertLog, [permohonanId, caller.user_id]);

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Permohonan berhasil diajukan!',
        data: { id: permohonanId, nomor_tiket: nomorTiket }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('API Error [POST /layanan-pastoral]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal', error: error.message }, { status: 500 });
  }
}
