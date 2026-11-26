import { useMemo, useState } from 'react';
import { useDash } from '../../hooks/admin.js';
import { apiBlob } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { AreaChart, BarList, SegBar } from '../../components/admin/charts.jsx';
import { formatPrice } from '../../config.js';
import { normalizeInsights, normalizeRanked, normalizeSeries, normalizeSplit, normalizeSummary } from '../../lib/dash.js';

const RANGES = [
  { key: '7d', label: '7 days', days: 7, interval: 'day' },
  { key: '30d', label: '30 days', days: 30, interval: 'day' },
  { key: '90d', label: '90 days', days: 90, interval: 'week' },
  { key: '12m', label: '12 months', days: 365, interval: 'month' },
];
const iso = (d) => d.toISOString().slice(0, 10);

function Section({ title, q, children, wide }) {
  return (
    <section className={`glass panel dash-card ${wide ? 'wide' : ''}`}>
      <h2 className="label">{title}</h2>
      {q.isLoading ? (
        <div className="center">
          <span className="spinner" aria-label="Loading" />
        </div>
      ) : q.isError && !q.data ? (
        <p className="chart-empty">Could not load this section ({q.error?.message || 'error'}).</p>
      ) : (
        children
      )}
    </section>
  );
}

function Kpi({ k, hero }) {
  const text = k.money ? formatPrice(k.value) : Number.isInteger(k.value) ? String(k.value) : k.value.toFixed(2);
  const up = k.change != null && k.change >= 0;
  return (
    <div className={`kpi glass ${hero ? 'kpi-lead' : ''}`}>
      <span className="label">{k.label}</span>
      <strong>{text}</strong>
      {k.change != null && (
        <span className={`delta ${up ? 'up' : 'down'}`}>
          {up ? '\u25B2' : '\u25BC'} {Math.abs(k.change).toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const toast = useToast();
  const [rangeKey, setRangeKey] = useState('30d');
  const [exporting, setExporting] = useState(false);
  const range = RANGES.find((r) => r.key === rangeKey);

  const params = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - range.days * 86400000);
    return { from: iso(from), to: iso(to) };
  }, [range]);

  const summary = useDash('summary', params);
  const revenue = useDash('revenue', { ...params, interval: range.interval });
  const split = useDash('payment-split', params);
  const top = useDash('top-products', params);
  const cats = useDash('categories', params);
  const insights = useDash('insights', params);

  const { kpis, status } = useMemo(() => normalizeSummary(summary.data), [summary.data]);
  const series = useMemo(() => normalizeSeries(revenue.data), [revenue.data]);
  const parts = useMemo(() => normalizeSplit(split.data), [split.data]);
  const products = useMemo(
    () => normalizeRanked(top.data).map((p) => ({ name: p.name, value: p.revenue ?? p.units ?? 0, byUnits: p.revenue == null })),
    [top.data]
  );
  const categories = useMemo(() => normalizeRanked(cats.data).map((c) => ({ name: c.name, value: c.revenue ?? c.units ?? 0 })), [cats.data]);
  const tips = useMemo(() => normalizeInsights(insights.data), [insights.data]);

  const download = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await apiBlob(`/admin/dashboard/export?format=csv&from=${params.from}&to=${params.to}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `revenue-${params.from}-${params.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const { buildReport } = await import('../../lib/report.js');
      const doc = await buildReport({ range: range.label, from: params.from, to: params.to, kpis, series, parts, status, products, categories, tips });
      doc.save(`revenue-report-${params.from}-to-${params.to}.pdf`);
    } catch (e) {
      toast(`Could not build the PDF: ${e.message}`, 'error');
    } finally {
      setPdfBusy(false);
    }
  };
  const ready = !summary.isLoading && !revenue.isLoading;

  return (
    <>
      <div className="admin-head">
        <h1>Dashboard</h1>
        <div className="head-actions">
          <button className="btn slim" onClick={downloadPdf} disabled={pdfBusy || !ready}>
            {pdfBusy ? 'Building...' : 'Export PDF'}
          </button>
          <button className="btn slim" onClick={download} disabled={exporting}>
            {exporting ? 'Preparing...' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="chips range" role="group" aria-label="Period">
        {RANGES.map((r) => (
          <button key={r.key} className={`chip ${r.key === rangeKey ? 'active' : ''}`} aria-pressed={r.key === rangeKey} onClick={() => setRangeKey(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      {summary.isLoading && (
        <div className="center">
          <span className="spinner" aria-label="Loading" />
        </div>
      )}
      {summary.isError && !summary.data && <p className="error">Could not load the summary ({summary.error?.message}).</p>}
      {kpis.length > 0 && (
        <div className="kpis">
          {kpis.slice(0, 8).map((k, i) => (
            <Kpi key={k.key} k={k} hero={i === 0} />
          ))}
        </div>
      )}

      <div className="dash-grid">
        <Section title={`Revenue, per ${range.interval}`} q={revenue} wide>
          <AreaChart points={series} />
        </Section>

        <Section title="Cash on delivery vs online" q={split}>
          <SegBar parts={parts} money />
        </Section>

        {status.length > 0 && (
          <section className="glass panel dash-card">
            <h2 className="label">Orders by status</h2>
            <SegBar parts={status} />
          </section>
        )}

        <Section title="Top products" q={top}>
          <BarList items={products} money={!products.some((p) => p.byUnits)} empty="No sales yet." />
        </Section>

        <Section title="Revenue by category" q={cats}>
          <BarList items={categories} empty="No sales yet." />
        </Section>

        {tips.length > 0 && (
          <section className="glass panel dash-card wide">
            <h2 className="label">Insights</h2>
            <ul className="tips">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="fine">Revenue counts paid orders only. Cash on delivery is counted when the order is delivered.</p>
    </>
  );
}