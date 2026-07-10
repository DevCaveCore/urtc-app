const { onRequest } = require("firebase-functions/v2/https");

const AERO_ORIGIN = "https://aeroapi.flightaware.com";

// Proxies /aeroapi/** requests from Firebase Hosting to FlightAware AeroAPI.
// The API key is taken from the AEROAPI_KEY env var if set (recommended),
// otherwise the client-supplied x-apikey header is forwarded.
// invoker: "public" — hosting rewrites arrive unauthenticated; without this
// Cloud Run returns 403 before the function even runs.
exports.aeroapi = onRequest({ region: "us-central1", cors: true, invoker: "public" }, async (req, res) => {
  try {
    const url = AERO_ORIGIN + req.originalUrl;
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
    res
      .status(upstream.status)
      .set("Content-Type", upstream.headers.get("content-type") || "application/json; charset=UTF-8")
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
  { region: "us-central1", secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
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
