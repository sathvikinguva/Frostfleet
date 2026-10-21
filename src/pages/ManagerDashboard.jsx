import { useState } from "react";
import { useDb, money } from "../store";
import { profitLoss, vendorPerformance } from "../analytics";
import { Card, Stat, Table, Tabs, TempBadge } from "../components/ui";
import { Icon } from "../components/icons";
import { BarChart, SERIES } from "../components/charts";
import { LocationDemand, TimeDemand, SalesTracking, FridgeTracking } from "../components/Reports";

const TABS = ["Profit / loss", "Sales tracking", "Area demand", "Season demand", "Vendor performance", "Refrigerators"];

export default function ManagerDashboard() {
  const [tab, setTab] = useState(TABS[0]);
  const db = useDb();
  const pl = profitLoss(db);
  const tone = pl.netProfit > 0 ? "good" : pl.netProfit < 0 ? "critical" : undefined;

  return (
    <>
      <div className="stats">
        <Stat label="Revenue" value={money(pl.revenue)} sub={`${pl.units} units sold`} icon={<Icon.wallet size={19} />} accent="blue" />
        <Stat label="Cost of goods" value={money(pl.cogs)} icon={<Icon.box size={19} />} accent="grey" />
        <Stat
          label="Spoilage loss" value={money(pl.spoilLoss)} sub={`${pl.spoiledUnits} units`}
          icon={<Icon.alert size={19} />} accent={pl.spoilLoss ? "red" : "grey"}
          tone={pl.spoilLoss ? "warning" : undefined}
        />
        <Stat label="Net profit" value={money(pl.netProfit)} icon={<Icon.trending size={19} />} accent="green" tone={tone} />
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "Profit / loss" && <ProfitLoss pl={pl} />}
      {tab === "Sales tracking" && <SalesTracking />}
      {tab === "Area demand" && <LocationDemand />}
      {tab === "Season demand" && <TimeDemand />}
      {tab === "Vendor performance" && <VendorPerformance />}
      {tab === "Refrigerators" && <FridgeTracking />}
    </>
  );
}

function ProfitLoss({ pl }) {
  const db = useDb();
  const byFlavor = db.flavors
    .map((f) => {
      const sales = db.sales.filter((s) => s.flavorId === f.id);
      const spoil = db.spoilage.filter((s) => s.flavorId === f.id);
      const revenue = sales.reduce((a, s) => a + s.qty * s.unitPrice, 0);
      const cogs = sales.reduce((a, s) => a + s.qty * s.unitCost, 0);
      const loss = spoil.reduce((a, s) => a + s.qty * s.unitCost, 0);
      return { f, revenue, cogs, loss, profit: revenue - cogs - loss };
    })
    .filter((r) => r.revenue || r.loss)
    .sort((a, b) => b.profit - a.profit);
  const margin = pl.revenue ? Math.round((pl.netProfit / pl.revenue) * 100) : 0;

  return (
    <>
      <Card title="Profit & loss summary" icon={<Icon.trending size={17} />}>
        <Table
          keyFn={(r) => r.k}
          columns={[
            { key: "k", label: "" },
            { key: "v", label: "Amount", align: "num" },
          ]}
          rows={[
            { k: "Revenue", v: money(pl.revenue) },
            { k: "− Cost of goods sold", v: money(pl.cogs) },
            { k: "= Gross profit", v: money(pl.grossProfit) },
            { k: "− Spoilage / wastage", v: money(pl.spoilLoss) },
            { k: "= Net profit", v: <b>{money(pl.netProfit)}</b> },
            { k: "Net margin", v: `${margin}%` },
          ]}
        />
      </Card>
      <Card title="Revenue vs cost by flavor" icon={<Icon.chart size={17} />}>
        {/* Grouped, not stacked: revenue and cost are alternatives to compare,
            not parts that sum to a meaningful total. */}
        <BarChart
          grouped
          categories={byFlavor.map((r) => r.f.name)}
          series={[
            { name: "Revenue", color: SERIES[0], values: byFlavor.map((r) => r.revenue) },
            { name: "Cost of goods", color: SERIES[1], values: byFlavor.map((r) => r.cogs) },
            { name: "Spoilage loss", color: SERIES[7], values: byFlavor.map((r) => r.loss) },
          ]}
          format={money}
        />
      </Card>
      <Card title="Profit by flavor">
        <Table
          keyFn={(r) => r.f.id}
          columns={[
            { key: "name", label: "Flavor", render: (r) => r.f.name },
            { key: "revenue", label: "Revenue", align: "num", render: (r) => money(r.revenue) },
            { key: "cogs", label: "COGS", align: "num", render: (r) => money(r.cogs) },
            { key: "loss", label: "Spoilage", align: "num", render: (r) => money(r.loss) },
            { key: "profit", label: "Profit", align: "num", render: (r) => <b className={r.profit < 0 ? "text-critical" : ""}>{money(r.profit)}</b> },
          ]}
          rows={byFlavor}
          empty="No sales yet - profit appears once vendors start selling."
        />
      </Card>
    </>
  );
}

function VendorPerformance() {
  const db = useDb();
  const perf = vendorPerformance(db);
  return (
    <>
      <Card title="Revenue by vendor">
        <BarChart
          categories={perf.map((p) => p.vendor.name)}
          series={[{ name: "Revenue", color: SERIES[0], values: perf.map((p) => p.revenue) }]}
          format={money}
        />
      </Card>
      <Card title="Vendor scorecard" icon={<Icon.users size={17} />}>
        <Table
          keyFn={(r) => r.vendor.id}
          columns={[
            { key: "name", label: "Vendor", render: (r) => <>{r.vendor.name}<div className="muted small">{r.vendor.area || r.vendor.email}</div></> },
            { key: "units", label: "Units sold", align: "num" },
            { key: "allotted", label: "Allotted", align: "num" },
            { key: "st", label: "Sell-through", align: "num", render: (r) => `${Math.round(r.sellThrough * 100)}%` },
            { key: "revenue", label: "Revenue", align: "num", render: (r) => money(r.revenue) },
            { key: "profit", label: "Profit", align: "num", render: (r) => money(r.profit) },
            { key: "spoiled", label: "Spoiled", align: "num", render: (r) => `${r.spoiledUnits} (${money(r.spoilLoss)})` },
            { key: "fridge", label: "Fridge", render: (r) => <TempBadge status={r.fridge.status} text={r.fridge.last ? `${r.fridge.last.temp} °C` : undefined} /> },
            { key: "comp", label: "Temp compliance", align: "num", render: (r) => (r.fridge.compliance == null ? "–" : `${Math.round(r.fridge.compliance * 100)}%`) },
          ]}
          rows={perf}
          empty="No vendors yet."
        />
      </Card>
    </>
  );
}
