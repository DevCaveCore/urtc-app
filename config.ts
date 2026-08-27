/// <reference types="vite/client" />
// API keys live in .env.local (git-ignored). See .env.example for the shape.
export const API_KEYS = {
    FLIGHTAWARE: import.meta.env.VITE_FLIGHTAWARE_API_KEY || "",
    OWM: import.meta.env.VITE_OWM_API_KEY || "",
    GOOGLE_MAPS: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    GEMINI: import.meta.env.VITE_GEMINI_API_KEY,
    // Web Push certificate key pair from Firebase console →
    // Project settings → Cloud Messaging → Web Push certificates
    FCM_VAPID: import.meta.env.VITE_FCM_VAPID_KEY || ""
};
