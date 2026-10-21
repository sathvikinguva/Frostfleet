// Small SVG chart set: BarChart (stacked or grouped), LineChart. Hover
// tooltips on every mark, legend when >= 2 series, no dual axes.
import { useState } from "react";

// Validated categorical palette, fixed order (light surface).
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const OTHER_COLOR = "#898781";
export const SEQUENTIAL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#2a78d6", "#1c5cab", "#0d366b"];
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };
// Chart surface - marks ring against this so overlaps stay readable.
export const SURFACE = "#ffffff";

// Flavors get a stable color by their creation index, never by rank.
export function flavorColor(flavors, flavorId) {
  if (flavorId === "other") return OTHER_COLOR;
  const i = flavors.findIndex((f) => f.id === flavorId);
  return i < 0 ? OTHER_COLOR : SERIES[i % SERIES.length];
}

const M = { top: 14, right: 14, bottom: 28, left: 46 };

// Round up to a readable axis maximum. The ladder is deliberately fine so a
// max of 29 lands on 30 rather than overshooting to 50.
const LADDER = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (LADDER.find((s) => n <= s + 1e-9) ?? 10) * p;
}

function Tooltip({ x, y, children }) {
  return <div className="viz-tip" style={{ left: x, top: y }}>{children}</div>;
}

function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <div className="viz-legend">
      {series.map((s) => (
        <span key={s.name} className="viz-legend-item">
          <i style={{ background: s.color }} /> {s.name}
        </span>
      ))}
    </div>
  );
}

export function Empty({ children = "No data yet" }) {
  return <div className="viz-empty">{children}</div>;
}

/**
 * BarChart
 *  categories: string[]
 *  series: [{ name, color, values:number[] }]
 *  grouped: side-by-side bars. Use when the series are alternatives to compare
 *           (revenue vs cost); leave false only when they are parts of a whole.
 */
export function BarChart({ categories, series, height = 230, format = (v) => v, width = 640, grouped = false }) {
  const [hover, setHover] = useState(null);
  const all = series.flatMap((s) => s.values);
  if (!categories.length || !all.some((v) => v)) return <Empty />;

  const W = width, H = height;
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const stackTotals = categories.map((_, i) => series.reduce((a, s) => a + s.values[i], 0));
  const max = niceMax(grouped ? Math.max(...all) : Math.max(...stackTotals));
  const bandW = iw / categories.length;
  const y = (v) => M.top + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(categories.length / Math.max(1, Math.floor(iw / 52)));

  const n = series.length;
  const groupW = Math.min(36 * n, bandW * 0.72);
  const slot = groupW / n;
  const barW = grouped ? Math.max(4, slot - 3) : Math.min(30, bandW * 0.55);

  return (
    <div className="viz-root" style={{ position: "relative" }}>
      <Legend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#e8eaef" />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="viz-tick">{format(t)}</text>
          </g>
        ))}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#d7dae1" />

        {categories.map((c, i) => {
          const cx = M.left + bandW * i + bandW / 2;
          let acc = 0;
          return (
            <g key={c}>
              {series.map((s, si) => {
                const v = s.values[i];
                if (!v) return null;
                if (grouped) {
                  return (
                    <rect
                      key={s.name}
                      x={cx - groupW / 2 + si * slot + (slot - barW) / 2}
                      y={y(v)} width={barW} height={Math.max(0, y(0) - y(v))}
                      fill={s.color} rx={4}
                      opacity={hover && hover.i !== i ? 0.45 : 1}
                    />
                  );
                }
                const y0 = y(acc + v), y1 = y(acc);
                acc += v;
                const isTop = acc === stackTotals[i];
                return (
                  <rect
                    key={s.name}
                    x={cx - barW / 2} y={y0} width={barW}
                    height={Math.max(0, y1 - y0 - (si ? 2 : 0))}
                    fill={s.color} rx={isTop ? 4 : 0}
                    opacity={hover && hover.i !== i ? 0.45 : 1}
                  />
                );
              })}
              <rect
                x={M.left + bandW * i} y={M.top} width={bandW} height={ih} fill="transparent"
                onMouseEnter={() => setHover({ i, x: cx, y: y(grouped ? Math.max(...series.map((s) => s.values[i])) : stackTotals[i]) })}
                onMouseLeave={() => setHover(null)}
              />
              {i % labelEvery === 0 && <text x={cx} y={H - 8} textAnchor="middle" className="viz-tick">{c}</text>}
            </g>
          );
        })}
      </svg>
      {hover && (
        <Tooltip x={`${(hover.x / W) * 100}%`} y={`${(hover.y / H) * 100}%`}>
          <strong>{categories[hover.i]}</strong>
          {series.map((s) =>
            s.values[hover.i] ? (
              <div key={s.name}><i style={{ background: s.color }} />{s.name}: {format(s.values[hover.i])}</div>
            ) : null
          )}
          {!grouped && series.length > 1 && <div className="viz-tip-total">Total: {format(stackTotals[hover.i])}</div>}
        </Tooltip>
      )}
    </div>
  );
}

