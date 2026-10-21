// Report widgets shared by the warehouse and manager dashboards.
import { useEffect, useState } from "react";
import { useDb, vendors, vendorStock, flavorName, money, TEMP_INTERVAL_MIN, MIN_TEMP, MAX_TEMP } from "../store";
import {
  unitsByLocation, unitsByHour, unitsByDay, revenueByDay,
  flavorStack, fridgeStatus, SEASONS, MONTHS, seasonOf,
} from "../analytics";
import { BarChart, SimpleBars, LineChart, SERIES, flavorColor, Empty } from "./charts";
import { Card, Table, TempBadge, fmtTime, Field } from "./ui";
import { Icon } from "./icons";

function withColors(stack, flavors) {
  return stack.series.map((s) => ({ ...s, color: flavorColor(flavors, s.id) }));
}

/** Which flavor sells where. */
export function LocationDemand() {
  const db = useDb();
  const byLoc = unitsByLocation(db.sales);
  const cats = byLoc.map((d) => d.label);
  const stack = flavorStack(db.sales, (s) => s.location || "Unknown", cats, db.flavors);
  const rows = cats.map((loc) => {
    const sales = db.sales.filter((s) => (s.location || "Unknown") === loc);
    const perFlavor = new Map();
    for (const s of sales) perFlavor.set(s.flavorId, (perFlavor.get(s.flavorId) || 0) + s.qty);
    const top = [...perFlavor].sort((a, b) => b[1] - a[1])[0];
    return {
      loc,
      units: sales.reduce((a, s) => a + s.qty, 0),
      revenue: sales.reduce((a, s) => a + s.qty * s.unitPrice, 0),
      top: top ? `${flavorName(db, top[0])} (${top[1]})` : "–",
    };
  });
  return (
    <>
      <Card title="Flavor demand by location" subtitle="Units sold per area, split by flavor" icon={<Icon.pin size={17} />}>
        <BarChart categories={cats} series={withColors(stack, db.flavors)} />
      </Card>
      <Card title="Areas ranked">
        <Table
          keyFn={(r) => r.loc}
          columns={[
            { key: "loc", label: "Location" },
            { key: "units", label: "Units", align: "num" },
            { key: "revenue", label: "Revenue", align: "num", render: (r) => money(r.revenue) },
            { key: "top", label: "Top flavor" },
          ]}
          rows={rows}
          empty="No sales recorded yet - vendors log sales from their dashboard."
        />
      </Card>
    </>
  );
}

/** Time-of-day, month and season demand. */
export function TimeDemand() {
  const db = useDb();
  const seasonStack = flavorStack(db.sales, (s) => seasonOf(s.at), SEASONS, db.flavors);
  const monthStack = flavorStack(db.sales, (s) => MONTHS[new Date(s.at).getMonth()], MONTHS, db.flavors);
  return (
    <>
      <Card title="Season demand" subtitle="Summer Mar–Jun · Monsoon Jul–Sep · Autumn Oct–Nov · Winter Dec–Feb" icon={<Icon.sun size={17} />}>
        <BarChart categories={SEASONS} series={withColors(seasonStack, db.flavors)} />
      </Card>
      <Card title="Monthly demand by flavor">
        <BarChart categories={MONTHS} series={withColors(monthStack, db.flavors)} />
      </Card>
      <Card title="Time of day" subtitle="Units sold by hour - when the bicycles should be out" icon={<Icon.clock size={17} />}>
        <SimpleBars data={unitsByHour(db.sales)} color={SERIES[1]} />
      </Card>
    </>
  );
}

/** Daily units + revenue, and a per-flavor breakdown. */
export function SalesTracking({ showRevenue = true }) {
  const db = useDb();
  const [days, setDays] = useState(14);
  const byDay = unitsByDay(db.sales, days);
  const rev = revenueByDay(db.sales, days);
  const flavorTotals = db.flavors
    .map((f) => {
      const rows = db.sales.filter((s) => s.flavorId === f.id);
      return { f, units: rows.reduce((a, s) => a + s.qty, 0), revenue: rows.reduce((a, s) => a + s.qty * s.unitPrice, 0) };
    })
    .filter((r) => r.units > 0)
    .sort((a, b) => b.units - a.units);
  const recent = [...db.sales].sort((a, b) => b.at - a.at).slice(0, 15);
  const vendorName = (id) => db.users.find((u) => u.id === id)?.name ?? "–";

  const range = (
    <div className="seg">
      {[7, 14, 30].map((d) => (
        <button key={d} className={d === days ? "active" : ""} onClick={() => setDays(d)}>{d}d</button>
      ))}
    </div>
  );

  return (
    <>
      <Card title="Units sold per day" actions={range} icon={<Icon.chart size={17} />}>
        <LineChart categories={byDay.map((d) => d.label)} series={[{ name: "Units", color: SERIES[0], values: byDay.map((d) => d.value) }]} />
      </Card>
      {showRevenue && (
        <Card title="Revenue per day">
          <LineChart categories={rev.map((d) => d.label)} series={[{ name: "Revenue", color: SERIES[2], values: rev.map((d) => d.value) }]} format={money} />
        </Card>
      )}
      <Card title="Sales by flavor (all time)">
        <Table
          keyFn={(r) => r.f.id}
          columns={[
            { key: "name", label: "Flavor", render: (r) => <><i className="dot" style={{ background: flavorColor(db.flavors, r.f.id) }} />{r.f.name}</> },
            { key: "units", label: "Units", align: "num" },
            { key: "revenue", label: "Revenue", align: "num", render: (r) => money(r.revenue) },
          ]}
          rows={flavorTotals}
          empty="No sales yet."
        />
      </Card>
      <Card title="Recent sales">
        <Table
          keyFn={(r) => r.id}
          columns={[
            { key: "at", label: "Time", render: (r) => fmtTime(r.at) },
            { key: "vendor", label: "Vendor", render: (r) => vendorName(r.vendorId) },
            { key: "flavor", label: "Flavor", render: (r) => flavorName(db, r.flavorId) },
            { key: "qty", label: "Qty", align: "num" },
            { key: "location", label: "Location" },
            { key: "amt", label: "Amount", align: "num", render: (r) => money(r.qty * r.unitPrice) },
          ]}
          rows={recent}
          empty="No sales yet."
        />
      </Card>
    </>
  );
}

