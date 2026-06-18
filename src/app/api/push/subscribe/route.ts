import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getCallerFromRequest } from '@/server/utils/getCallerFromRequest';

export async function POST(req: NextRequest) {
  try {
    const caller = getCallerFromRequest(req);
    if (!caller) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await req.json();
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ success: false, message: 'Invalid subscription payload' }, { status: 400 });
    }

    try {
       // Serahin ke ON CONFLICT kalau datanya kembar, tumpukin biar di-update aja
       await pool.query(
         `INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth) 
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (endpoint) DO UPDATE 
          SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
          [caller.user_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
       );
    } catch (dbErr) {
       console.error("DB Insert Subscription Error:", dbErr);
       // We can fallback or log here
    }

    return NextResponse.json({ success: true, message: 'Subscription saved' });
  } catch (error) {
    console.error('Push Subscribe Error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
