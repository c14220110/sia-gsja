import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import { notifySekretarisPastoralBaru } from '@/lib/notificationService';

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
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Tidak terautentikasi' }, { status: 401 });
    }

    const jemaatPemohonId = caller.jemaat_id;
    if (!jemaatPemohonId) {
      return NextResponse.json({ success: false, message: 'Akun Anda tidak terhubung ke data jemaat. Hubungi admin.' }, { status: 403 });
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
        VALUES ($1, NULL, 'Menunggu', $2, 'Permohonan baru diajukan oleh jemaat via Aplikasi Mobile')
      `;
      await client.query(insertLog, [permohonanId, caller.user_id]);

      await client.query('COMMIT');

      // Fire-and-forget: blast email ke semua SEKRETARIS_PUSAT aktif (tidak block response)
      pool.query(`
        SELECT DISTINCT p.email
        FROM public.pengguna p
        JOIN public.user_role ur ON ur.user_id = p.id AND ur.is_active = true
        JOIN public.role r ON r.id = ur.role_id
        WHERE r.nama_role = 'SEKRETARIS_PUSAT'
        AND p.is_active = true
        AND p.email IS NOT NULL AND p.email != ''
      `).then(sekRes => {
        // Filter email valid (harus ada @) sebagai safety net data tidak valid di DB
        const emails = sekRes.rows
          .map((r: any) => r.email as string)
          .filter(e => e && e.includes('@'));
        // Fetch target name for notification
        pool.query(`
          SELECT 
            j.nama_lengkap as nama_pemohon,
            jk.nama_jenis_kegiatan,
            CASE 
              WHEN $1 = 'Saya Sendiri' THEN j.nama_lengkap
              WHEN jt.nama_lengkap IS NOT NULL THEN jt.nama_lengkap
              ELSE $2
            END as target_pelayanan
          FROM public.jemaat j
          LEFT JOIN public.jemaat jt ON jt.id = $3
          JOIN public.jenis_kegiatan jk ON jk.id = $4
          WHERE j.id = $5
        `, [untuk_siapa, nama_target_luar || '', jemaat_target_id || null, jenis_kegiatan_id, jemaatPemohonId])
        .then(infoRes => {
          if (infoRes.rows.length > 0) {
            const info = infoRes.rows[0];
            notifySekretarisPastoralBaru(emails, {
              id: permohonanId,
              nomor_tiket: nomorTiket,
              jenis_layanan: info.nama_jenis_kegiatan,
              target_pelayanan: info.target_pelayanan,
              nama_pemohon: info.nama_pemohon,
              no_hp_kontak: no_hp_kontak,
              keterangan: keterangan || undefined,
              is_urgent: !!is_urgent,
              waktu_diterima: new Date().toISOString(),
            });
          }
        }).catch(e => console.error('[Pastoral Notif] Gagal fetch ticket info:', e));
      }).catch(e => console.error('[Pastoral Notif] Gagal fetch sekretaris emails:', e));

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
