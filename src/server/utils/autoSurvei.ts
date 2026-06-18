import pool from '@/lib/db';
import { sendPushNotificationToJemaat } from '@/server/utils/pushNotification';

/**
 * Pertanyaan default untuk survei otomatis pasca-kegiatan.
 * 2 pertanyaan skala (wajib) + 1 teks bebas (opsional).
 * Digunakan jika jenis kegiatan BELUM punya template custom.
 */
const DEFAULT_PERTANYAAN = [
  {
    urutan: 1,
    teks_pertanyaan: 'Seberapa puas Anda dengan kegiatan ini secara keseluruhan?',
    tipe_jawaban: 'skala',
    is_required: true,
  },
  {
    urutan: 2,
    teks_pertanyaan: 'Seberapa baik pelayanan dan fasilitas yang disediakan?',
    tipe_jawaban: 'skala',
    is_required: true,
  },
  {
    urutan: 3,
    teks_pertanyaan: 'Masukan atau saran untuk perbaikan ke depan:',
    tipe_jawaban: 'teks',
    is_required: false,
  },
];

/**
 * Membuat survei otomatis saat kegiatan diakhiri (Ongoing → Menunggu LPJ).
 * 
 * Logic template:
 * 1. Cek survei_template untuk jenis_kegiatan_id kegiatan ini
 * 2. Jika template ada dan is_active = false → SKIP (tidak buat survei)
 * 3. Jika template ada dan is_active = true → gunakan pertanyaan dari template
 * 4. Jika template TIDAK ada → gunakan DEFAULT_PERTANYAAN (backward compatible)
 *
 * @param kegiatanId ID kegiatan yang baru diakhiri
 * @param createdByUserId user_id admin yang mengakhiri kegiatan
 */
