import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../config.js';

// colours come from CSS variables so light/dark and the brand stay in one place (styles3.css)

const short = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)));
const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};
const tickLabel = (s) => {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
  if (!m) return s;
  const mon = new Date(+m[1], +m[2] - 1, 1).toLocaleString('en', { month: 'short' });
  return m[3] ? `${mon} ${+m[3]}` : `${mon} ${m[1].slice(2)}`;
};

// area + line with crosshair and tooltip
function useNarrow() {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const on = () => setN(window.innerWidth < 640);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return n;
}

export function AreaChart({ points }) {
  const narrow = useNarrow();
  const height = narrow ? 230 : 260;
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = narrow ? 340 : 720; // narrower drawing area on phones so the text stays readable
  const pad = { l: 40, r: 14, t: 14, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  if (!points.length) return <p className="chart-empty">No revenue in this period yet.</p>;

  const max = niceMax(Math.max(...points.map((p) => p.revenue)));
  const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(1)},${pad.t + ih} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const step = Math.ceil(points.length / (narrow ? 4 : 6));

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, points.length === 1 ? 0 : i)));
  };
  const hp = hover != null ? points[hover] : null;

  return (
    <div className="chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Revenue over time" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchMove={(e) => onMove(e.touches[0])}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="axis">
              {short(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % step === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="axis">
              {tickLabel(p.label)}
            </text>
          ) : null
        )}
        <path d={area} className="area" />
        <path d={line} className="line" />
        {points.length === 1 && <circle cx={x(0)} cy={y(points[0].revenue)} r="5" className="dot" />}
        {hp && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="cross" />
            <circle cx={x(hover)} cy={y(hp.revenue)} r="5" className="dot" />
          </g>
        )}
      </svg>
      {hp && (
        <div className="tip glass" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <span className="label">{tickLabel(hp.label)}</span>
          <strong>{formatPrice(hp.revenue)}</strong>
          {hp.orders > 0 && <span>{hp.orders} orders</span>}
        </div>
      )}
    </div>
  );
}

// ranked horizontal bars, one hue
export function BarList({ items, money = true, empty = 'Nothing to show yet.' }) {
  if (!items.length) return <p className="chart-empty">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="bars">
      {items.map((it) => (
        <li key={it.name} title={`${it.name}: ${money ? formatPrice(it.value) : it.value}`}>
          <span className="n">{it.name}</span>
          <span className="track">
            <i style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} />
          </span>
          <span className="v">{money ? formatPrice(it.value) : it.value}</span>
        </li>
      ))}
    </ul>
  );
}

// one whole split in a few parts: tall segmented bar with a legend (never colour alone)
const SEG = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
export function SegBar({ parts, money = false }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <p className="chart-empty">Nothing to show yet.</p>;
  return (
    <div>
      <div className="seg" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {parts.map((p, i) => (
          <i key={p.label} style={{ flexGrow: p.value, background: SEG[i % SEG.length] }} title={`${p.label}: ${money ? formatPrice(p.value) : p.value}`} />
        ))}
      </div>
      <ul className="legend">
        {parts.map((p, i) => (
          <li key={p.label}>
            <i style={{ background: SEG[i % SEG.length] }} />
            <span>{p.label}</span>
            <strong>{money ? formatPrice(p.value) : p.value}</strong>
            <small>{Math.round((p.value / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}