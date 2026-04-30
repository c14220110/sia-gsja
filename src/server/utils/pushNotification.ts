import webpush from 'web-push';
import pool from '@/lib/db';

// Konfigurasi VAPID mengikuti metode yang terbukti sukses
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    'mailto:it@gsja.org',
    publicVapidKey,
    privateVapidKey
  );
} else {
  console.warn('VAPID keys belum diset di environment variables. Push Notification tidak akan berfungsi.');
}

/**
 * Mengirim push notification ke HP/Browser Jemaat
 * @param jemaatId ID jemaat yang dituju
 * @param title Judul Notifikasi
 * @param body Isi Notifikasi
 * @param url URL yang akan dibuka saat notifikasi di-klik
 */
export async function sendPushNotificationToJemaat(jemaatId: number, title: string, body: string, url: string = '/') {
  if (!publicVapidKey || !privateVapidKey) {
    console.warn('[Web Push] Batal mengirim notifikasi karena VAPID keys belum di-set.');
    return;
  }

  try {
    // Cari user_id dari tabel pengguna milik jemaat_id ini (seperti logika di pelayan route)
    const userQuery = await pool.query(`
       SELECT id as user_id 
       FROM public.pengguna 
       WHERE jemaat_id = $1 LIMIT 1
    `, [jemaatId]);
    
    if (userQuery.rows.length === 0) {
      console.log(`[Web Push] User (pengguna) tidak ditemukan untuk Jemaat ID ${jemaatId}`);
      return;
    }
    const userId = userQuery.rows[0].user_id;

    // Ambil subscription menggunakan nama kolom yang tepat (endpoint, p256dh, auth)
    const subQuery = await pool.query(`
       SELECT endpoint, p256dh, auth 
       FROM public.push_subscriptions 
       WHERE user_id = $1
    `, [userId]);
    
    if (subQuery.rows.length === 0) {
      console.log(`[Web Push] Jemaat ID ${jemaatId} belum mengaktifkan notifikasi.`);
      return;
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png'
    });

    for (const sub of subQuery.rows) {
      const pushSub = {
         endpoint: sub.endpoint,
         keys: { p256dh: sub.p256dh, auth: sub.auth }
      };
      try {
         await webpush.sendNotification(pushSub, payload);
      } catch (pushErr) {
         console.error("[Web Push] Failed to push to endpoint:", sub.endpoint, pushErr);
      }
    }
    
    console.log(`[Web Push] Berhasil memproses notifikasi untuk Jemaat ID ${jemaatId}`);

  } catch (error) {
    console.error('[Web Push] Error pada proses push notification:', error);
  }
}
