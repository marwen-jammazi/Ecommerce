// The dashboard endpoints are read tolerantly: field names are matched by meaning, not by one exact spelling.

export const unwrap = (res) => (res && res.data !== undefined ? res.data : res);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const firstNum = (o, keys) => {
  for (const k of keys) {
    const v = num(Number(o?.[k]));
    if (o?.[k] != null && v != null) return v;
  }
  return null;
};
const firstStr = (o, keys) => {
  for (const k of keys) if (typeof o?.[k] === 'string' && o[k]) return o[k];
  return null;
};

export const humanize = (k) => {
  if (/^aov$/i.test(k)) return 'Average order value';
  const s = String(k)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const MONEY = /revenue|aov|average ?order|sales|amount|refund|income|value/i;
const NOT_MONEY = /orders|count|customers|users|percent|rate|pct|change|growth|units|qty|quantity/i;
export const isMoneyKey = (k) => MONEY.test(k) && !NOT_MONEY.test(k);
const CHANGE = /change|growth|pct|percent|delta|vs/i;

// summary -> { kpis: [{key,label,value,money,change}], status: [{label,value}] }
export function normalizeSummary(res) {
  const d = unwrap(res);
  const kpis = [];
  const status = [];
  if (!d || typeof d !== 'object') return { kpis, status };

  const flat = {};
  for (const [k, v] of Object.entries(d)) {
    if (num(v) != null) {
      if (!CHANGE.test(k)) kpis.push({ key: k, label: humanize(k), value: v, money: isMoneyKey(k), change: null });
      flat[k] = v;
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const val = firstNum(v, ['value', 'total', 'amount', 'revenue', 'current']);
      if (val != null) {
        const ch = firstNum(v, ['change', 'changePct', 'changePercent', 'growth', 'pctChange', 'percentChange', 'delta']);
        kpis.push({ key: k, label: humanize(k), value: val, money: isMoneyKey(k), change: ch });
      } else if (/status/i.test(k)) {
        for (const [sk, sv] of Object.entries(v)) if (num(Number(sv)) != null) status.push({ label: sk, value: Number(sv) });
      }
    } else if (Array.isArray(v) && /status/i.test(k)) {
      for (const it of v) {
        const label = firstStr(it, ['status', 'orderStatus', 'label', 'name', '_id']);
        const value = firstNum(it, ['count', 'orders', 'total', 'value']);
        if (label && value != null) status.push({ label, value });
      }
    }
  }
  // attach "<name>Change" style numbers to their KPI
  for (const k of kpis) {
    if (k.change != null) continue;
    for (const [fk, fv] of Object.entries(flat)) {
      if (CHANGE.test(fk) && fk.toLowerCase().includes(k.key.toLowerCase().replace(/^total/, '')) && fk !== k.key) k.change = fv;
    }
  }
  kpis.sort((a, b) => rank(a.key) - rank(b.key));
  return { kpis, status };
}
const rank = (k) => {
  const s = k.toLowerCase();
  if (/^(total)?revenue$/.test(s)) return 0;
  if (/total.*orders|^orders$/.test(s)) return 1;
  if (/aov|average/.test(s)) return 2;
  if (/today/.test(s)) return 3;
  if (/week/.test(s)) return 4;
  if (/month/.test(s)) return 5;
  return 9;
};

const dateLabel = (v) => {
  if (v && typeof v === 'object') {
    const { year, month, day } = v;
    if (year) return [year, month && String(month).padStart(2, '0'), day && String(day).padStart(2, '0')].filter(Boolean).join('-');
  }
  return v == null ? '' : String(v);
};

export function normalizeSeries(res) {
  let d = unwrap(res);
  if (d && !Array.isArray(d)) d = d.series || d.points || d.items || d.revenue || [];
  if (!Array.isArray(d)) return [];
  return d
    .map((it) => ({
      label: dateLabel(it.date ?? it.period ?? it.label ?? it.day ?? it._id),
      revenue: firstNum(it, ['revenue', 'total', 'sales', 'amount', 'value']) ?? 0,
      orders: firstNum(it, ['orders', 'count', 'ordersCount', 'totalOrders']) ?? 0,
    }))
    .filter((p) => p.label);
}

const nameOf = (it) =>
  firstStr(it, ['name', 'title', 'productName', 'categoryName', 'category', 'label']) ||
  firstStr(it.product, ['name', 'title']) ||
  firstStr(it._id, ['name', 'title']) ||
  (typeof it._id === 'string' && !/^[0-9a-f]{24}$/i.test(it._id) ? it._id : null) ||
  'Unnamed';

export function normalizeRanked(res) {
  let d = unwrap(res);
  if (d && !Array.isArray(d)) d = d.items || d.products || d.categories || d.byUnits || d.byRevenue || [];
  if (!Array.isArray(d)) return [];
  return d.map((it) => ({
    name: nameOf(it),
    revenue: firstNum(it, ['revenue', 'total', 'sales', 'amount']),
    units: firstNum(it, ['unitsSold', 'units', 'quantity', 'sold', 'totalQuantity', 'qty']),
    orders: firstNum(it, ['orders', 'count']),
  }));
}

export function normalizeSplit(res) {
  const d = unwrap(res);
  const out = [];
  const add = (label, v) => {
    const value = typeof v === 'number' ? v : firstNum(v, ['revenue', 'total', 'amount', 'value', 'count']);
    if (label && value != null) out.push({ label: String(label).toUpperCase(), value });
  };
  if (Array.isArray(d)) for (const it of d) add(firstStr(it, ['method', 'paymentMethod', '_id', 'label', 'name']), it);
  else if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) if (!/total|from|to/i.test(k) || typeof v === 'object') add(k, v);
  return out.filter((s) => s.value > 0 || out.length <= 2);
}

export function normalizeInsights(res) {
  let d = unwrap(res);
  if (d && !Array.isArray(d)) d = d.insights || d.items || Object.values(d);
  if (!Array.isArray(d)) return [];
  return d
    .map((it) => (typeof it === 'string' ? it : firstStr(it, ['message', 'text', 'title', 'insight', 'description'])))
    .filter(Boolean)
    .slice(0, 6);
}