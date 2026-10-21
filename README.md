# Frostfleet – bicycle ice-cream operations (prototype)

React + Vite front-end prototype. All data lives in the browser's `localStorage`
(key `frostfleet_db_v1`). There is no seeded demo data — every number on every
dashboard comes from what the warehouse manager and vendors enter.

## Run

```bash
npm install --include=dev
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

## Accounts (password `123456`)

| Email | Role |
|---|---|
| `vendor1@gmail.com` | Vendor |
| `warehousemanager@gmail.com` | Warehouse manager |
| `manager@gmail.com` | Manager |

The warehouse manager can add more vendor accounts (email + password) from the
**Vendors** tab.

## Refrigerator rules

| Rule | Value |
|---|---|
| Logging interval | every 15 min (overdue banner on the vendor dashboard) |
| Safe operating band | **−29 °C to −18 °C** |
| Drift warning | warmer than −20 °C (still in band, heading for the limit) |
| Rejected outright | anything beyond −40 °C … 25 °C (e.g. −100 °C) |

A reading outside the safe band but still physically plausible (say −5 °C) is
**not** stored silently — the vendor is asked to confirm it as a freezer
failure. That keeps a genuinely warm ice box reportable, which is the whole
point of tracking the cold chain, while still rejecting typos. Confirmed
breaches show as *Out of range* on the warehouse and manager dashboards and
count against the vendor's temperature compliance.

## Suggested walkthrough

1. **Warehouse manager** → *Flavors & stock*: add a flavor with cost price,
   selling price and initial stock. → *Assign stock*: allot units to Vendor 1.
2. **Vendor 1** → set current location → log refrigerator temperature →
   record sales / report spoilage from the allotted stock.
3. **Manager** → profit/loss, sales tracking, area demand, season demand,
   vendor scorecard, refrigerator tracking — all populated from steps 1–2.

Open two browser tabs (vendor + warehouse) and the dashboards update live
across tabs.

## Layout

- `src/store.js` – localStorage store, auth, temperature rules, domain helpers
- `src/analytics.js` – aggregations (by location / hour / month / season, P&L, vendor performance, fridge status)
- `src/components/charts.jsx` – SVG bar & line charts with hover tooltips
- `src/components/icons.jsx` – inline stroke icon set
- `src/components/Reports.jsx` – report widgets shared by warehouse & manager
- `src/pages/*Dashboard.jsx` – one page per role
