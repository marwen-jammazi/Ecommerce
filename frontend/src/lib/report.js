// Builds the dashboard PDF in the browser (jsPDF is loaded only when the button is used).
import { formatPrice, STORE_NAME } from '../config.js';

const INK = [22, 22, 27];
const GREY = [79, 82, 102];
const LIGHT = [238, 240, 246];
const LINE = [208, 212, 224];
const BAR = [58, 61, 82];
const SEG = [[37, 125, 224], [244, 114, 48], [0, 184, 148], [242, 166, 0], [238, 127, 172], [106, 76, 226]];

const M = 14; // page margin, mm
const W = 210;
const CW = W - M * 2; // content width

// the built-in PDF fonts only cover Latin-1, so anything else is replaced instead of printing as garbage
const clean = (s) => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};
const short = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)));
const dayLabel = (s) => {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s);
  if (!m) return clean(s);
  const mon = new Date(+m[1], +m[2] - 1, 1).toLocaleString('en', { month: 'short' });
  return m[3] ? `${mon} ${+m[3]}` : `${mon} ${m[1].slice(2)}`;
};

export async function buildReport({ range, from, to, kpis, series, parts, status, products, categories, tips }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;

  const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const need = (h) => {
    if (y + h > 282) {
      doc.addPage();
      y = M;
    }
  };
  const label = (text, x, yy, opt) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    color(GREY);
    doc.text(clean(text).toUpperCase(), x, yy, { charSpace: 0.35, ...opt });
  };
  const section = (title, body = 12) => {
    need(8 + body); // keep a heading together with its first rows
    y += 4;
    label(title, M, y);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, y + 2, W - M, y + 2);
    y += 8;
  };

  // ---- header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  color(GREY);
  doc.text(clean(STORE_NAME).toUpperCase(), M, y + 3, { charSpace: 1.6 });
  y += 11;
  doc.setFontSize(24);
  color(INK);
  doc.text('Revenue report', M, y);
  y += 7;
  doc.setFontSize(10);
  color(GREY);
  doc.text(`${range} (${from} to ${to}), generated ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`, M, y);
  y += 4;

  // ---- KPI cards, three per row
  if (kpis.length) {
    section('Key figures');
    const cols = 3;
    const gap = 4;
    const cw = (CW - gap * (cols - 1)) / cols;
    const list = kpis.slice(0, 9);
    list.forEach((k, i) => {
      const col = i % cols;
      if (col === 0 && i > 0) y += 21;
      if (col === 0) need(21);
      const x = M + col * (cw + gap);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(x, y, cw, 18, 3, 3, 'F');
      label(k.label, x + 4, y + 6);
      doc.setFontSize(14);
      color(INK);
      doc.text(clean(k.money ? formatPrice(k.value) : Number.isInteger(k.value) ? String(k.value) : k.value.toFixed(2)), x + 4, y + 13.5);
      if (k.change != null) {
        doc.setFontSize(7.5);
        color(k.change >= 0 ? [47, 107, 74] : [176, 66, 86]);
        doc.text(`${k.change >= 0 ? '+' : '-'}${Math.abs(k.change).toFixed(1)}%`, x + cw - 4, y + 13.5, { align: 'right' });
      }
    });
    y += 21;
  }

  // ---- revenue line chart
  section('Revenue over time', 66);
  if (!series.length) {
    doc.setFontSize(9);
    color(GREY);
    doc.text('No revenue in this period.', M, y + 2);
    y += 8;
  } else {
    const ch = 58;
    need(ch + 12);
    const left = M + 11;
    const right = W - M - 2;
    const top = y + 2;
    const bottom = y + ch - 6;
    const max = niceMax(Math.max(...series.map((p) => p.revenue)));
    const px = (i) => left + (series.length === 1 ? (right - left) / 2 : (i / (series.length - 1)) * (right - left));
    const py = (v) => bottom - (v / max) * (bottom - top);

    doc.setLineWidth(0.15);
    doc.setFontSize(6.5);
    for (let t = 0; t <= 4; t++) {
      const v = (max / 4) * t;
      doc.setDrawColor(...LINE);
      doc.line(left, py(v), right, py(v));
      color(GREY);
      doc.text(short(v), left - 2, py(v) + 1.2, { align: 'right' });
    }
    // light area under the line
    if (series.length > 1) {
      doc.setFillColor(228, 231, 240);
      const segs = [];
      for (let i = 1; i < series.length; i++) segs.push([px(i) - px(i - 1), py(series[i].revenue) - py(series[i - 1].revenue)]);
      segs.push([0, bottom - py(series.at(-1).revenue)]);
      segs.push([px(0) - px(series.length - 1), 0]);
      doc.lines(segs, px(0), py(series[0].revenue), [1, 1], 'F', true);
    }
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.5);
    for (let i = 1; i < series.length; i++) doc.line(px(i - 1), py(series[i - 1].revenue), px(i), py(series[i].revenue));
    if (series.length <= 31) {
      doc.setFillColor(...INK);
      series.forEach((p, i) => doc.circle(px(i), py(p.revenue), 0.6, 'F'));
    }
    const step = Math.ceil(series.length / 7);
    doc.setFontSize(6.5);
    color(GREY);
    series.forEach((p, i) => {
      if (i % step === 0) doc.text(dayLabel(p.label), px(i), bottom + 4.5, { align: 'center' });
    });
    y += ch + 2;

    const total = series.reduce((s, p) => s + p.revenue, 0);
    const best = series.reduce((a, b) => (b.revenue > a.revenue ? b : a));
    doc.setFontSize(8.5);
    color(GREY);
    doc.text(clean(`In this chart: ${formatPrice(total)} in total, best period ${dayLabel(best.label)} (${formatPrice(best.revenue)}).`), M, y + 2);
    y += 6;
  }

  // ---- stacked bar + legend
  const stacked = (title, items, money) => {
    const total = items.reduce((s, p) => s + p.value, 0);
    if (!total) return;
    section(title, 14 + items.length * 6);
    let x = M;
    items.forEach((p, i) => {
      const w = (p.value / total) * CW;
      doc.setFillColor(...SEG[i % SEG.length]);
      doc.rect(x, y, Math.max(w - 0.4, 0.6), 8, 'F');
      x += w;
    });
    y += 14;
    items.forEach((p, i) => {
      need(6);
      doc.setFillColor(...SEG[i % SEG.length]);
      doc.rect(M, y - 2.6, 3, 3, 'F');
      doc.setFontSize(9);
      color(INK);
      doc.text(clean(p.label), M + 6, y);
      doc.text(clean(money ? formatPrice(p.value) : String(p.value)), M + CW - 14, y, { align: 'right' });
      color(GREY);
      doc.text(`${Math.round((p.value / total) * 100)}%`, M + CW, y, { align: 'right' });
      y += 6;
    });
  };
  stacked('Cash on delivery vs online', parts, true);
  stacked('Orders by status', status, false);

  // ---- ranked bars
  const ranked = (title, items, money) => {
    if (!items.length) return;
    section(title, Math.min(items.length, 3) * 7);
    const max = Math.max(...items.map((i) => i.value), 1);
    items.slice(0, 10).forEach((it) => {
      need(8);
      doc.setFontSize(9);
      color(INK);
      doc.text(doc.splitTextToSize(clean(it.name), 62)[0], M, y);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(M + 66, y - 3, 70, 3.4, 1.7, 1.7, 'F');
      doc.setFillColor(...BAR);
      doc.roundedRect(M + 66, y - 3, Math.max(3.4, (it.value / max) * 70), 3.4, 1.7, 1.7, 'F');
      color(GREY);
      doc.text(clean(money ? formatPrice(it.value) : String(it.value)), M + CW, y, { align: 'right' });
      y += 7;
    });
  };
  ranked('Top products', products, !products.some((p) => p.byUnits));
  ranked('Revenue by category', categories, true);

  if (tips.length) {
    section('Insights');
    doc.setFontSize(9);
    color(INK);
    tips.forEach((t) => {
      const lines = doc.splitTextToSize(clean(t), CW - 5);
      need(lines.length * 5 + 2);
      doc.circle(M + 1, y - 1, 0.6, 'F');
      doc.text(lines, M + 5, y);
      y += lines.length * 5 + 1;
    });
  }

  need(10);
  y += 4;
  doc.setFontSize(7.5);
  color(GREY);
  doc.text('Revenue counts paid orders only. Cash on delivery is counted when the order is delivered.', M, y);

  // ---- footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    color(GREY);
    doc.text(`${clean(STORE_NAME)} - Revenue report`, M, 291);
    doc.text(`Page ${i} of ${pages}`, W - M, 291, { align: 'right' });
  }
  return doc;
}