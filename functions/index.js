// urtc functions v1.4.1 — verified-uid attribution + case-safe aeroapi blocklist
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

const memPut = (key, entry) => {
  // Single choke point so the cap holds no matter who inserts
  if (memCache.size >= MEM_CACHE_MAX) memCache.delete(memCache.keys().next().value);
  memCache.set(key, entry);
};

const cacheGet = async (key) => {
  const hit = memCache.get(key);
  if (hit && hit.exp > Date.now()) return hit;
  if (hit) memCache.delete(key);
  try {
    const docRef = adminForCache.firestore().collection("aeroapi_cache").doc(key);
    const doc = await docRef.get();
    if (doc.exists) {
      const d = doc.data();
      if (d.exp > Date.now()) {
        memPut(key, d);
        return d;
      }
      docRef.delete().catch(() => {}); // expired — stop the collection growing forever
    }
  } catch (e) { /* cache read failure is never fatal */ }
  return null;
};

const cacheSet = (key, body, contentType, ttl) => {
  const entry = { exp: Date.now() + ttl, body, contentType };
  memPut(key, entry);
  // Firestore docs cap at ~1MB — persist only what fits
  if (body.length < 900000) {
    adminForCache.firestore().collection("aeroapi_cache").doc(key).set(entry).catch(() => {});
  }
};

