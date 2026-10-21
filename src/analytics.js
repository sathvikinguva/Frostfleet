// Pure aggregation helpers over the store. All return plain arrays suited to
// the chart components.
import { TEMP_INTERVAL_MIN, tempStatus } from "./store";

export const SEASONS = ["Summer", "Monsoon", "Autumn", "Winter"];
export function seasonOf(date) {
  const m = new Date(date).getMonth(); // 0-11
  if (m >= 2 && m <= 5) return "Summer";   // Mar-Jun
  if (m >= 6 && m <= 8) return "Monsoon";  // Jul-Sep
  if (m >= 9 && m <= 10) return "Autumn";  // Oct-Nov
  return "Winter";                         // Dec-Feb
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function sumBy(rows, keyFn, valFn = (r) => r.qty) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) || 0) + valFn(r));
  }
  return m;
}

// ---- single-series -------------------------------------------------------

export function unitsByLocation(sales) {
  return [...sumBy(sales, (s) => s.location || "Unknown")]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function unitsByHour(sales) {
  const m = sumBy(sales, (s) => new Date(s.at).getHours());
  return Array.from({ length: 24 }, (_, h) => ({ label: `${h}:00`, value: m.get(h) || 0 }));
}

export function unitsByMonth(sales) {
  const m = sumBy(sales, (s) => new Date(s.at).getMonth());
  return MONTHS.map((label, i) => ({ label, value: m.get(i) || 0 }));
}

export function unitsBySeason(sales) {
  const m = sumBy(sales, (s) => seasonOf(s.at));
  return SEASONS.map((label) => ({ label, value: m.get(label) || 0 }));
}

export function unitsByDay(sales, days = 14) {
  const m = sumBy(sales, (s) => dayKey(s.at));
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = dayKey(d);
    out.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: m.get(k) || 0 });
  }
  return out;
}

export function revenueByDay(sales, days = 14) {
  const m = sumBy(sales, (s) => dayKey(s.at), (s) => s.qty * s.unitPrice);
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: m.get(dayKey(d)) || 0 });
  }
  return out;
}

// ---- flavor-stacked (categories x flavors) --------------------------------

// Returns { categories, series:[{id,name,values}] } with at most `cap`
// flavors; the rest fold into "Other" so colors stay in fixed slots.
export function flavorStack(sales, categoryFn, categories, flavors, cap = 7) {
  const totals = sumBy(sales, (s) => s.flavorId);
  const ranked = flavors
    .map((f) => ({ ...f, total: totals.get(f.id) || 0 }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);
  const kept = ranked.slice(0, cap);
  const foldIds = new Set(ranked.slice(cap).map((f) => f.id));

  const cats = categories ?? [...new Set(sales.map(categoryFn))];
  const catIndex = new Map(cats.map((c, i) => [c, i]));
  const series = kept.map((f) => ({ id: f.id, name: f.name, values: cats.map(() => 0) }));
  const other = { id: "other", name: "Other", values: cats.map(() => 0) };
  const byId = new Map(series.map((s) => [s.id, s]));

  for (const s of sales) {
    const ci = catIndex.get(categoryFn(s));
    if (ci == null) continue;
    const target = foldIds.has(s.flavorId) ? other : byId.get(s.flavorId);
    if (target) target.values[ci] += s.qty;
  }
  if (foldIds.size) series.push(other);
  return { categories: cats, series };
}

// ---- per-vendor -----------------------------------------------------------

export function vendorPerformance(db) {
  return db.users
    .filter((u) => u.role === "vendor")
    .map((v) => {
      const sales = db.sales.filter((s) => s.vendorId === v.id);
      const spoil = db.spoilage.filter((s) => s.vendorId === v.id);
      const units = sales.reduce((a, s) => a + s.qty, 0);
      const revenue = sales.reduce((a, s) => a + s.qty * s.unitPrice, 0);
      const cost = sales.reduce((a, s) => a + s.qty * s.unitCost, 0);
      const spoiledUnits = spoil.reduce((a, s) => a + s.qty, 0);
      const spoilLoss = spoil.reduce((a, s) => a + s.qty * s.unitCost, 0);
      const allotted = db.allocations.filter((a) => a.vendorId === v.id).reduce((a, x) => a + x.qty, 0);
      const fridge = fridgeStatus(db, v.id);
      return {
        vendor: v,
        units,
        revenue,
        profit: revenue - cost - spoilLoss,
        spoiledUnits,
        spoilLoss,
        allotted,
        sellThrough: allotted ? units / allotted : 0,
        fridge,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function fridgeStatus(db, vendorId, now = Date.now()) {
  const logs = db.tempLogs.filter((t) => t.vendorId === vendorId).sort((a, b) => b.at - a.at);
  const last = logs[0] || null;
  const minsSince = last ? Math.max(0, Math.floor((now - last.at) / 60000)) : null;
  const overdue = last ? minsSince >= TEMP_INTERVAL_MIN : true;
  const excursions = logs.filter((l) => tempStatus(l.temp) !== "good").length;
  const compliance = logs.length ? 1 - excursions / logs.length : null;
  return { last, minsSince, overdue, status: tempStatus(last?.temp), excursions, logs, compliance };
}

export function profitLoss(db) {
  const revenue = db.sales.reduce((a, s) => a + s.qty * s.unitPrice, 0);
  const cogs = db.sales.reduce((a, s) => a + s.qty * s.unitCost, 0);
  const spoilLoss = db.spoilage.reduce((a, s) => a + s.qty * s.unitCost, 0);
  const units = db.sales.reduce((a, s) => a + s.qty, 0);
  const spoiledUnits = db.spoilage.reduce((a, s) => a + s.qty, 0);
  return { revenue, cogs, spoilLoss, grossProfit: revenue - cogs, netProfit: revenue - cogs - spoilLoss, units, spoiledUnits };
}
