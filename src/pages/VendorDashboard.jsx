import { useEffect, useRef, useState } from "react";
import {
  useDb, update, uid, vendorStock, flavorName, money, tempStatus, validateTemp,
  TEMP_INTERVAL_MIN, MIN_TEMP, MAX_TEMP,
} from "../store";
import { fridgeStatus, dayKey } from "../analytics";
import { Card, Stat, Field, Table, TempBadge, fmtTime } from "../components/ui";
import { flavorColor } from "../components/charts";
import { Icon } from "../components/icons";

// Display range for the little temperature meter.
const SCALE_LO = -35;
const SCALE_HI = -12;
const pct = (v) => ((Math.min(SCALE_HI, Math.max(SCALE_LO, v)) - SCALE_LO) / (SCALE_HI - SCALE_LO)) * 100;

export default function VendorDashboard({ user }) {
  const db = useDb();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const location = db.vendorState[user.id]?.location || "";
  const locRef = useRef(null);

  const stock = vendorStock(db, user.id);
  const available = stock.filter((s) => s.remaining > 0);
  const fridge = fridgeStatus(db, user.id, now);

  const [temp, setTemp] = useState("");
  const [tempErr, setTempErr] = useState(null); // { hard } | { breach }
  const [sale, setSale] = useState({ flavorId: "", qty: 1 });
  const [spoil, setSpoil] = useState({ flavorId: "", qty: 1, reason: "Refrigeration failure" });
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2800); };

  const needLocation = () => {
    if (!location) { flash("Set your current location first."); return true; }
    return false;
  };

  const saveLocation = (e) => {
    e.preventDefault();
    const loc = locRef.current.value.trim();
    if (!loc) return;
    update((d) => { d.vendorState[user.id] = { ...(d.vendorState[user.id] || {}), location: loc }; });
    flash(`Location set to ${loc}`);
  };

  // `force` is the vendor confirming an out-of-band reading is genuine, which
  // records it as a freezer failure rather than silently dropping it.
  const logTemp = (e, force = false) => {
    e?.preventDefault();
    const problem = validateTemp(temp);
    if (problem?.hard || (problem?.breach && !force)) return setTempErr(problem);
    if (needLocation()) return;
    update((d) => d.tempLogs.push({
      id: uid("t"), vendorId: user.id, temp: Number(temp), location, breach: !!problem?.breach, at: Date.now(),
    }));
    setTemp("");
    setTempErr(null);
    flash(problem?.breach ? "Freezer failure logged — the warehouse can see it" : "Temperature logged");
  };

  const recordSale = (e) => {
    e.preventDefault();
    const row = stock.find((s) => s.flavorId === sale.flavorId);
    const qty = Number(sale.qty);
    if (!row || qty < 1) return;
    if (qty > row.remaining) return flash(`Only ${row.remaining} left of ${flavorName(db, row.flavorId)}`);
    if (needLocation()) return;
    const f = db.flavors.find((x) => x.id === sale.flavorId);
    update((d) => d.sales.push({
      id: uid("s"), vendorId: user.id, flavorId: f.id, qty, location,
      unitPrice: f.sellPrice, unitCost: f.costPrice, at: Date.now(),
    }));
    setSale({ flavorId: "", qty: 1 });
    flash(`Sold ${qty} × ${f.name}`);
  };

  const reportSpoilage = (e) => {
    e.preventDefault();
    const row = stock.find((s) => s.flavorId === spoil.flavorId);
    const qty = Number(spoil.qty);
    if (!row || qty < 1) return;
    if (qty > row.remaining) return flash(`Only ${row.remaining} left of ${flavorName(db, row.flavorId)}`);
    const f = db.flavors.find((x) => x.id === spoil.flavorId);
    update((d) => d.spoilage.push({
      id: uid("x"), vendorId: user.id, flavorId: f.id, qty, location, reason: spoil.reason, unitCost: f.costPrice, at: Date.now(),
    }));
    setSpoil({ flavorId: "", qty: 1, reason: "Refrigeration failure" });
    flash(`Reported ${qty} × ${f.name} spoiled`);
  };

  const today = dayKey(Date.now());
  const todaySales = db.sales.filter((s) => s.vendorId === user.id && dayKey(s.at) === today);
  const todayUnits = todaySales.reduce((a, s) => a + s.qty, 0);
  const todayRevenue = todaySales.reduce((a, s) => a + s.qty * s.unitPrice, 0);
  const recent = [...db.sales.filter((s) => s.vendorId === user.id)].sort((a, b) => b.at - a.at).slice(0, 10);
  const recentTemps = [...fridge.logs].slice(0, 8);
  const typed = temp === "" ? null : Number(temp);

  return (
    <>
      {fridge.overdue && (
        <div className="banner critical">
          <Icon.clock size={18} />
          <span>
            Temperature log is due — {fridge.last ? `last logged ${fridge.minsSince} min ago` : "no reading yet"}.
            Log it every {TEMP_INTERVAL_MIN} minutes.
          </span>
        </div>
      )}
      {!fridge.overdue && fridge.status === "critical" && (
        <div className="banner critical">
          <Icon.alert size={18} />
          <span>Last reading {fridge.last.temp} °C is outside the {MIN_TEMP} °C to {MAX_TEMP} °C band. Return to the depot before the stock is lost.</span>
        </div>
      )}
      {!fridge.overdue && fridge.status === "warning" && (
        <div className="banner warning">
          <Icon.alert size={18} />
          <span>Last reading {fridge.last.temp} °C is drifting toward the {MAX_TEMP} °C limit. Keep the lid shut and check the ice.</span>
        </div>
      )}
      {msg && <div className="toast">{msg}</div>}

      <div className="stats">
        <Stat label="Sold today" value={todayUnits} sub="units" icon={<Icon.cart size={19} />} accent="blue" />
        <Stat label="Revenue today" value={money(todayRevenue)} icon={<Icon.wallet size={19} />} accent="green" />
        <Stat label="In box" value={stock.reduce((a, s) => a + s.remaining, 0)} sub="units left" icon={<Icon.box size={19} />} accent="orange" />
        <Stat
          label="Fridge"
          value={fridge.last ? `${fridge.last.temp} °C` : "—"}
          sub={fridge.last ? `${fridge.minsSince} min ago` : "no reading"}
          icon={<Icon.thermo size={19} />}
          accent={fridge.overdue || fridge.status === "critical" ? "red" : fridge.status === "warning" ? "orange" : "violet"}
          tone={fridge.overdue ? "critical" : fridge.status}
        />
      </div>

      <div className="grid-2">
        <Card title="Current location" subtitle="Every sale and temperature log is tagged with this." icon={<Icon.pin size={17} />}>
          <form className="row" onSubmit={saveLocation}>
            <input key={location} ref={locRef} defaultValue={location} placeholder="e.g. Gachibowli, Lane 4" />
            <button className="primary" type="submit">Set</button>
          </form>
          {location && <p className="muted small">Now at <b>{location}</b></p>}
        </Card>

        <Card
          title="Log refrigerator temperature"
          subtitle={`Every ${TEMP_INTERVAL_MIN} min · must read between ${MIN_TEMP} °C and ${MAX_TEMP} °C`}
          icon={<Icon.thermo size={17} />}
        >
          {/* noValidate so the custom band message shows instead of the native tooltip */}
          <form className="row" noValidate onSubmit={logTemp}>
            <input
              type="number" step="0.5" min={MIN_TEMP} max={MAX_TEMP} placeholder={`${MIN_TEMP} to ${MAX_TEMP}`}
              value={temp}
              onChange={(e) => { setTemp(e.target.value); setTempErr(null); }}
            />
            <span className="unit">°C</span>
            <button className="primary" type="submit">Log</button>
          </form>

          <div className="temp-scale">
            <div className="temp-track">
              <div className="temp-band" style={{ left: `${pct(MIN_TEMP)}%`, right: `${100 - pct(MAX_TEMP)}%` }} />
              {typed != null && !Number.isNaN(typed) && (
                <div className="temp-needle" style={{ left: `calc(${pct(typed)}% - 1.5px)` }} />
              )}
            </div>
            <div className="temp-marks">
              <span>{SCALE_LO}°</span><span>safe {MIN_TEMP}° to {MAX_TEMP}°</span><span>{SCALE_HI}°</span>
            </div>
          </div>

          {tempErr?.hard && <div className="error" style={{ marginTop: 10 }}>{tempErr.hard}</div>}
          {tempErr?.breach && (
            <div className="stack" style={{ marginTop: 10 }}>
              <div className="error">{tempErr.breach}</div>
              <div className="row">
                <button type="button" className="danger" onClick={() => logTemp(null, true)}>
                  This reading is real — log a freezer failure
                </button>
                <button type="button" className="link" onClick={() => { setTemp(""); setTempErr(null); }}>Re-enter</button>
              </div>
            </div>
          )}
          {!tempErr && typed != null && !Number.isNaN(typed) && (
            <p style={{ marginTop: 10 }}><TempBadge status={tempStatus(typed)} /></p>
          )}
        </Card>
      </div>

      <Card title="My allotted ice creams" icon={<Icon.box size={17} />}>
        <Table
          keyFn={(r) => r.flavorId}
          columns={[
            { key: "flavor", label: "Flavor", render: (r) => <><i className="dot" style={{ background: flavorColor(db.flavors, r.flavorId) }} />{flavorName(db, r.flavorId)}</> },
            { key: "price", label: "Price", align: "num", render: (r) => money(db.flavors.find((f) => f.id === r.flavorId)?.sellPrice) },
            { key: "allotted", label: "Allotted", align: "num" },
            { key: "sold", label: "Sold", align: "num" },
            { key: "spoiled", label: "Spoiled", align: "num" },
            { key: "remaining", label: "Left", align: "num", render: (r) => <b>{r.remaining}</b> },
          ]}
          rows={stock}
          empty="The warehouse hasn't allotted any ice creams to you yet."
        />
      </Card>

      <div className="grid-2">
        <Card title="Record a sale" icon={<Icon.cart size={17} />}>
          <form className="stack" onSubmit={recordSale}>
            <Field label="Flavor">
              <select value={sale.flavorId} onChange={(e) => setSale({ ...sale, flavorId: e.target.value })} required>
                <option value="">Select flavor…</option>
                {available.map((s) => (
                  <option key={s.flavorId} value={s.flavorId}>{flavorName(db, s.flavorId)} ({s.remaining} left)</option>
                ))}
              </select>
            </Field>
            <Field label="Quantity">
              <input type="number" min="1" value={sale.qty} onChange={(e) => setSale({ ...sale, qty: e.target.value })} required />
            </Field>
            <button className="primary" type="submit" disabled={!available.length}>Record sale</button>
          </form>
        </Card>

        <Card title="Report spoilage" subtitle="Melted / refrozen stock that can't be sold" icon={<Icon.alert size={17} />}>
          <form className="stack" onSubmit={reportSpoilage}>
            <Field label="Flavor">
              <select value={spoil.flavorId} onChange={(e) => setSpoil({ ...spoil, flavorId: e.target.value })} required>
                <option value="">Select flavor…</option>
                {available.map((s) => (
                  <option key={s.flavorId} value={s.flavorId}>{flavorName(db, s.flavorId)} ({s.remaining} left)</option>
                ))}
              </select>
            </Field>
            <Field label="Quantity">
              <input type="number" min="1" value={spoil.qty} onChange={(e) => setSpoil({ ...spoil, qty: e.target.value })} required />
            </Field>
            <Field label="Reason">
              <select value={spoil.reason} onChange={(e) => setSpoil({ ...spoil, reason: e.target.value })}>
                <option>Refrigeration failure</option>
                <option>Damaged packaging</option>
                <option>Expired</option>
                <option>Other</option>
              </select>
            </Field>
            <button type="submit" disabled={!available.length}>Report</button>
          </form>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="My recent sales" icon={<Icon.clock size={17} />}>
          <Table
            keyFn={(r) => r.id}
            columns={[
              { key: "at", label: "Time", render: (r) => fmtTime(r.at) },
              { key: "flavor", label: "Flavor", render: (r) => flavorName(db, r.flavorId) },
              { key: "qty", label: "Qty", align: "num" },
              { key: "location", label: "Location" },
            ]}
            rows={recent}
            empty="No sales recorded yet."
          />
        </Card>
        <Card title="My temperature logs" icon={<Icon.thermo size={17} />}>
          <Table
            keyFn={(r) => r.id}
            columns={[
              { key: "at", label: "Time", render: (r) => fmtTime(r.at) },
              { key: "temp", label: "°C", align: "num" },
              { key: "status", label: "Status", render: (r) => <TempBadge status={tempStatus(r.temp)} /> },
              { key: "location", label: "Location" },
            ]}
            rows={recentTemps}
            empty="No temperature logs yet."
          />
        </Card>
      </div>
    </>
  );
}
