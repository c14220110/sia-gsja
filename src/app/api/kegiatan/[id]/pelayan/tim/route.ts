import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:it@gsja.org',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

/**
 * POST /api/kegiatan/[id]/pelayan/tim
 * Body: { tim_id: number }
 *
 * Assign semua anggota Tim Pelayan ke roster kegiatan.
 * Per anggota:
 *  - Cek duplikat (pelayan + role_id sudah ada) → skip
 *  - Cek konflik jadwal (pelayan sudah di kegiatan lain yang waktunya bertabrakan) → skip + catat
 *  - Jika aman → INSERT + kirim push notification
 *
 * Response: { success, assigned, skipped_duplicate, skipped_conflict, message }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: kegiatanId } = await params;

  try {
    const body = await request.json();
    const { tim_id } = body;

    if (!tim_id) {
      return NextResponse.json({ success: false, message: 'tim_id wajib diisi.' }, { status: 400 });
    }

    // 1. Ambil semua anggota tim beserta role & info lengkap
    const anggotaRes = await pool.query(`
      SELECT
        tpa.pelayan_id,
        tpa.role_pelayan_id AS role_id,
        rp.nama_role        AS role_kehadiran,
        j.nama_lengkap,
        p.jemaat_id
      FROM public.tim_pelayan_anggota tpa
      JOIN public.pelayan      p  ON p.id  = tpa.pelayan_id
      JOIN public.jemaat       j  ON j.id  = p.jemaat_id
      JOIN public.role_pelayan rp ON rp.id = tpa.role_pelayan_id
      WHERE tpa.tim_id = $1
    `, [tim_id]);

    if (anggotaRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Tim ini belum memiliki anggota.' }, { status: 400 });
    }

    // 2. Ambil info kegiatan (waktu) untuk cek konflik
    const kegiatanRes = await pool.query(`
      SELECT nama_kegiatan, tanggal_mulai, tanggal_selesai, waktu_mulai, waktu_selesai
      FROM public.kegiatan
      WHERE id = $1
    `, [kegiatanId]);

    if (kegiatanRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Kegiatan tidak ditemukan.' }, { status: 404 });
    }

    const kegiatan = kegiatanRes.rows[0];

    // 3. Proses setiap anggota satu per satu
    const assigned: string[]           = [];
    const skippedDuplicate: string[]   = [];
    const skippedConflict: { nama: string; bentrokDengan: string }[] = [];

    for (const anggota of anggotaRes.rows) {
      const { pelayan_id, role_id, role_kehadiran, nama_lengkap, jemaat_id } = anggota;

      // 3a. Cek duplikat: pelayan + role persis sama sudah ada di roster ini
      const dupCheck = await pool.query(
        `SELECT id FROM public.kegiatan_jadwal_pelayan
         WHERE kegiatan_id = $1 AND pelayan_id = $2 AND role_id = $3`,
        [kegiatanId, pelayan_id, role_id]
      );
      if (dupCheck.rows.length > 0) {
        skippedDuplicate.push(`${nama_lengkap} (${role_kehadiran})`);
        continue;
      }

      // 3b. Cek konflik jadwal: apakah pelayan ini sudah di-roster di kegiatan lain
      //     yang waktunya bertabrakan dengan kegiatan ini? (Samakan dengan logic master.repository.ts)
      const conflictCheck = await pool.query(`
        SELECT k.nama_kegiatan
        FROM public.kegiatan_jadwal_pelayan kjp
        JOIN public.kegiatan k ON k.id = kjp.kegiatan_id
        WHERE kjp.pelayan_id = $1
          AND kjp.kegiatan_id != $2
          AND k.tanggal_mulai = $3
          AND kjp.status_konfirmasi NOT IN ('Berhalangan', 'Tidak Hadir')
        LIMIT 1
      `, [
        pelayan_id,
        kegiatanId,
        kegiatan.tanggal_mulai
      ]);

      if (conflictCheck.rows.length > 0) {
        skippedConflict.push({
          nama: nama_lengkap,
          bentrokDengan: conflictCheck.rows[0].nama_kegiatan,
        });
        continue;
      }

      // 3c. Aman → INSERT ke roster
      await pool.query(
        `INSERT INTO public.kegiatan_jadwal_pelayan
           (kegiatan_id, pelayan_id, role_id, status_konfirmasi)
         VALUES ($1, $2, $3, 'Menunggu Konfirmasi')`,
        [kegiatanId, pelayan_id, role_id]
      );
      assigned.push(`${nama_lengkap} (${role_kehadiran})`);

      // 3d. Kirim push notification — persis sama seperti POST single
      try {
        if (process.env.VAPID_PRIVATE_KEY) {
          const userQuery = await pool.query(`
            SELECT u.id AS user_id, j.nama_lengkap
            FROM public.pengguna u
            JOIN public.jemaat j ON j.id = u.jemaat_id
            WHERE u.jemaat_id = $1
          `, [jemaat_id]);

          if (userQuery.rows.length > 0) {
            const userId = userQuery.rows[0].user_id;
            const firstName = userQuery.rows[0].nama_lengkap.split(' ')[0];

            const subQuery = await pool.query(`
              SELECT endpoint, p256dh, auth
              FROM public.push_subscriptions
              WHERE user_id = $1
            `, [userId]);

            if (subQuery.rows.length > 0) {
              const payload = JSON.stringify({
                title: 'Tugas Pelayanan Baru',
                body: `Syalom ${firstName}, Anda ditugaskan sebagai ${role_kehadiran}. Silakan konfirmasi kesediaan Anda.`,
                url: '/pelayan/jadwal',
              });

              for (const sub of subQuery.rows) {
                const pushSub = {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                };
                try {
                  await webpush.sendNotification(pushSub, payload);
                } catch (pushErr) {
                  console.error('[TimAssign] Push failed:', sub.endpoint, pushErr);
                }
              }
            }
          }
        }
      } catch (pushErr) {
        console.error('[TimAssign] Push workflow error:', pushErr);
      }
    }

    // 4. Susun pesan ringkasan
    const parts: string[] = [];
    if (assigned.length > 0) parts.push(`${assigned.length} pelayan berhasil ditambahkan`);
    if (skippedDuplicate.length > 0) parts.push(`${skippedDuplicate.length} sudah ada di roster`);
    if (skippedConflict.length > 0) parts.push(`${skippedConflict.length} dilewati karena jadwal bentrok`);

    return NextResponse.json({
      success: true,
      message: parts.join(', ') + '.',
      assigned,
      skipped_duplicate: skippedDuplicate,
      skipped_conflict: skippedConflict,
    });

  } catch (error) {
    console.error('[TimAssign] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
