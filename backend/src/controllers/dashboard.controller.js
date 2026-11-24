import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { round2 } from '../utils/money.js';
import { parseRange, startOfToday, startOfWeek, startOfMonth, tzOffset } from '../utils/dateRange.js';

// what counts as revenue
const PAID = { paymentStatus: 'Paid', orderStatus: { $ne: 'Cancelled' } };

async function revenueBetween(from, to) {
  const [r] = await Order.aggregate([
    { $match: { ...PAID, paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, revenue: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
  ]);
  return { revenue: round2(r?.revenue || 0), orders: r?.orders || 0 };
}

// % change vs previous period (null when there is nothing to compare to)
const pct = (cur, prev) => (prev === 0 ? (cur === 0 ? 0 : null) : round2(((cur - prev) / prev) * 100));

export const summary = asyncHandler(async (req, res) => {
  const { from, to, prevFrom, prevTo } = parseRange(req.query);
  const soon = new Date(Date.now() + 60000);

  const [cur, prev, today, week, month, byStatus, prevOrders, customers, prevCustomers, pendingCod, refunds] =
    await Promise.all([
      revenueBetween(from, to),
      revenueBetween(prevFrom, prevTo),
      revenueBetween(startOfToday(), soon),
      revenueBetween(startOfWeek(), soon),
      revenueBetween(startOfMonth(), soon),
      Order.aggregate([
        { $match: { createdAt: { $gte: from, $lt: to } } },
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ createdAt: { $gte: prevFrom, $lt: prevTo } }),
      User.countDocuments({ role: 'user', createdAt: { $gte: from, $lt: to } }),
      User.countDocuments({ role: 'user', createdAt: { $gte: prevFrom, $lt: prevTo } }),
      // cash still to be collected on live COD orders (not limited to the range)
      Order.aggregate([
        { $match: { paymentMethod: 'COD', paymentStatus: 'Pending', orderStatus: { $ne: 'Cancelled' } } },
        { $group: { _id: null, amount: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: 'Refunded', createdAt: { $gte: from, $lt: to } } },
        { $group: { _id: null, amount: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
      ]),
    ]);

  const ordersByStatus = Object.fromEntries(
    ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map((s) => [s, 0])
  );
  for (const s of byStatus) ordersByStatus[s._id] = s.count;
  const totalOrders = Object.values(ordersByStatus).reduce((a, b) => a + b, 0);

  const aov = cur.orders ? round2(cur.revenue / cur.orders) : 0;
  const prevAov = prev.orders ? round2(prev.revenue / prev.orders) : 0;

  res.json({
    success: true,
    range: { from, to },
    data: {
      revenue: { value: cur.revenue, previous: prev.revenue, changePct: pct(cur.revenue, prev.revenue) },
      paidOrders: cur.orders,
      totalOrders: { value: totalOrders, previous: prevOrders, changePct: pct(totalOrders, prevOrders) },
      averageOrderValue: { value: aov, previous: prevAov, changePct: pct(aov, prevAov) },
      newCustomers: { value: customers, previous: prevCustomers, changePct: pct(customers, prevCustomers) },
      revenueToday: today.revenue,
      revenueThisWeek: week.revenue,
      revenueThisMonth: month.revenue,
      ordersByStatus,
      pendingCodCash: { amount: round2(pendingCod[0]?.amount || 0), orders: pendingCod[0]?.orders || 0 },
      refunds: { amount: round2(refunds[0]?.amount || 0), orders: refunds[0]?.orders || 0 },
    },
  });
});

export const revenueSeries = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const interval = ['day', 'week', 'month'].includes(req.query.interval) ? req.query.interval : 'day';
  const timezone = tzOffset();

  const bucket = (field) => ({ $dateTrunc: { date: field, unit: interval, timezone, startOfWeek: 'monday' } });
  const label = {
    $dateToString: { format: interval === 'month' ? '%Y-%m' : '%Y-%m-%d', date: '$_id', timezone },
  };

  const [rev, ord] = await Promise.all([
    Order.aggregate([
      { $match: { ...PAID, paidAt: { $gte: from, $lt: to } } },
      { $group: { _id: bucket('$paidAt'), revenue: { $sum: '$totalPrice' } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: label, revenue: 1 } },
    ]),
    Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' }, createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: bucket('$createdAt'), orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: label, orders: 1 } },
    ]),
  ]);

  const map = new Map();
  for (const r of rev) map.set(r.date, { date: r.date, revenue: round2(r.revenue), orders: 0 });
  for (const o of ord) {
    const e = map.get(o.date) || { date: o.date, revenue: 0, orders: 0 };
    e.orders = o.orders;
    map.set(o.date, e);
  }
  const data = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));

  res.json({ success: true, interval, data });
});