/** Stock on hand and sold per vendor. */
export function VendorStockTable() {
  const db = useDb();
  const list = vendors(db);
  if (!list.length) return <Empty>No vendors added yet.</Empty>;
  return list.map((v) => {
    const stock = vendorStock(db, v.id);
    return (
      <Card key={v.id} title={v.name} subtitle={`${v.email}${v.area ? " · " + v.area : ""} · now at: ${db.vendorState[v.id]?.location || "not set"}`}>
        <Table
          keyFn={(r) => r.flavorId}
          columns={[
            { key: "flavor", label: "Flavor", render: (r) => <><i className="dot" style={{ background: flavorColor(db.flavors, r.flavorId) }} />{flavorName(db, r.flavorId)}</> },
            { key: "allotted", label: "Allotted", align: "num" },
            { key: "sold", label: "Sold", align: "num" },
            { key: "spoiled", label: "Spoiled", align: "num" },
            { key: "remaining", label: "Available", align: "num", render: (r) => <b>{r.remaining}</b> },
          ]}
          rows={stock}
          empty="Nothing allotted to this vendor yet."
        />
      </Card>
    );
  });
}

/** Live refrigerator status for every vendor. Re-evaluates every 30s. */
export function FridgeTracking() {
  const db = useDb();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const [sel, setSel] = useState("");
  const list = vendors(db);
  if (!list.length) return <Empty>No vendors added yet.</Empty>;

  const rows = list.map((v) => ({ v, ...fridgeStatus(db, v.id, now) }));
  const selected = rows.find((r) => r.v.id === sel) || rows[0];
  const history = [...selected.logs].reverse().slice(-48);

  return (
    <>
      <Card
        title="Refrigerator status"
        subtitle={`Vendors log temperature every ${TEMP_INTERVAL_MIN} minutes. Safe band ${MIN_TEMP} °C to ${MAX_TEMP} °C.`}
        icon={<Icon.thermo size={17} />}
      >
        <Table
          keyFn={(r) => r.v.id}
          columns={[
            { key: "name", label: "Vendor", render: (r) => r.v.name },
            { key: "temp", label: "Last temp", align: "num", render: (r) => (r.last ? `${r.last.temp} °C` : "–") },
            { key: "status", label: "Status", render: (r) => <TempBadge status={r.status} /> },
            {
              key: "since", label: "Last log",
              render: (r) => r.last
                ? <span className={r.overdue ? "text-critical" : ""}>{r.minsSince} min ago{r.overdue ? " · OVERDUE" : ""}</span>
                : <span className="text-critical">never</span>,
            },
            { key: "loc", label: "Location", render: (r) => r.last?.location || "–" },
            { key: "exc", label: "Excursions", align: "num", render: (r) => `${r.excursions}/${r.logs.length}` },
            {
              key: "comp", label: "Compliance", align: "num",
              render: (r) => (r.compliance == null ? "–" : `${Math.round(r.compliance * 100)}%`),
            },
          ]}
          rows={rows}
        />
      </Card>
      <Card
        title="Temperature history"
        actions={
          <Field label="Vendor">
            <select value={selected.v.id} onChange={(e) => setSel(e.target.value)}>
              {list.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
        }
      >
        {history.length ? (
          <LineChart
            categories={history.map((l) => new Date(l.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }))}
            series={[{ name: "°C", color: SERIES[0], values: history.map((l) => l.temp) }]}
            format={(v) => `${v}°`}
            zeroBased={false}
            band={{ min: MIN_TEMP, max: MAX_TEMP, label: `Safe band ${MIN_TEMP}° to ${MAX_TEMP}°` }}
          />
        ) : (
          <Empty>No temperature logs from {selected.v.name} yet.</Empty>
        )}
      </Card>
    </>
  );
}
