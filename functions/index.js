// urtc functions v1.1.4 — aeroapi secret binding
const { onRequest } = require("firebase-functions/v2/https");

const AERO_ORIGIN = "https://aeroapi.flightaware.com";

// Proxies /aeroapi/** requests from Firebase Hosting to FlightAware AeroAPI.
// The API key is taken from the AEROAPI_KEY env var if set (recommended),
// otherwise the client-supplied x-apikey header is forwarded.
// invoker: "public" — hosting rewrites arrive unauthenticated; without this
// Cloud Run returns 403 before the function even runs.

// ── Shared AeroAPI cache ─────────────────────────────────────────
// Every user request passes through here; identical requests within the
// TTL window are served from cache and never billed by FlightAware.
const adminForCache = require("firebase-admin");
if (!adminForCache.apps.length) adminForCache.initializeApp();
const crypto = require("crypto");

const memCache = new Map(); // key -> { exp, body, contentType }
const MEM_CACHE_MAX = 500;

// How long each kind of data stays fresh (ms)
const ttlFor = (url) => {
  if (url.includes("/alerts")) return 0;                 // never cache account alert config
  if (url.includes("/account/")) return 0;
  if (url.includes("/history/")) return 6 * 3600e3;      // history never changes
  if (url.includes("/schedules/")) return 12 * 3600e3;   // published schedules
  if (url.match(/\/airports\/[^/]+\/routes\//)) return 12 * 3600e3;
  if (url.match(/\/airports\/[^/]+\/weather/)) return 15 * 60e3;
  if (url.match(/\/flights\/[^/]+\/(position|track)/)) return 20e3;  // live positions stay hot
  if (url.includes("/flights/search")) return 30e3;
  if (url.match(/\/airports\/[^/]+\/flights/)) return 60e3;          // shared airport boards
  if (url.includes("/airports/delays")) return 120e3;
  if (url.match(/\/airports\/[^/]+\/delays/)) return 120e3;
  if (url.includes("/operators/")) return 120e3;
  if (url.match(/\/aircraft\//)) return 24 * 3600e3;    // owners/types are static
  if (url.match(/\/airports\/[^/]+$/)) return 24 * 3600e3; // airport info is static
  return 60e3;                                            // default: flight lookups etc.
};

const cacheGet = async (key) => {
  const hit = memCache.get(key);
  if (hit && hit.exp > Date.now()) return hit;
  if (hit) memCache.delete(key);
  try {
    const doc = await adminForCache.firestore().collection("aeroapi_cache").doc(key).get();
    if (doc.exists) {
      const d = doc.data();
      if (d.exp > Date.now()) {
        memCache.set(key, d);
        return d;
      }
    }
  } catch (e) { /* cache read failure is never fatal */ }
  return null;
};

const cacheSet = (key, body, contentType, ttl) => {
  const entry = { exp: Date.now() + ttl, body, contentType };
  if (memCache.size >= MEM_CACHE_MAX) memCache.delete(memCache.keys().next().value);
  memCache.set(key, entry);
  // Firestore docs cap at ~1MB — persist only what fits
  if (body.length < 900000) {
    adminForCache.firestore().collection("aeroapi_cache").doc(key).set(entry).catch(() => {});
  }
};

exports.aeroapi = onRequest({ region: "us-central1", cors: true, invoker: "public", secrets: ["AEROAPI_KEY"] }, async (req, res) => {
  // Diagnostic peephole: shows whether the env key is bound (never reveals the key)
  if (req.originalUrl.includes("__diag")) {
    const k = process.env.AEROAPI_KEY || "";
    res.json({ hasEnvKey: k.length > 0, keyLength: k.length, keyPrefix: k.slice(0, 3), keySuffix: k.slice(-3), trimmedSame: k === k.trim() });
    return;
  }
  try {
    const url = AERO_ORIGIN + req.originalUrl;
    const ttl = ttlFor(req.originalUrl);
    const cacheKey = crypto.createHash("sha1").update(req.originalUrl).digest("hex");

    // Serve from the shared cache when possible (GET only)
    if (req.method === "GET" && ttl > 0) {
      const hit = await cacheGet(cacheKey);
      if (hit) {
        res.status(200).set("Content-Type", hit.contentType).set("X-Urtc-Cache", "HIT").send(hit.body);
        return;
      }
    }

    const headers = {
      "x-apikey": process.env.AEROAPI_KEY || req.get("x-apikey") || "",
      "Accept": "application/json; charset=UTF-8",
    };
    const init = { method: req.method, headers };
    if (!["GET", "HEAD"].includes(req.method)) {
      headers["Content-Type"] = "application/json; charset=UTF-8";
      init.body = JSON.stringify(req.body || {});
    }
    const upstream = await fetch(url, init);
    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json; charset=UTF-8";

    // Only successful GETs get cached
    if (req.method === "GET" && ttl > 0 && upstream.status === 200) {
      cacheSet(cacheKey, text, contentType, ttl);
    }

    res
      .status(upstream.status)
      .set("Content-Type", contentType)
      .set("X-Urtc-Cache", "MISS")
      .send(text);
  } catch (err) {
    console.error("aeroapi proxy error:", err);
    res.status(502).json({ error: "Upstream AeroAPI request failed" });
  }
});

// ── Stripe payments ──────────────────────────────────────────────
// Receives checkout.session.completed events and upgrades the user's
// tier in Firestore. Configure this URL in the Stripe dashboard under
// Developers → Webhooks, listening for "checkout.session.completed".
// Required secrets:
//   npx firebase-tools functions:secrets:set STRIPE_SECRET_KEY
//   npx firebase-tools functions:secrets:set STRIPE_WEBHOOK_SECRET
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();

const VALID_TIERS = ["Diamond", "Professional"];

exports.stripewebhook = onRequest(
  { region: "us-central1", secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], invoker: "public" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    const Stripe = require("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody, // Firebase Functions provides the raw body for signature verification
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.client_reference_id;
      // Tier from metadata if set on the Payment Link; default to Diamond.
      // Legacy "Pro" values map to Diamond.
      let tier = session.metadata && session.metadata.tier;
      if (!tier || tier === "Pro") tier = "Diamond";
      if (!VALID_TIERS.includes(tier)) tier = "Diamond";

      if (userId) {
        try {
          await admin.firestore().collection("users").doc(userId).set(
            {
              tier,
              stripe_customer_id: session.customer || null,
              upgraded_at: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          console.log(`Upgraded user ${userId} to ${tier}`);
        } catch (error) {
          console.error("Error updating user tier:", error);
          res.status(500).json({ error: "Database update failed" });
          return;
        }
      } else {
        console.warn("checkout.session.completed without client_reference_id — cannot upgrade anyone.");
      }
    }

    res.status(200).json({ received: true });
  }
);