/** Convenience wrapper for a single series {label,value}[] */
export function SimpleBars({ data, color = SERIES[0], name = "Units", ...rest }) {
  return (
    <BarChart
      categories={data.map((d) => d.label)}
      series={[{ name, color, values: data.map((d) => d.value) }]}
      {...rest}
    />
  );
}

/**
 * LineChart
 *  band: optional { min, max, label } shaded reference range
 *  zeroBased: keep 0 in the domain. Turn off for measures that never approach
 *             zero (temperature) so the plot doesn't collapse into a corner.
 */
export function LineChart({
  categories, series, height = 230, format = (v) => v, width = 640, band = null, zeroBased = true,
}) {
  const [hover, setHover] = useState(null);
  const vals = series.flatMap((s) => s.values);
  if (!categories.length || !vals.some((v) => v)) return <Empty />;

  const W = width, H = height;
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;

  const bandVals = band ? [band.min, band.max] : [];
  let lo, hi;
  if (zeroBased) {
    lo = Math.min(0, ...bandVals, ...vals) < 0 ? -niceMax(-Math.min(0, ...bandVals, ...vals)) : 0;
    hi = niceMax(Math.max(0, ...bandVals, ...vals));
  } else {
    const rawLo = Math.min(...bandVals, ...vals);
    const rawHi = Math.max(...bandVals, ...vals);
    const pad = Math.max(1, (rawHi - rawLo) * 0.12);
    lo = Math.floor(rawLo - pad);
    // Keep the span divisible by 4 so the quarter ticks land on whole numbers.
    hi = lo + Math.ceil((Math.ceil(rawHi + pad) - lo) / 4) * 4;
  }

  const x = (i) => M.left + (categories.length === 1 ? iw / 2 : (i / (categories.length - 1)) * iw);
  const y = (v) => M.top + ih - ((v - lo) / (hi - lo)) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + t * (hi - lo));
  const labelEvery = Math.ceil(categories.length / Math.max(1, Math.floor(iw / 52)));

  return (
    <div className="viz-root" style={{ position: "relative" }}>
      <Legend series={series} />
      <svg
        viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - M.left) / iw) * (categories.length - 1));
          setHover(Math.max(0, Math.min(categories.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#e8eaef" />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="viz-tick">{format(t)}</text>
          </g>
        ))}
        {lo < 0 && hi > 0 && <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#d7dae1" />}

        {band && (
          <g>
            <rect
              x={M.left} y={y(band.max)} width={iw} height={Math.max(0, y(band.min) - y(band.max))}
              fill={STATUS.good} opacity={0.1}
            />
            <line x1={M.left} x2={W - M.right} y1={y(band.max)} y2={y(band.max)} stroke={STATUS.good} strokeDasharray="4 3" opacity={0.7} />
            <line x1={M.left} x2={W - M.right} y1={y(band.min)} y2={y(band.min)} stroke={STATUS.good} strokeDasharray="4 3" opacity={0.7} />
            <text x={W - M.right} y={y(band.max) - 5} textAnchor="end" className="viz-tick">{band.label}</text>
          </g>
        )}

        {categories.map((c, i) =>
          i % labelEvery === 0 ? (
            <text key={c + i} x={x(i)} y={H - 8} textAnchor="middle" className="viz-tick">{c}</text>
          ) : null
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="#c3c2b7" strokeDasharray="3 3" />}

        {series.map((s) => (
          <g key={s.name}>
            <path
              d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")}
              fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            />
            {/* Markers so sparse series (a single reading) are still visible. */}
            {categories.length <= 40 &&
              s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
              ))}
            {hover != null && categories.length > 40 && (
              <circle cx={x(hover)} cy={y(s.values[hover])} r={5} fill={s.color} stroke={SURFACE} strokeWidth={2} />
            )}
          </g>
        ))}
      </svg>
      {hover != null && (
        <Tooltip x={`${(x(hover) / W) * 100}%`} y={`${(M.top / H) * 100}%`}>
          <strong>{categories[hover]}</strong>
          {series.map((s) => (
            <div key={s.name}><i style={{ background: s.color }} />{s.name}: {format(s.values[hover])}</div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}
