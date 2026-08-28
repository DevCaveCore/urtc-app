// Push notifications for flight alerts (Diamond feature, v1.2).
// Flow: user creates an alert → we ask for notification permission and
// register this device's FCM token under users/{uid}.fcmTokens →
// FlightAware POSTs flight events to our aeroalerts function → the
// function pushes to every registered device.
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { app, db } from './firebaseClient';
import { API_KEYS } from '../config';

// Stable public URL of the aeroalerts Cloud Function (hosting rewrite).
// Every alert we create points its webhook here.
export const ALERTS_WEBHOOK_URL = 'https://urtc-app.web.app/aeroalerts';

const isRealUser = (userId: string | undefined | null): boolean =>
    !!userId && !userId.startsWith('guest') && !userId.startsWith('code-');

const isNativePlatform = (): boolean =>
    typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();

// Native (Android/iOS) push via Capacitor: the OS hands us an FCM device
// token, we file it under the user's profile, and the same aeroalerts
// webhook delivers to it — no separate backend path needed.
const enableNativePush = async (userId: string): Promise<boolean> => {
    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive !== 'granted') perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return false;

        return await new Promise<boolean>((resolve) => {
            let settled = false;
            const done = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };
            PushNotifications.addListener('registration', async (token) => {
                try {
                    await updateDoc(doc(db, 'users', userId), { fcmTokens: arrayUnion(token.value) });
                    done(true);
                } catch (e) { console.warn('Could not save push token:', e); done(false); }
            });
            PushNotifications.addListener('registrationError', (err) => {
                console.warn('Push registration error:', err);
                done(false);
            });
            PushNotifications.register();
            setTimeout(() => done(false), 10000); // never hang the UI on a slow register
        });
    } catch (e) {
        console.warn('enableNativePush failed:', e);
        return false;
    }
};

// Ask for permission, fetch this device's FCM token, and file it under the
// user's profile. Returns true when pushes will actually be delivered.
export const enableFlightPush = async (userId: string): Promise<boolean> => {
    try {
        if (!isRealUser(userId)) return false;
        if (isNativePlatform()) return enableNativePush(userId); // Android/iOS app
        if (!(await isSupported())) return false; // e.g. iOS Safari outside installed PWA

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return false;

        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
            vapidKey: API_KEYS.FCM_VAPID,
            serviceWorkerRegistration: registration,
        });
        if (!token) return false;

        await updateDoc(doc(db, 'users', userId), { fcmTokens: arrayUnion(token) });

        // Foreground pushes don't hit the service worker — surface them ourselves.
        onMessage(messaging, (payload) => {
            const title = payload.notification?.title || 'Flight update';
            const body = payload.notification?.body || '';
            if (Notification.permission === 'granted') {
                new Notification(title, { body, icon: '/assets/icon-192.png' });
            }
        });
        return true;
    } catch (e) {
        console.warn('enableFlightPush failed:', e);
        return false;
    }
};
