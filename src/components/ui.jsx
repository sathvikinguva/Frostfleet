import { STATUS } from "./charts";
import { Icon } from "./icons";

export function Card({ title, subtitle, children, actions, icon, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div className="card-title">
            {icon && <span className="card-icon">{icon}</span>}
            <div>
              {title && <h3>{title}</h3>}
              {subtitle && <p className="muted small">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone, icon, accent = "blue" }) {
  return (
    <div className={`stat ${tone ? "stat-" + tone : ""}`}>
      {icon && <span className={`stat-icon accent-${accent}`}>{icon}</span>}
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <em className="field-hint">{hint}</em>}
    </label>
  );
}

export function Table({ columns, rows, empty = "Nothing here yet", keyFn }) {
  if (!rows.length) return <div className="viz-empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.align || ""}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={keyFn ? keyFn(r) : i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align || ""}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_META = {
  good: { icon: Icon.check, label: "Safe" },
  warning: { icon: Icon.alert, label: "Drifting" },
  critical: { icon: Icon.alert, label: "Out of range" },
  none: { icon: Icon.clock, label: "No reading" },
};

export function TempBadge({ status, text }) {
  const m = STATUS_META[status] || STATUS_META.none;
  const color = STATUS[status] || "#898781";
  const Glyph = m.icon;
  return (
    <span className={`badge badge-${status}`} style={{ "--badge": color }}>
      <Glyph size={13} /> {text ?? m.label}
    </span>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs-wrap">
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t} className={t === value ? "active" : ""} onClick={() => onChange(t)}>{t}</button>
        ))}
      </nav>
    </div>
  );
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
