import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';
import webpush from 'web-push';

// Configuration
webpush.setVapidDetails(
  'mailto:it@gsja.org', // Should be replaced with actual admin email
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const query = `
      SELECT 
        kjp.id,
        kjp.kegiatan_id,
        kjp.pelayan_id,
        kjp.role_id,
        rp.nama_role        AS role_kehadiran,
        kjp.status_konfirmasi,
        j.nama_lengkap,
        j.foto_url
      FROM public.kegiatan_jadwal_pelayan kjp
      JOIN public.pelayan     p  ON kjp.pelayan_id = p.id
      JOIN public.jemaat      j  ON p.jemaat_id    = j.id
      JOIN public.role_pelayan rp ON kjp.role_id   = rp.id
      WHERE kjp.kegiatan_id = $1
      ORDER BY rp.nama_role ASC, j.nama_lengkap ASC
    `;
    const result = await pool.query(query, [id]);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching pelayan kegiatan:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { pelayan_id, role_id, role_kehadiran } = body;

    if (!pelayan_id || !role_id) {
      return NextResponse.json(
        { success: false, message: 'Pelayan dan Peran/Tugas wajib dipilih' },
        { status: 400 }
      );
    }

    // Blokir jika kombinasi pelayan + role_id PERSIS SAMA (human error duplikat)
    // – tapi IZINKAN pelayan yang sama dengan role berbeda (tugas ganda yang sah)
    const checkResult = await pool.query(
      `SELECT id FROM public.kegiatan_jadwal_pelayan
       WHERE kegiatan_id = $1 AND pelayan_id = $2 AND role_id = $3`,
      [id, pelayan_id, role_id]
    );
    if (checkResult.rows.length > 0) {
      return NextResponse.json(
        { success: false, message: `Pelayan ini sudah ditugaskan sebagai ${role_kehadiran || 'role tersebut'} di kegiatan ini` },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO public.kegiatan_jadwal_pelayan
         (kegiatan_id, pelayan_id, role_id, status_konfirmasi)
       VALUES ($1, $2, $3, 'Menunggu Konfirmasi')
       RETURNING id`,
      [id, pelayan_id, role_id]
    );

    // --- PUSH NOTIFICATION DISPATCH ---
    try {
      if (process.env.VAPID_PRIVATE_KEY) {
         // Get the user_id and activity details
         const userQuery = await pool.query(`
           SELECT u.id as user_id, j.nama_lengkap
           FROM public.pelayan p
           JOIN public.pengguna u ON u.jemaat_id = p.jemaat_id
           JOIN public.jemaat j ON j.id = p.jemaat_id
           WHERE p.id = $1
         `, [pelayan_id]);

         if (userQuery.rows.length > 0) {
            const userId = userQuery.rows[0].user_id;

            // Get the subscription
            const subQuery = await pool.query(`
               SELECT endpoint, p256dh, auth 
               FROM public.push_subscriptions 
               WHERE user_id = $1
            `, [userId]);

            if (subQuery.rows.length > 0) {
               // Send push notification to all devices
               const payload = JSON.stringify({
                  title: "Tugas Pelayanan Baru",
                  body: `Syalom ${userQuery.rows[0].nama_lengkap.split(' ')[0]}, Anda ditugaskan sebagai ${role_kehadiran || 'pelayan'}. Silakan konfirmasi kesediaan Anda.`,
                  url: "/pelayan/jadwal"
               });

               for (const sub of subQuery.rows) {
                  const pushSub = {
                     endpoint: sub.endpoint,
                     keys: { p256dh: sub.p256dh, auth: sub.auth }
                  };
                  try {
                     await webpush.sendNotification(pushSub, payload);
                  } catch (pushErr) {
                     console.error("Failed to push to endpoint:", sub.endpoint, pushErr);
                  }
               }
            }
         }
      }
    } catch (pushGeneralErr) {
      console.error("Web Push Workflow Error:", pushGeneralErr);
    }
    // --- END PUSH NOTIFICATION ---

    return NextResponse.json({
      success: true,
      message: 'Pelayan berhasil ditambahkan ke roster',
      data: { id: result.rows[0].id }
    });
  } catch (error) {
    console.error('Error adding pelayan to roster:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const rosterItemId = searchParams.get('roster_id');

  if (!rosterItemId) {
    return NextResponse.json({ success: false, message: 'roster_id wajib diisi' }, { status: 400 });
  }

  try {
    await pool.query(
      `DELETE FROM public.kegiatan_jadwal_pelayan WHERE id = $1 AND kegiatan_id = $2`,
      [rosterItemId, id]
    );
    return NextResponse.json({ success: true, message: 'Pelayan berhasil dihapus dari roster' });
  } catch (error) {
    console.error('Error deleting pelayan from roster:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = getCallerFromRequest(request);
  if (!caller) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { roster_id, roster_ids, status_konfirmasi } = body;

    const validStatuses = ['Menunggu Konfirmasi', 'Bersedia', 'Berhalangan', 'Hadir', 'Tidak Hadir'];
    if (!status_konfirmasi || !validStatuses.includes(status_konfirmasi)) {
      return NextResponse.json({ success: false, message: 'status_konfirmasi tidak valid' }, { status: 400 });
    }

    // ── SINGLE UPDATE (roster_id tunggal) ──────────────────────────
    if (roster_id && !roster_ids) {
      // Ambil info pelayan untuk log absensi
      const infoRes = await pool.query(
        `SELECT kjp.pelayan_id, p.jemaat_id, j.nama_lengkap
         FROM public.kegiatan_jadwal_pelayan kjp
         JOIN public.pelayan p ON kjp.pelayan_id = p.id
         JOIN public.jemaat  j ON p.jemaat_id    = j.id
         WHERE kjp.id = $1 AND kjp.kegiatan_id = $2`,
        [roster_id, id]
      );

      // Update semua baris milik pelayan yang sama (tugas ganda ikut update)
      if ((infoRes.rowCount ?? 0) > 0) {
        const { pelayan_id, jemaat_id, nama_lengkap } = infoRes.rows[0];
        await pool.query(
          `UPDATE public.kegiatan_jadwal_pelayan
           SET status_konfirmasi = $1
           WHERE kegiatan_id = $2 AND pelayan_id = $3`,
          [status_konfirmasi, id, pelayan_id]
        );

        // Satu log kehadiran — hanya jika menandai Hadir
        if (status_konfirmasi === 'Hadir') {
          const existCheck = await pool.query(
            `SELECT id FROM public.kegiatan_absensi WHERE kegiatan_id = $1 AND jemaat_id = $2`,
            [id, jemaat_id]
          );
          if ((existCheck.rowCount ?? 0) === 0) {
            await pool.query(
              `INSERT INTO public.kegiatan_absensi
                 (kegiatan_id, jemaat_id, role_kehadiran, metode_absensi, status_kehadiran)
               VALUES ($1, $2, 'Pelayan', 'Manual', 'Hadir')`,
              [id, jemaat_id]
            );
          } else {
            await pool.query(
              `UPDATE public.kegiatan_absensi
               SET status_kehadiran = 'Hadir', metode_absensi = 'Manual', waktu_hadir = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [existCheck.rows[0].id]
            );
          }
        }
        return NextResponse.json({ success: true, message: `${nama_lengkap} → ${status_konfirmasi}` });
      }
      return NextResponse.json({ success: false, message: 'Roster tidak ditemukan' }, { status: 404 });
    }

    // ── BULK UPDATE (roster_ids array) ─────────────────────────────
    if (roster_ids && Array.isArray(roster_ids) && roster_ids.length > 0) {
      // Ambil info semua roster yang dipilih
      const rosterRes = await pool.query(
        `SELECT kjp.pelayan_id, p.jemaat_id, j.nama_lengkap
         FROM public.kegiatan_jadwal_pelayan kjp
         JOIN public.pelayan p ON kjp.pelayan_id = p.id
         JOIN public.jemaat  j ON p.jemaat_id    = j.id
         WHERE kjp.id = ANY($1::int[]) AND kjp.kegiatan_id = $2`,
        [roster_ids, id]
      );

      // Deduplicate: kumpulkan pelayan_id unik
      const uniquePelayanMap = new Map<number, { jemaat_id: number; nama: string }>();
      for (const row of rosterRes.rows) {
        if (!uniquePelayanMap.has(row.pelayan_id)) {
          uniquePelayanMap.set(row.pelayan_id, { jemaat_id: row.jemaat_id, nama: row.nama_lengkap });
        }
      }

      // Update semua baris roster milik pelayan-pelayan terpilih
      const uniquePelayanIds = Array.from(uniquePelayanMap.keys());
      await pool.query(
        `UPDATE public.kegiatan_jadwal_pelayan
         SET status_konfirmasi = $1
         WHERE kegiatan_id = $2 AND pelayan_id = ANY($3::int[])`,
        [status_konfirmasi, id, uniquePelayanIds]
      );

      // Buat 1 log absensi per orang (deduplication tugas ganda)
      if (status_konfirmasi === 'Hadir') {
        for (const [, { jemaat_id }] of uniquePelayanMap) {
          const existCheck = await pool.query(
            `SELECT id FROM public.kegiatan_absensi WHERE kegiatan_id = $1 AND jemaat_id = $2`,
            [id, jemaat_id]
          );
          if ((existCheck.rowCount ?? 0) === 0) {
            await pool.query(
              `INSERT INTO public.kegiatan_absensi
                 (kegiatan_id, jemaat_id, role_kehadiran, metode_absensi, status_kehadiran)
               VALUES ($1, $2, 'Pelayan', 'Manual', 'Hadir')`,
              [id, jemaat_id]
            );
          } else {
            await pool.query(
              `UPDATE public.kegiatan_absensi
               SET status_kehadiran = 'Hadir', metode_absensi = 'Manual', waktu_hadir = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [existCheck.rows[0].id]
            );
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `${uniquePelayanIds.length} pelayan ditandai ${status_konfirmasi}`
      });
    }

    return NextResponse.json({ success: false, message: 'roster_id atau roster_ids wajib diisi' }, { status: 400 });
  } catch (error) {
    console.error('Error updating pelayan status:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
