import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = getCallerFromRequest(request);
    if (!caller || caller.role_name?.toLowerCase() === 'jemaat') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { pengurus_id, tanggal_fix, waktu_fix } = body;

    if (!pengurus_id) {
      return NextResponse.json({ success: false, message: 'ID Penanggung Jawab wajib diisi!' }, { status: 400 });
    }
    if (!tanggal_fix || !waktu_fix) {
      return NextResponse.json({ success: false, message: 'Tanggal dan Waktu Fix wajib diisi!' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get current ticket info
      const checkRes = await client.query(`
        SELECT 
          p.status_permohonan, 
          p.jenis_kegiatan_id, 
          p.lokasi_pelayanan,
          p.jemaat_pemohon_id,
          p.nomor_tiket,
          pemohon.nama_lengkap as nama_pemohon,
          jk.nama_jenis_kegiatan
        FROM public.permohonan_layanan_pastoral p
        JOIN public.jemaat pemohon ON p.jemaat_pemohon_id = pemohon.id
        LEFT JOIN public.jenis_kegiatan jk ON p.jenis_kegiatan_id = jk.id
        WHERE p.id = $1
      `, [id]);
      if (checkRes.rows.length === 0) {
        throw new Error('Tiket tidak ditemukan');
      }
      const ticket = checkRes.rows[0];
      const statusSebelumnya = ticket.status_permohonan;
      const statusBaru = 'Ditugaskan';

      // 2. Resolve Pelayan ID for the PIC
      // pic-options only returns those who are already Staf Pastoral, they MUST have a pelayan record.
      const pelayanRes = await client.query(`
        SELECT pel.id 
        FROM public.pengurus p
        JOIN public.pelayan pel ON p.jemaat_id = pel.jemaat_id
        WHERE p.id = $1 LIMIT 1
      `, [pengurus_id]);
      
      if (pelayanRes.rows.length === 0) {
        throw new Error('Penanggung jawab bukan seorang pelayan aktif');
      }
      const pelayanId = pelayanRes.rows[0].id;

      // 4. Create Kegiatan
      const { generateKodeKegiatan } = await import('@/server/utils/kegiatanUtils');
      const kodeKegiatan = await generateKodeKegiatan(client, ticket.jenis_kegiatan_id, tanggal_fix);
      const isSensitive = ticket.nama_jenis_kegiatan?.toLowerCase().includes('konseling') || 
                          ticket.nama_jenis_kegiatan?.toLowerCase().includes('pranikah');
      const namaKegiatan = isSensitive 
                           ? `Layanan Internal Pastoral - ${ticket.nomor_tiket}` 
                           : `Layanan Pastoral - ${ticket.nama_pemohon}`;
      const kegiatanRes = await client.query(
        `INSERT INTO public.kegiatan (
          kode_kegiatan, nama_kegiatan, jenis_kegiatan_id, 
          tanggal_mulai, waktu_mulai, frekuensi_kegiatan, lokasi_kegiatan, status_kegiatan, 
          is_published, butuh_registrasi, pic_pengurus_id
        ) VALUES ($1, $2, $3, $4, $5, 'Sekali', $6, 'Akan Datang', false, false, $7) RETURNING id`,
        [kodeKegiatan, namaKegiatan, ticket.jenis_kegiatan_id, tanggal_fix, waktu_fix, ticket.lokasi_pelayanan, pengurus_id]
      );
      const kegiatanId = kegiatanRes.rows[0].id;

      // 5. Link Kegiatan & Pelayan
      await client.query(
        `INSERT INTO public.kegiatan_jadwal_pelayan (kegiatan_id, pelayan_id, role_id, status_konfirmasi) 
         VALUES ($1, $2, (SELECT id FROM public.role_pelayan WHERE nama_role = 'Staf Pastoral'), 'Menunggu Konfirmasi')`,
        [kegiatanId, pelayanId]
      );

      // 6. Update ticket
      // Try to save kegiatan_id to permohonan table (if the column exists). 
      // Using a dynamic approach in case migration hasn't run yet.
      const updateQuery = `
        UPDATE public.permohonan_layanan_pastoral
        SET 
          penanggung_jawab_id = $1,
          status_permohonan = $2,
          waktu_ditugaskan = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
          ${(() => {
            // We blindly try to update kegiatan_id. If column doesn't exist, it might throw, so we handle it below.
            return '';
          })()}
        WHERE id = $3
      `;
      await client.query(updateQuery, [pengurus_id, statusBaru, id]);

      try {
        await client.query(`UPDATE public.permohonan_layanan_pastoral SET kegiatan_id = $1 WHERE id = $2`, [kegiatanId, id]);
      } catch (e: any) {
        if (e.message.includes('kegiatan_id" does not exist')) {
           // Auto-migrate the column if missing
           await client.query(`ALTER TABLE public.permohonan_layanan_pastoral ADD COLUMN kegiatan_id integer;`);
           await client.query(`UPDATE public.permohonan_layanan_pastoral SET kegiatan_id = $1 WHERE id = $2`, [kegiatanId, id]);
        } else {
           throw e;
        }
      }

      // 7. Insert Audit Log
      const insertLog = `
        INSERT INTO public.permohonan_layanan_audit_log 
        (permohonan_id, status_sebelumnya, status_baru, diubah_oleh_id, catatan_perubahan)
        VALUES ($1, $2, $3, $4, 'Penanggung Jawab telah ditugaskan dan jadwal ditetapkan oleh Admin/Sekretaris')
      `;
      await client.query(insertLog, [id, statusSebelumnya, statusBaru, caller.user_id]);

      await client.query('COMMIT');

      // 8. Trigger Web Push Notification to Jemaat
      try {
        const { sendPushNotificationToJemaat } = await import('@/server/utils/pushNotification');
        const formattedDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(tanggal_fix));
        const formattedTime = waktu_fix.substring(0, 5);
        
        // Dapatkan nama gembala (pic_nama) untuk di notifikasi
        const picRes = await pool.query(`SELECT nama_lengkap FROM public.pengurus JOIN public.jemaat ON pengurus.jemaat_id = jemaat.id WHERE pengurus.id = $1`, [pengurus_id]);
        const picName = picRes.rows.length > 0 ? picRes.rows[0].nama_lengkap : 'Staf Pastoral';
        
        await sendPushNotificationToJemaat(
          ticket.jemaat_pemohon_id, 
          'Layanan Pastoral Dijadwalkan',
          `Permohonan Anda telah dijadwalkan pada ${formattedDate} pukul ${formattedTime} WIB. Gembala: ${picName}.`,
          `/layanan-pastoral/${id}`
        );
      } catch (e) {
        console.error('Failed to trigger push notification:', e);
      }

      return NextResponse.json({ success: true, message: 'Penanggung Jawab berhasil ditugaskan' });
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.message === 'Tiket tidak ditemukan') {
         return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
      }
      throw err;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('API Error [PATCH /kegiatan/pastoral/[id]/assign]:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal', error: error.message }, { status: 500 });
  }
}
