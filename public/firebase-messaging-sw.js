// Firebase Cloud Messaging service worker — shows flight alert pushes
// when ÜrTC isn't in the foreground. Served from the site root so its
// scope covers the whole app. The config here is the public client
// config (safe to ship; security lives in Firestore rules).
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAJlvTpmA5gChV7D9LC3yjGnPsG8pW7plA',
  authDomain: 'urtc-app.firebaseapp.com',
  projectId: 'urtc-app',
  storageBucket: 'urtc-app.firebasestorage.app',
  messagingSenderId: '507846689605',
  appId: '1:507846689605:web:dd08e4a1fcb6c03ea6342c',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Flight update';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, {
    body,
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
