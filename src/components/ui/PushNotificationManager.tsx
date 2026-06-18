'use client';
import { useEffect, useState } from 'react';

/**
 * Utility to convert base64 VAPID string into Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      setPermission(Notification.permission);
      
      // Pas udh dpet ijin, yaudah lsg langganan di belakang layar sembunyi-sembunyi aje
      if (Notification.permission === 'granted') {
         subscribeToPush(true);
      }
    }
  }, []);

  const subscribeToPush = async (quiet = false) => {
    try {
      if (!quiet) setIsSubscribing(true);
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
         console.warn('VAPID Public Key not defined in .env.local');
         return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
         subscription = await registration.pushManager.subscribe({
           userVisibleOnly: true,
           applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
         });
      }

      // Setor kirim pendaftaran push nyo ke backend kodenya
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });

      if (!res.ok) {
         console.error('Failed to store subscription on server');
      }

      setPermission('granted');
    } catch (e) {
      console.error('Push Subscription failed:', e);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSubscribeClick = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      await subscribeToPush();
    }
  };

  if (permission === 'default') {
    return (
      <div className="fixed bottom-24 right-5 z-50">
         <button 
           onClick={handleSubscribeClick}
           disabled={isSubscribing}
           className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-700 active:scale-95 transition-all animate-bounce"
         >
           {isSubscribing ? (
             <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span>
           ) : (
             <span className="material-icons-round text-white text-2xl">notifications_active</span>
           )}
         </button>
      </div>
    );
  }

  return null;
}
