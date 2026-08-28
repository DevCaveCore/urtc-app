# Smart Booking Model — Go-Live Checklist

The Smart Booking Model is fully built and shipped in the code. It needs two
things from you to switch on: a Duffel account key, and one deploy.

## What was built (July–Aug 2026)

- **Flights tab → "Book Travel" toggle** — search form (From/To/dates/travelers/
  cabin/budget), Apollo-ranked results (Best Overall / Cheapest / Fastest /
  Best Value with real airline logos and "why Apollo picked this"), price
  revalidation, passenger checkout, confirmation with airline PNR, auto-save
  to My Trips.
- **Apollo tool `search_bookable_flights`** — say "get me from ATL to LA next
  Friday under $1,000" in chat and Apollo searches real fares, then points you
  at the Book tab (already prefilled).
- **`duffel` Firebase function** — all Duffel calls go server-side; the key
  never touches the browser. Every confirmed order is also written to a
  Firestore `bookings` collection as a revenue ledger (customer total, taxes,
  currency, uid).
- **Provider abstraction** — `services/travelCommerceService.ts` has a
  `TravelProvider` interface; Duffel is adapter #1, more suppliers can be
  added without touching the UI.

## Step 1 — Get a Duffel test key (10 minutes)

1. Open a NEW browser window (not the vite window!) → https://app.duffel.com/join
2. Sign up with admin@cavecoredynamics.org. Company: Cave Core Dynamics.
3. Once in the dashboard, you start in **Test mode** (toggle top-left).
4. Left sidebar → **Developers → Access tokens** → "Create token" →
   name it `urtc-test` → copy the token (starts with `duffel_test_`).

Test mode has fake-but-realistic airline inventory and a fake balance to "pay"
with — perfect for verifying the whole flow end to end with zero money.

## Step 2 — Bind the key and deploy (Terminal, from the project folder)

```bash
npx firebase-tools login --reauth
```

```bash
npx firebase-tools functions:secrets:set DUFFEL_API_KEY
```
(it will prompt — paste the `duffel_test_...` token and press Enter)

```bash
npm run build
```

```bash
npx firebase-tools deploy
```

## Step 3 — Verify

1. Open https://urtc-app.web.app/duffel/__diag — should show `"hasEnvKey": true`.
2. In the app: Flights → Book Travel → ATL → LAX, any date next month →
   Find My Flights. You should see ranked offers with airline logos.
3. Book one with fake passenger details — you'll get a confirmation code and
   the trip appears in the Plans tab. The order also appears in the Duffel
   dashboard (Orders) and in Firestore `bookings`.

## Going LIVE later (real money — do NOT rush this)

- Duffel live mode requires account verification + funding a balance (or
  Duffel Payments for card processing) and agreeing to their commercial terms.
- Revenue comes from Duffel's managed-content commissions + optional markup —
  the `bookings` ledger already has `markup`/`commission` fields waiting.
- iOS note: flight bookings are physical goods/services — Apple allows Stripe/
  Duffel payments for these (the IAP rule only applies to digital goods like
  the Diamond subscription).

## If something breaks

- "Apollo's booking desk opens soon" card = the function isn't deployed or the
  key isn't bound (check `__diag`).
- Remember the v2-functions lesson: secrets only bind when DECLARED in the
  function's `options.secrets` AND the function code actually redeploys — bump
  the version comment at the top of functions/index.js to force it.
