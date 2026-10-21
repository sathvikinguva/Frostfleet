import { useState } from "react";
import { useDb, update, uid, vendors, vendorStock, flavorName, money, ROLES } from "../store";
import { Card, Stat, Field, Table, Tabs, fmtTime } from "../components/ui";
import { Icon } from "../components/icons";
import { flavorColor } from "../components/charts";
import { LocationDemand, TimeDemand, SalesTracking, VendorStockTable, FridgeTracking } from "../components/Reports";

const TABS = ["Vendors", "Flavors & stock", "Assign stock", "Vendor stock & sales", "Location demand", "Time demand", "Sales tracking", "Refrigerators"];

export default function WarehouseDashboard() {
  const [tab, setTab] = useState(TABS[0]);
  const db = useDb();
  const warehouseUnits = db.flavors.reduce((a, f) => a + f.warehouseQty, 0);
  const outWithVendors = vendors(db).reduce((a, v) => a + vendorStock(db, v.id).reduce((x, s) => x + s.remaining, 0), 0);
  const unitsSold = db.sales.reduce((a, s) => a + s.qty, 0);

  return (
    <>
      <div className="stats">
        <Stat label="Vendors" value={vendors(db).length} icon={<Icon.users size={19} />} accent="violet" />
        <Stat label="Flavors" value={db.flavors.length} icon={<Icon.layers size={19} />} accent="orange" />
        <Stat label="In warehouse" value={warehouseUnits} sub="units" icon={<Icon.box size={19} />} accent="blue" />
        <Stat label="Out with vendors" value={outWithVendors} sub="units unsold" icon={<Icon.cone size={19} />} accent="grey" />
        <Stat label="Units sold" value={unitsSold} sub="all time" icon={<Icon.cart size={19} />} accent="green" />
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "Vendors" && <Vendors />}
      {tab === "Flavors & stock" && <Flavors />}
      {tab === "Assign stock" && <Assign />}
      {tab === "Vendor stock & sales" && <VendorStockTable />}
      {tab === "Location demand" && <LocationDemand />}
      {tab === "Time demand" && <TimeDemand />}
      {tab === "Sales tracking" && <SalesTracking />}
      {tab === "Refrigerators" && <FridgeTracking />}
    </>
  );
}

function Vendors() {
  const db = useDb();
  const [form, setForm] = useState({ name: "", email: "", password: "123456", area: "" });
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === email)) return setErr("That email is already registered.");
    update((d) => d.users.push({ id: uid("u"), name: form.name.trim(), email, password: form.password, role: ROLES.VENDOR, area: form.area.trim() }));
    setForm({ name: "", email: "", password: "123456", area: "" });
    setErr("");
  };
  const remove = (id) => {
    if (!confirm("Remove this vendor? Their sales history stays in reports.")) return;
    update((d) => { d.users = d.users.filter((u) => u.id !== id); });
  };
  return (
    <div className="grid-2">
      <Card title="Add vendor" subtitle="The vendor signs in with this email and password." icon={<Icon.users size={17} />}>
        <form className="stack" onSubmit={submit}>
          <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Password"><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
          <Field label="Assigned area"><input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Madhapur" /></Field>
          {err && <div className="error">{err}</div>}
          <button className="primary" type="submit">Add vendor</button>
        </form>
      </Card>
      <Card title="Vendors">
        <Table
          keyFn={(r) => r.id}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "area", label: "Area", render: (r) => r.area || "–" },
            { key: "x", label: "", render: (r) => <button className="link" onClick={() => remove(r.id)}>Remove</button> },
          ]}
          rows={vendors(db)}
          empty="No vendors yet."
        />
      </Card>
    </div>
  );
}

