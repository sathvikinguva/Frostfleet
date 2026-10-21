// Single localStorage-backed store. Everything the app shows is derived from
// what the warehouse manager and vendors enter - no seeded demo records.
import { useSyncExternalStore } from "react";

const KEY = "frostfleet_db_v1";
const SESSION_KEY = "frostfleet_session_v1";

export const ROLES = { VENDOR: "vendor", WAREHOUSE: "warehouse", MANAGER: "manager" };

// Login accounts only (these are credentials, not business data).
const DEFAULT_USERS = [
  { id: "u_vendor1", name: "Vendor 1", email: "vendor1@gmail.com", password: "123456", role: ROLES.VENDOR, area: "" },
  { id: "u_wh", name: "Warehouse Manager", email: "warehousemanager@gmail.com", password: "123456", role: ROLES.WAREHOUSE },
  { id: "u_mgr", name: "Manager", email: "manager@gmail.com", password: "123456", role: ROLES.MANAGER },
];

const EMPTY_DB = {
  users: DEFAULT_USERS,
  flavors: [],      // {id, name, costPrice, sellPrice, warehouseQty, createdAt}
  allocations: [],  // {id, vendorId, flavorId, qty, at}
  sales: [],        // {id, vendorId, flavorId, qty, location, unitPrice, unitCost, at}
  spoilage: [],     // {id, vendorId, flavorId, qty, location, reason, unitCost, at}
  tempLogs: [],     // {id, vendorId, temp, location, breach, at}
  vendorState: {},  // vendorId -> { location }
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY_DB);
    const state = { ...structuredClone(EMPTY_DB), ...JSON.parse(raw) };
    // Earlier builds shipped the warehouse manager under a misspelled address.
    for (const u of state.users) {
      if (u.email === "wearhousemanager@gmail.com") u.email = "warehousemanager@gmail.com";
    }
    const seen = new Set();
    state.users = state.users.filter((u) => {
      const k = u.email.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // Make sure the three login accounts always exist.
    for (const u of DEFAULT_USERS) if (!seen.has(u.email)) state.users.push(u);
    return state;
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

let db = load();
const listeners = new Set();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener) {
  listeners.add(listener);
  // Keep tabs in sync: a vendor logging sales in one tab shows up in the
  // warehouse dashboard in another.
  const onStorage = (e) => {
    if (e.key === KEY) {
      db = load();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getDb() {
  return db;
}

export function update(mutator) {
  const next = structuredClone(db);
  mutator(next);
  db = next;
  localStorage.setItem(KEY, JSON.stringify(db));
  emit();
}

export function useDb() {
  return useSyncExternalStore(subscribe, getDb, getDb);
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function resetAll() {
  localStorage.removeItem(KEY);
  db = load();
  emit();
}

// ---- session -------------------------------------------------------------

export function login(email, password) {
  const user = db.users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
  );
  if (!user) return null;
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function currentUser() {
  const id = localStorage.getItem(SESSION_KEY);
  return db.users.find((u) => u.id === id) || null;
}

// ---- refrigerator rules ---------------------------------------------------

// Operating band the ice box must hold. A normal reading lives in here.
export const MIN_TEMP = -29; // coldest the box should run
export const MAX_TEMP = -18; // warmest the box may get before product is at risk
export const DRIFT_TEMP = -20; // still inside the band, but creeping toward the limit

// Hard sanity limits - nothing outside this can be a real reading from an ice
// box, so values like -100 are rejected outright.
export const ABS_MIN_TEMP = -40;
export const ABS_MAX_TEMP = 25;

export const TEMP_INTERVAL_MIN = 15;

export function tempStatus(temp) {
  if (temp == null || Number.isNaN(temp)) return "none";
  if (temp < MIN_TEMP || temp > MAX_TEMP) return "critical";
  if (temp > DRIFT_TEMP) return "warning";
  return "good";
}

export function inBand(temp) {
  return temp >= MIN_TEMP && temp <= MAX_TEMP;
}

/**
 * Validates a typed reading.
 *  - null            -> accept, it is a normal in-band reading
 *  - {hard: msg}     -> impossible value, never store it
 *  - {breach: msg}   -> plausible but outside the band; only stored when the
 *                       vendor confirms it as a freezer failure, so a genuinely
 *                       warm box can still be reported.
 */
export function validateTemp(temp) {
  if (temp === "" || temp == null || Number.isNaN(Number(temp))) {
    return { hard: "Enter a temperature." };
  }
  const t = Number(temp);
  if (t < ABS_MIN_TEMP || t > ABS_MAX_TEMP) {
    return { hard: `${t} °C is not a possible reading. Enter a value between ${MIN_TEMP} °C and ${MAX_TEMP} °C.` };
  }
  if (t > MAX_TEMP) {
    return { breach: `${t} °C is above the ${MAX_TEMP} °C limit - the box is too warm.` };
  }
  if (t < MIN_TEMP) {
    return { breach: `${t} °C is below the ${MIN_TEMP} °C limit - the box is running too cold.` };
  }
  return null;
}

// ---- domain helpers used by multiple pages -------------------------------

export function vendorStock(dbState, vendorId) {
  // allotted - sold - spoiled, per flavor
  const map = {};
  const bump = (flavorId, key, qty) => {
    map[flavorId] ??= { allotted: 0, sold: 0, spoiled: 0 };
    map[flavorId][key] += qty;
  };
  for (const a of dbState.allocations) if (a.vendorId === vendorId) bump(a.flavorId, "allotted", a.qty);
  for (const s of dbState.sales) if (s.vendorId === vendorId) bump(s.flavorId, "sold", s.qty);
  for (const s of dbState.spoilage) if (s.vendorId === vendorId) bump(s.flavorId, "spoiled", s.qty);
  return Object.entries(map).map(([flavorId, v]) => ({
    flavorId,
    ...v,
    remaining: v.allotted - v.sold - v.spoiled,
  }));
}

export function vendors(dbState) {
  return dbState.users.filter((u) => u.role === ROLES.VENDOR);
}

export function flavorName(dbState, id) {
  return dbState.flavors.find((f) => f.id === id)?.name ?? "Unknown";
}

export function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