export const paymentSplit = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const rows = await Order.aggregate([
    { $match: { ...PAID, paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: '$paymentMethod', revenue: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
    { $project: { _id: 0, method: '$_id', revenue: 1, orders: 1 } },
  ]);
  const data = ['COD', 'ONLINE'].map((m) => {
    const r = rows.find((x) => x.method === m);
    return { method: m, revenue: round2(r?.revenue || 0), orders: r?.orders || 0 };
  });
  res.json({ success: true, data });
});

export const topProducts = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const by = req.query.by === 'revenue' ? 'revenue' : 'units';
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

  const rows = await Order.aggregate([
    { $match: { ...PAID, paidAt: { $gte: from, $lt: to } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        image: { $first: '$items.image' },
        units: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { [by]: -1 } },
    { $limit: limit },
    { $project: { _id: 0, productId: '$_id', name: 1, image: 1, units: 1, revenue: 1 } },
  ]);
  res.json({ success: true, by, data: rows.map((r) => ({ ...r, revenue: round2(r.revenue) })) });
});

export const revenueByCategory = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const rows = await Order.aggregate([
    { $match: { ...PAID, paidAt: { $gte: from, $lt: to } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        units: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'p' } },
    { $unwind: '$p' },
    { $group: { _id: '$p.category', units: { $sum: '$units' }, revenue: { $sum: '$revenue' } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
    { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
    {
      $project: { _id: 0, categoryId: '$_id', name: { $ifNull: ['$c.name', 'Unknown'] }, units: 1, revenue: 1 },
    },
    { $sort: { revenue: -1 } },
  ]);
  res.json({ success: true, data: rows.map((r) => ({ ...r, revenue: round2(r.revenue) })) });
});

export const insights = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const threshold = Math.max(parseInt(req.query.lowStock) || 5, 0);
  const timezone = tzOffset();

  const [lowStock, recentOrders, topCustomers, mostLiked, bestRated, customerGrowth] = await Promise.all([
    Product.find({ isActive: true, stock: { $lte: threshold } })
      .select('name slug stock images')
      .sort('stock')
      .limit(20)
      .lean(),
    Order.find()
      .sort('-createdAt')
      .limit(10)
      .select('user totalPrice paymentMethod paymentStatus orderStatus createdAt')
      .populate('user', 'name email')
      .lean(),
    Order.aggregate([
      { $match: { ...PAID, paidAt: { $gte: from, $lt: to } } },
      { $group: { _id: '$user', spent: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
      { $sort: { spent: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $project: { _id: 0, userId: '$_id', name: '$u.name', email: '$u.email', spent: 1, orders: 1 } },
    ]),
    Product.find({ isActive: true, likesCount: { $gt: 0 } })
      .sort('-likesCount')
      .limit(10)
      .select('name slug likesCount images')
      .lean(),
    Product.find({ isActive: true, ratingCount: { $gt: 0 } })
      .sort({ ratingAvg: -1, ratingCount: -1 })
      .limit(10)
      .select('name slug ratingAvg ratingCount images')
      .lean(),
    User.aggregate([
      { $match: { role: 'user', createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      lowStock,
      recentOrders,
      topCustomers: topCustomers.map((c) => ({ ...c, spent: round2(c.spent) })),
      mostLiked,
      bestRated,
      customerGrowth,
    },
  });
});

// CSV of orders created in the range (max 10,000 rows)
const cell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // block spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportOrders = asyncHandler(async (req, res) => {
  if ((req.query.format || 'csv') !== 'csv') throw new AppError('Only csv export is available for now', 400);
  const { from, to } = parseRange(req.query);
  const d = (x) => x.toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders_${d(from)}_${d(to)}.csv"`);
  res.write('\uFEFFOrder ID,Date,Customer,Email,Payment Method,Payment Status,Order Status,Items,Total\n');

  try {
    const cursor = Order.find({ createdAt: { $gte: from, $lt: to } })
      .sort('createdAt')
      .limit(10000)
      .populate('user', 'name email')
      .lean()
      .cursor();

    for await (const o of cursor) {
      const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);
      res.write(
        [o._id, o.createdAt.toISOString(), o.user?.name, o.user?.email, o.paymentMethod, o.paymentStatus, o.orderStatus, itemCount, o.totalPrice]
          .map(cell)
          .join(',') + '\n'
      );
    }
  } catch (e) {
    console.error(e);
  }
  res.end();
});