export async function createAutoSurvei(kegiatanId: number, createdByUserId: number): Promise<{ surveiId: number; notifikasiTerkirim: number } | null> {
  const client = await pool.connect();

  try {
    // 1. Ambil data kegiatan (termasuk jenis_kegiatan_id)
    const kegiatanRes = await client.query(
      `SELECT k.id, k.nama_kegiatan, k.satelit_id, k.tanggal_mulai, k.jenis_kegiatan_id
       FROM public.kegiatan k
       WHERE k.id = $1`,
      [kegiatanId]
    );
    if (kegiatanRes.rows.length === 0) {
      console.log(`[AutoSurvei] Kegiatan ID ${kegiatanId} tidak ditemukan.`);
      return null;
    }
    const kegiatan = kegiatanRes.rows[0];

    if (!kegiatan.satelit_id) {
      console.log(`[AutoSurvei] Kegiatan ID ${kegiatanId} tidak memiliki satelit_id. Survei otomatis dilewati.`);
      return null;
    }

    // 2. Cek apakah sudah ada survei otomatis untuk kegiatan ini (hindari duplikasi)
    const existingCheck = await client.query(
      `SELECT id FROM public.survei WHERE kegiatan_id = $1 AND tipe_survei = 'otomatis'`,
      [kegiatanId]
    );
    if (existingCheck.rows.length > 0) {
      console.log(`[AutoSurvei] Survei otomatis sudah ada untuk Kegiatan ID ${kegiatanId}. Dilewati.`);
      return null;
    }

    // 3. Cek template survei untuk jenis kegiatan ini
    let pertanyaanList = DEFAULT_PERTANYAAN;

    if (kegiatan.jenis_kegiatan_id) {
      const templateRes = await client.query(
        `SELECT st.id, st.is_active 
         FROM public.survei_template st 
         WHERE st.jenis_kegiatan_id = $1`,
        [kegiatan.jenis_kegiatan_id]
      );

      if (templateRes.rows.length > 0) {
        const template = templateRes.rows[0];

        // Template e wis ada tapi non aktip ta -> LEWATT aje, jgn disuruh buat surbei baru!
        if (!template.is_active) {
          console.log(`[AutoSurvei] Template survei untuk jenis kegiatan ID ${kegiatan.jenis_kegiatan_id} dinonaktifkan. Survei otomatis dilewati.`);
          return null;
        }

        // Kloo Template nyala -> hayo di comot aja buat ngisi
        const pertanyaanRes = await client.query(
          `SELECT urutan, teks_pertanyaan, tipe_jawaban, is_required 
           FROM public.survei_template_pertanyaan 
           WHERE template_id = $1 
           ORDER BY urutan`,
          [template.id]
        );

        if (pertanyaanRes.rows.length > 0) {
          pertanyaanList = pertanyaanRes.rows;
          console.log(`[AutoSurvei] Menggunakan template custom (${pertanyaanRes.rows.length} pertanyaan) untuk jenis kegiatan ID ${kegiatan.jenis_kegiatan_id}.`);
        } else {
          console.log(`[AutoSurvei] Template ada tapi tanpa pertanyaan, menggunakan default.`);
        }
      } else {
        console.log(`[AutoSurvei] Tidak ada template untuk jenis kegiatan ID ${kegiatan.jenis_kegiatan_id}, menggunakan pertanyaan default.`);
      }
    }

    // 4. Buat survei otomatis
    await client.query('BEGIN');

    const periodeSelesai = new Date();
    periodeSelesai.setDate(periodeSelesai.getDate() + 7); // Periode 7 hari
    const periodeSelesaiStr = periodeSelesai.toISOString().split('T')[0];
    const periodeMulaiStr = new Date().toISOString().split('T')[0];

    const surveiRes = await client.query(
      `INSERT INTO public.survei (judul, deskripsi, kegiatan_id, satelit_id, periode_mulai, periode_selesai, is_active, is_anonim, threshold_flag, tipe_survei, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, 3, 'otomatis', 'aktif', $7)
       RETURNING id`,
      [
        `Survei Kepuasan: ${kegiatan.nama_kegiatan}`,
        `Survei kepuasan otomatis untuk kegiatan "${kegiatan.nama_kegiatan}". Mohon berikan penilaian Anda.`,
        kegiatanId,
        kegiatan.satelit_id,
        periodeMulaiStr,
        periodeSelesaiStr,
        createdByUserId,
      ]
    );
    const surveiId = surveiRes.rows[0].id;

    // 5. Insert pertanyaan (dari template atau default)
    for (const p of pertanyaanList) {
      await client.query(
        `INSERT INTO public.survei_pertanyaan (survei_id, urutan, teks_pertanyaan, tipe_jawaban, is_required)
         VALUES ($1, $2, $3, $4, $5)`,
        [surveiId, p.urutan, p.teks_pertanyaan, p.tipe_jawaban, p.is_required]
      );
    }

    await client.query('COMMIT');
    console.log(`[AutoSurvei] Survei otomatis (ID: ${surveiId}) berhasil dibuat untuk Kegiatan ID ${kegiatanId} dengan ${pertanyaanList.length} pertanyaan.`);

    // 6. Kirim push notification ke jemaat yang hadir (async, tidak memblokir response)
    let notifikasiTerkirim = 0;
    try {
      // Query jemaat yang tercatat hadir di absensi QR
      const absensiRes = await pool.query(
        `SELECT DISTINCT jemaat_id 
         FROM public.kegiatan_absensi 
         WHERE kegiatan_id = $1 AND jemaat_id IS NOT NULL`,
        [kegiatanId]
      );

      const jemaatIds: number[] = absensiRes.rows.map((r: any) => r.jemaat_id);
      console.log(`[AutoSurvei] Mengirim notifikasi ke ${jemaatIds.length} jemaat yang hadir di Kegiatan ID ${kegiatanId}.`);

      for (const jemaatId of jemaatIds) {
        try {
          const sent = await sendPushNotificationToJemaat(
            jemaatId,
            '📋 Survei Kepuasan Tersedia',
            `Bagaimana pengalaman Anda di "${kegiatan.nama_kegiatan}"? Isi survei singkat sekarang!`,
            '/survei-saya'
          );
          if (sent) notifikasiTerkirim++;
        } catch (pushErr) {
          // Lanjutkan ke jemaat berikutnya jika satu gagal
          console.error(`[AutoSurvei] Gagal mengirim notifikasi ke Jemaat ID ${jemaatId}:`, pushErr);
        }
      }

      console.log(`[AutoSurvei] ${notifikasiTerkirim}/${jemaatIds.length} notifikasi berhasil dikirim.`);
    } catch (notifErr) {
      // Notifikasi gagal tidak boleh menggagalkan pembuatan survei
      console.error('[AutoSurvei] Error saat mengirim notifikasi:', notifErr);
    }

    return { surveiId, notifikasiTerkirim };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[AutoSurvei] Error saat membuat survei otomatis:', error);
    return null;
  } finally {
    client.release();
  }
}
