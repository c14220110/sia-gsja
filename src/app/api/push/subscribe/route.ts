import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/server/utils/jwt';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    // Verify token
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (!decoded || !decoded.user_id) {
       return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const subscription = await req.json();
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ success: false, message: 'Invalid subscription payload' }, { status: 400 });
    }

    try {
       // Using ON CONFLICT ON CONSTRAINT to update if endpoint already exists
       await db.execute(
         `INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth) 
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ON CONSTRAINT unique_subscription_endpoint DO UPDATE 
          SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
          [decoded.user_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
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