function Flavors() {
  const db = useDb();
  const [form, setForm] = useState({ name: "", costPrice: "", sellPrice: "", qty: "" });
  const [restock, setRestock] = useState({ flavorId: "", qty: "" });

  const add = (e) => {
    e.preventDefault();
    if (db.flavors.some((f) => f.name.toLowerCase() === form.name.trim().toLowerCase())) return;
    update((d) => d.flavors.push({
      id: uid("f"), name: form.name.trim(), costPrice: Number(form.costPrice), sellPrice: Number(form.sellPrice),
      warehouseQty: Number(form.qty || 0), createdAt: Date.now(),
    }));
    setForm({ name: "", costPrice: "", sellPrice: "", qty: "" });
  };
  const addStock = (e) => {
    e.preventDefault();
    const qty = Number(restock.qty);
    if (!restock.flavorId || qty < 1) return;
    update((d) => { d.flavors.find((f) => f.id === restock.flavorId).warehouseQty += qty; });
    setRestock({ flavorId: "", qty: "" });
  };
  const soldOf = (id) => db.sales.filter((s) => s.flavorId === id).reduce((a, s) => a + s.qty, 0);
  const outOf = (id) =>
    db.allocations.filter((a) => a.flavorId === id).reduce((a, x) => a + x.qty, 0) -
    soldOf(id) -
    db.spoilage.filter((s) => s.flavorId === id).reduce((a, s) => a + s.qty, 0);

  return (
    <>
      <div className="grid-2">
        <Card title="Add new flavor" icon={<Icon.cone size={17} />}>
          <form className="stack" onSubmit={add}>
            <Field label="Flavor name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <div className="row">
              <Field label="Cost price (₹)"><input type="number" min="0" step="0.5" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} required /></Field>
              <Field label="Selling price (₹)"><input type="number" min="0" step="0.5" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} required /></Field>
            </div>
            <Field label="Initial warehouse stock (units)"><input type="number" min="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
            <button className="primary" type="submit">Add flavor</button>
          </form>
        </Card>
        <Card title="Add warehouse stock">
          <form className="stack" onSubmit={addStock}>
            <Field label="Flavor">
              <select value={restock.flavorId} onChange={(e) => setRestock({ ...restock, flavorId: e.target.value })} required>
                <option value="">Select…</option>
                {db.flavors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
            <Field label="Units to add"><input type="number" min="1" value={restock.qty} onChange={(e) => setRestock({ ...restock, qty: e.target.value })} required /></Field>
            <button className="primary" type="submit" disabled={!db.flavors.length}>Add stock</button>
          </form>
        </Card>
      </div>
      <Card title="All flavors">
        <Table
          keyFn={(r) => r.id}
          columns={[
            { key: "name", label: "Flavor", render: (r) => <><i className="dot" style={{ background: flavorColor(db.flavors, r.id) }} />{r.name}</> },
            { key: "costPrice", label: "Cost", align: "num", render: (r) => money(r.costPrice) },
            { key: "sellPrice", label: "Sell", align: "num", render: (r) => money(r.sellPrice) },
            { key: "margin", label: "Margin", align: "num", render: (r) => money(r.sellPrice - r.costPrice) },
            { key: "warehouseQty", label: "In warehouse", align: "num" },
            { key: "out", label: "With vendors", align: "num", render: (r) => outOf(r.id) },
            { key: "sold", label: "Sold", align: "num", render: (r) => soldOf(r.id) },
          ]}
          rows={db.flavors}
          empty="No flavors yet - add one on the left."
        />
      </Card>
    </>
  );
}

function Assign() {
  const db = useDb();
  const [form, setForm] = useState({ vendorId: "", flavorId: "", qty: "" });
  const [err, setErr] = useState("");
  const flavor = db.flavors.find((f) => f.id === form.flavorId);
  const submit = (e) => {
    e.preventDefault();
    const qty = Number(form.qty);
    if (!flavor || !form.vendorId || qty < 1) return;
    if (qty > flavor.warehouseQty) return setErr(`Only ${flavor.warehouseQty} units of ${flavor.name} in the warehouse.`);
    update((d) => {
      d.flavors.find((f) => f.id === flavor.id).warehouseQty -= qty;
      d.allocations.push({ id: uid("a"), vendorId: form.vendorId, flavorId: flavor.id, qty, at: Date.now() });
    });
    setForm({ ...form, qty: "" });
    setErr("");
  };
  const history = [...db.allocations].sort((a, b) => b.at - a.at).slice(0, 20);
  const vname = (id) => db.users.find((u) => u.id === id)?.name ?? "–";
  return (
    <div className="grid-2">
      <Card title="Assign ice creams to a vendor" subtitle="Moves units from the warehouse into the vendor's box." icon={<Icon.box size={17} />}>
        <form className="stack" onSubmit={submit}>
          <Field label="Vendor">
            <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} required>
              <option value="">Select vendor…</option>
              {vendors(db).map((v) => <option key={v.id} value={v.id}>{v.name}{v.area ? ` (${v.area})` : ""}</option>)}
            </select>
          </Field>
          <Field label="Flavor">
            <select value={form.flavorId} onChange={(e) => setForm({ ...form, flavorId: e.target.value })} required>
              <option value="">Select flavor…</option>
              {db.flavors.map((f) => <option key={f.id} value={f.id}>{f.name} — {f.warehouseQty} in warehouse</option>)}
            </select>
          </Field>
          <Field label="Units">
            <input type="number" min="1" max={flavor?.warehouseQty ?? undefined} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} required />
          </Field>
          {err && <div className="error">{err}</div>}
          <button className="primary" type="submit" disabled={!vendors(db).length || !db.flavors.length}>Assign</button>
        </form>
      </Card>
      <Card title="Recent allocations">
        <Table
          keyFn={(r) => r.id}
          columns={[
            { key: "at", label: "Time", render: (r) => fmtTime(r.at) },
            { key: "vendor", label: "Vendor", render: (r) => vname(r.vendorId) },
            { key: "flavor", label: "Flavor", render: (r) => flavorName(db, r.flavorId) },
            { key: "qty", label: "Units", align: "num" },
          ]}
          rows={history}
          empty="Nothing assigned yet."
        />
      </Card>
    </div>
  );
}