// Paths on the FlightAware account that must never be reachable from the
// public proxy. The account-wide alert webhook is special-cased below:
// reading it is fine, and setting it is allowed ONLY to our own URL —
// repointing it elsewhere would leak every user's flight events.
const AERO_BLOCKED = [/^\/aeroapi\/account\//];
const OFFICIAL_ALERTS_WEBHOOK = "https://urtc-app.web.app/aeroalerts";

exports.aeroapi = onRequest({ region: "us-central1", cors: true, invoker: "public", secrets: ["AEROAPI_KEY"] }, async (req, res) => {
  // Security checks run BEFORE the diag peephole: `?__diag` on a blocked path
  // must not turn a 403 into a 200. Path is lower-cased for matching because
  // "/aeroapi/Account/usage" slipped past a case-sensitive regex and got
  // forwarded upstream with our key attached.
  const cleanPath = req.originalUrl.split("?")[0].toLowerCase();
  if (AERO_BLOCKED.some((re) => re.test(cleanPath))) {
    res.status(403).json({ error: "route_not_allowed" });
    return;
  }
  // Diagnostic peephole: existence only — never lengths or fragments.
  // REMOVE before wide launch (see CLAUDE.md).
  if (req.originalUrl.includes("__diag")) {
    res.json({ hasEnvKey: (process.env.AEROAPI_KEY || "").length > 0 });
    return;
  }
  if (/^\/aeroapi\/alerts\/endpoint/.test(cleanPath) && req.method !== "GET") {
    const target = (req.body && req.body.target_url) || "";
    if (req.method === "DELETE" || target !== OFFICIAL_ALERTS_WEBHOOK) {
      res.status(403).json({ error: "webhook_locked" });
      return;
    }
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

// ── Duffel travel commerce proxy ─────────────────────────────────
// The Smart Booking Model backend. Every Duffel call happens server-side —
// the client never sees DUFFEL_API_KEY. Reached through Firebase Hosting at
// https://urtc-app.web.app/duffel/** (rewrite in firebase.json).
// Set the secret with:
//   npx firebase-tools functions:secrets:set DUFFEL_API_KEY
// (LESSON: v2 functions only bind secrets DECLARED in options.secrets, and
// the CLI skips unchanged code — bump the version comment at the top of this
// file to force a redeploy/rebind.)
const DUFFEL_ORIGIN = "https://api.duffel.com";

// Only the exact surface the booking flow needs is proxied. Anything else
// (refunds, payouts, account endpoints) stays unreachable from the client.
const DUFFEL_ALLOWED = [
  { method: "POST", re: /^\/air\/offer_requests(\?.*)?$/ },          // search flights
  { method: "GET",  re: /^\/air\/offer_requests\/[\w-]+(\?.*)?$/ },  // read a search
  { method: "GET",  re: /^\/air\/offers(\?.*)?$/ },                  // list offers of a search
  { method: "GET",  re: /^\/air\/offers\/[\w-]+(\?.*)?$/ },          // revalidate one offer
  { method: "POST", re: /^\/air\/orders(\?.*)?$/ },                  // create the booking
  { method: "GET",  re: /^\/air\/orders\/[\w-]+(\?.*)?$/ },          // read a booking
];

exports.duffel = onRequest(
  { region: "us-central1", cors: true, invoker: "public", secrets: ["DUFFEL_API_KEY"] },
  async (req, res) => {
    // Diagnostic peephole: existence only — never lengths or fragments.
    // REMOVE before wide launch (see CLAUDE.md).
    if (req.originalUrl.includes("__diag")) {
      res.json({ hasEnvKey: (process.env.DUFFEL_API_KEY || "").length > 0 });
      return;
    }

    const key = (process.env.DUFFEL_API_KEY || "").trim();
    if (!key) {
      res.status(503).json({ error: "booking_engine_not_configured", message: "The booking engine isn't configured yet. Set the DUFFEL_API_KEY secret and redeploy." });
      return;
    }

    const path = req.originalUrl.replace(/^\/duffel/, "");
    const allowed = DUFFEL_ALLOWED.some((r) => r.method === req.method && r.re.test(path));
    if (!allowed) {
      res.status(403).json({ error: "route_not_allowed" });
      return;
    }

    // MONEY GUARD: creating an order spends from CCD's Duffel balance. In
    // live mode that is real money, so it requires a signed-in Firebase user
    // (test mode stays open so the sandbox demo works for guests).
    const isLiveKey = !key.startsWith("duffel_test_");
    let verifiedUid = null;
    if (req.method === "POST" && path.startsWith("/air/orders")) {
      const idToken = req.get("x-urtc-auth") || "";
      if (idToken) {
        try {
          verifiedUid = (await admin.auth().verifyIdToken(idToken)).uid;
        } catch (e) { /* invalid token — treated as anonymous below */ }
      }
      if (isLiveKey && !verifiedUid) {
        res.status(401).json({ error: "sign_in_required", message: "Sign in to complete a booking." });
        return;
      }
    }

    try {
      const headers = {
        Authorization: `Bearer ${key}`,
        "Duffel-Version": "v2",
        Accept: "application/json",
        "Accept-Encoding": "gzip",
      };
      // Retries must never double-issue a ticket
      const idem = req.get("idempotency-key");
      if (idem && /^[\w-]{8,64}$/.test(idem)) headers["Idempotency-Key"] = idem;
      const init = { method: req.method, headers };
      if (!["GET", "HEAD"].includes(req.method)) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(req.body || {});
      }
      const upstream = await fetch(DUFFEL_ORIGIN + path, init);
      const text = await upstream.text();

      // Revenue ledger: persist every confirmed order server-side (admin SDK,
      // invisible to clients) so CCD can track booking revenue from day one.
      if (req.method === "POST" && path.startsWith("/air/orders") && (upstream.status === 200 || upstream.status === 201)) {
        try {
          const order = JSON.parse(text).data;
          // Attribution must come from the VERIFIED token, never the
          // client-supplied header — otherwise anyone can file a booking
          // under someone else's account and the revenue ledger is fiction.
          // The unverified hint is kept separately for debugging only.
          const claimedUid = req.get("x-urtc-uid") || null;
          await admin.firestore().collection("bookings").doc(order.id).set({
            uid: verifiedUid || "anonymous",
            uid_verified: !!verifiedUid,
            uid_claimed: verifiedUid ? null : claimedUid,
            provider: "duffel",
            live_mode: !!order.live_mode,
            booking_reference: order.booking_reference || null,
            status: "CONFIRMED",
            airline: (order.owner && order.owner.name) || null,
            passengers: (order.passengers || []).length,
            // Financials, kept separate from anything the customer sees:
            customer_total: order.total_amount || null,
            supplier_cost: order.total_amount || null, // markup/commission land here once contracts exist
            base_amount: order.base_amount || null,
            tax_amount: order.tax_amount || null,
            currency: order.total_currency || "USD",
            markup: 0,
            commission: 0,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.error("duffel: booking ledger write failed:", e);
        }
      }

      res
        .status(upstream.status)
        .set("Content-Type", upstream.headers.get("content-type") || "application/json; charset=UTF-8")
        .send(text);
    } catch (err) {
      console.error("duffel proxy error:", err);
      res.status(502).json({ error: "Upstream Duffel request failed" });
    }
  }
);

// ── AeroAPI alert webhook → FCM push ─────────────────────────────
// FlightAware POSTs here when a tracked flight has an event (departure,
// arrival, cancellation, diversion, delay — delays arrive bundled inside
// the departure/arrival events). We look up who owns the alert in
// Firestore (flight_alerts/{alert_id}, written by the app when the user
// creates an alert) and push a notification to their devices via FCM.
// Reached through Firebase Hosting at https://urtc-app.web.app/aeroalerts
// (rewrite in firebase.json), so the URL never changes even if the
// underlying Cloud Run URL does.
const EVENT_TITLES = {
  filed: "Flight plan filed",
  departure: "Departed",
  arrival: "Arrived",
  cancelled: "Cancelled",
  diverted: "Diverted",
};

exports.aeroalerts = onRequest({ region: "us-central1", invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  // Always answer 200 fast — FlightAware disables endpoints that keep failing.
  try {
    const body = req.body || {};
    const alertId = body.alert_id;
    const flight = body.flight || {};
    const ident = flight.ident || "Your flight";
    if (!alertId) {
      console.warn("aeroalerts: POST without alert_id", JSON.stringify(body).slice(0, 500));
      res.status(200).json({ received: true });
      return;
    }

    const mapDoc = await admin.firestore().collection("flight_alerts").doc(String(alertId)).get();
    if (!mapDoc.exists) {
      console.warn(`aeroalerts: no owner mapping for alert ${alertId}`);
      res.status(200).json({ received: true });
      return;
    }
    const uid = mapDoc.data().uid;

    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const tokens = (userDoc.exists && userDoc.data().fcmTokens) || [];
    if (tokens.length === 0) {
      console.warn(`aeroalerts: user ${uid} has no FCM tokens`);
      res.status(200).json({ received: true });
      return;
    }

    const eventTitle = EVENT_TITLES[body.event_code] || "Flight update";
    const title = `${ident} — ${eventTitle}`;
    const text = body.short_description || body.summary || body.long_description || "Tap for the latest status.";

    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body: text },
      data: {
        ident: String(ident),
        event_code: String(body.event_code || ""),
        fa_flight_id: String(flight.fa_flight_id || ""),
      },
      webpush: {
        notification: { title, body: text, icon: "/assets/icon-192.png", badge: "/assets/icon-192.png" },
        fcmOptions: { link: "https://urtc-app.web.app/" },
      },
    });

    // Prune tokens for uninstalled/expired devices so we stop paying to miss.
    const dead = [];
    result.responses.forEach((r, i) => {
      if (!r.success && r.error && /registration-token-not-registered|invalid-argument/.test(r.error.code || "")) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length) {
      await admin.firestore().collection("users").doc(uid).update({
        fcmTokens: adminForCache.firestore.FieldValue.arrayRemove(...dead),
      }).catch(() => {});
    }

    console.log(`aeroalerts: ${ident} ${body.event_code} → ${result.successCount}/${tokens.length} devices (user ${uid})`);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("aeroalerts error:", err);
    res.status(200).json({ received: true }); // still 200 — never poison the endpoint
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

// Opens Stripe's Customer Portal (manage / cancel subscription) for the
// signed-in user. Requires a Firebase ID token — the portal exposes billing
// details, so an unauthenticated uid string is not enough.
// Reached via https://urtc-app.web.app/stripeportal (rewrite in firebase.json).
exports.stripeportal = onRequest(
  { region: "us-central1", cors: true, secrets: ["STRIPE_SECRET_KEY"], invoker: "public" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    try {
      const idToken = req.get("x-urtc-auth") || "";
      let uid;
      try {
        uid = (await admin.auth().verifyIdToken(idToken)).uid;
      } catch (e) {
        res.status(401).json({ error: "sign_in_required" });
        return;
      }
      const userDoc = await admin.firestore().collection("users").doc(uid).get();
      const customerId = userDoc.exists && userDoc.data().stripe_customer_id;
      if (!customerId) {
        res.status(404).json({ error: "no_subscription", message: "No Stripe subscription is linked to this account." });
        return;
      }
      const Stripe = require("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: "https://urtc-app.web.app/",
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error("stripeportal error:", err);
      res.status(502).json({ error: "portal_unavailable" });
    }
  }
);

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

    // Subscription ended (cancelled and the paid period ran out, or payments
    // failed permanently) → drop the user back to Silver. Without this, one
    // $4.99 week would buy Diamond forever.
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customerId = sub.customer;
      try {
        const snap = await admin.firestore().collection("users")
          .where("stripe_customer_id", "==", customerId).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.set({
            tier: "Silver",
            downgraded_at: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          console.log(`Subscription ended for customer ${customerId} → user ${snap.docs[0].id} downgraded to Silver`);
        } else {
          console.warn(`subscription.deleted for unknown customer ${customerId}`);
        }
      } catch (error) {
        console.error("Error downgrading user:", error);
        res.status(500).json({ error: "Database update failed" });
        return;
      }
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
