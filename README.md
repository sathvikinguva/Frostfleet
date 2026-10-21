# Frostfleet
> Bicycle ice-cream fleet operations dashboard for vendors, warehouse teams, and managers.
**Live app:** [https://frostfleet.vercel.app/](https://frostfleet.vercel.app/)
## About
Frostfleet is a role-based web application for coordinating a bicycle ice-cream vending operation.
Vendors record their daily activity from the field, warehouse staff manage products and stock,
and managers review sales, demand, profitability, vendor performance, and refrigerator conditions.
It is built as a front-end prototype with React and Vite.
## Main features
- Role-specific sign-in for vendors, warehouse managers, and managers.
- Create and manage ice-cream flavors with cost, selling price, and warehouse quantity.
- Track each vendor's allotted, sold, spoiled, and remaining stock.
- Log refrigerator temperatures and show safe, warning, and critical statuses.
- Review revenue, cost of goods, spoilage loss, gross profit, and net profit.
- Explore sales by area, time of day, and season.
- Review vendor sales, sell-through, profit, spoilage, and temperature compliance.
- Keep multiple open tabs synchronized using browser storage events.
## User roles
### Vendor
Vendors set their current location and log refrigerator readings.
Their dashboard shows available stock, recent sales, and recent temperature logs.
### Warehouse manager
Warehouse managers create flavors, set pricing, and maintain warehouse inventory.
They can view sales and stock reports and reset business data when needed.
### Manager
Managers review the business-wide profit and loss summary.
They can inspect sales, area demand, seasonal demand, vendor performance, and refrigerator status.
## Demo accounts
Use these accounts to explore the live app or a local run.
The password for each default account is `123456`.
| Role | Email |
| --- | --- |
| Vendor | `vendor1@gmail.com` |
| Warehouse manager | `warehousemanager@gmail.com` |
| Manager | `manager@gmail.com` |
The warehouse manager can add additional vendor email and password accounts in the app.
## Refrigerator rules
The safe operating band is **−29 °C to −18 °C**.
A reading warmer than **−20 °C** triggers a drift warning while still within the safe band.
Plausible readings outside the safe band require vendor confirmation before they are recorded as a breach.
Values colder than −40 °C or warmer than 25 °C are rejected as implausible.
Temperature checks are expected every 15 minutes; overdue readings are highlighted on the vendor dashboard.
## Technology
- React 19 for the user interface.
- Vite 8 for local development and production builds.
- Browser `localStorage` for business data and the signed-in session.
- Oxlint for linting.
- Vercel for the deployed web app.
## Data and prototype limits
Business records are saved in the current browser's `localStorage` under `frostfleet_db_v1`.
The sign-in session is stored separately under `frostfleet_session_v1`.
Data is local to a browser profile and is not shared across devices or users.
Clearing browser storage removes locally saved business records and session information.
The project has no server API or remote database in this prototype.
A fresh browser starts without seeded sales, stock, or temperature records.
The dashboards populate as users enter flavors, allocations, sales, spoilage, and readings.
## Run locally
Install Node.js and npm, then open a terminal in the project directory.
If the repository is cloned at its root, enter the app folder:
```bash
cd icing-app
```
Install dependencies:
```bash
npm install
```
Start the Vite development server:
```bash
npm run dev
```
Open the local URL printed by Vite, usually `http://localhost:5173`.
Create a production build with:
```bash
npm run build
```
The generated static site is written to `dist/`.
Preview the production build locally with `npm run preview`.
Run the configured linter with `npm run lint`.
## Deploy on Vercel
Import the GitHub repository into Vercel and choose the `icing-app` root directory.
Set the framework preset to **Vite**, the build command to `npm run build`, and output directory to `dist`.
Deploy the project; pushes to the connected production branch trigger new deployments.
## Suggested walkthrough
1. Sign in as the warehouse manager and create flavors with prices and initial stock.
2. Allocate flavor stock to Vendor 1 from the warehouse dashboard.
3. Sign in as the vendor, set a location, and record a refrigerator temperature.
4. Record a sale and, if useful, report spoilage with a reason.
5. Sign in as the manager to explore profit, demand, vendor, and refrigerator reports.
6. Try the vendor and warehouse dashboards in separate tabs to see same-browser updates.
## Project structure
- `src/App.jsx` handles the signed-in shell and role-based dashboard selection.
- `src/store.js` contains browser storage, authentication, temperature rules, and stock helpers.
- `src/analytics.js` computes reporting and dashboard aggregates.
- `src/pages/` contains the vendor, warehouse, and manager dashboards.
- `src/components/` contains shared forms, tables, charts, icons, and reports.
- `src/styles.css` defines the application styling.
- `public/` contains static icons and the favicon.
## License
No license file is currently included in this repository.

