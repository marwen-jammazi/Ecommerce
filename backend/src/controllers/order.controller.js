import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { round2 } from '../utils/money.js';
import { delByPrefix } from '../services/cache.js';

const SHIPPING_FEE = 7;
const FREE_SHIPPING_OVER = 100;

const TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

const restoreStock = (items) =>
  Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } })));

export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod } = req.body;

  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  const lines = (cart?.items || []).filter((i) => i.product && i.product.isActive);
  if (!lines.length) throw new AppError('Cart is empty', 400);

  const reserved = [];
  let order;
  try {
    // reserve stock atomically, one product at a time
    for (const l of lines) {
      const r = await Product.updateOne(
        { _id: l.product._id, isActive: true, stock: { $gte: l.quantity } },
        { $inc: { stock: -l.quantity } }
      );
      if (r.modifiedCount !== 1) throw new AppError(`Not enough stock for "${l.product.name}"`, 409);
      reserved.push({ product: l.product._id, quantity: l.quantity });
    }

    const items = lines.map((l) => ({
      product: l.product._id,
      name: l.product.name,
      image: l.product.images?.[0]?.url,
      price: l.product.discountPrice ?? l.product.price,
      quantity: l.quantity,
    }));
    const itemsPrice = round2(items.reduce((n, i) => n + i.price * i.quantity, 0));
    const shippingPrice = itemsPrice >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;

    order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      totalPrice: round2(itemsPrice + shippingPrice),
    });
  } catch (e) {
    await restoreStock(reserved);
    throw e;
  }

  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  await delByPrefix('products:');

  res.status(201).json({
    success: true,
    data: order,
    // ONLINE orders stay Pending until the payment gateway webhook confirms (next step)
    nextAction: paymentMethod === 'ONLINE' ? 'PAY_ONLINE' : 'NONE',
  });
});

export const myOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

  const [data, total] = await Promise.all([
    Order.find({ user: req.user._id }).sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments({ user: req.user._id }),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email').lean();
  if (!order) throw new AppError('Order not found', 404);

  const ownerId = String(order.user._id);
  if (req.user.role !== 'admin' && ownerId !== String(req.user._id)) {
    throw new AppError('Order not found', 404); // do not leak that it exists
  }
  res.json({ success: true, data: order });
});

export const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, orderStatus: 'Pending', paymentStatus: { $ne: 'Paid' } },
    { $set: { orderStatus: 'Cancelled' } },
    { returnDocument: 'after' }
  );
  if (!order) throw new AppError('Order cannot be cancelled (already processed or paid)', 409);

  await restoreStock(order.items);
  await delByPrefix('products:');
  res.json({ success: true, data: order });
});

// ---------- admin ----------

export const listAllOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

  const filter = {};
  if (Object.keys(TRANSITIONS).includes(req.query.status)) filter.orderStatus = req.query.status;
  if (['COD', 'ONLINE'].includes(req.query.paymentMethod)) filter.paymentMethod = req.query.paymentMethod;
  if (['Pending', 'Paid', 'Failed', 'Refunded'].includes(req.query.paymentStatus)) {
    filter.paymentStatus = req.query.paymentStatus;
  }

  const [data, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, paymentStatus } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);

  const set = {};

  if (orderStatus) {
    if (!TRANSITIONS[order.orderStatus].includes(orderStatus)) {
      throw new AppError(`Cannot move order from ${order.orderStatus} to ${orderStatus}`, 400);
    }
    set.orderStatus = orderStatus;
    if (orderStatus === 'Delivered') {
      set.deliveredAt = new Date();
      // cash is collected at the door, so COD becomes Paid on delivery
      if (order.paymentMethod === 'COD' && order.paymentStatus !== 'Paid') {
        set.paymentStatus = 'Paid';
        set.paidAt = new Date();
      }
    }
  }

  if (paymentStatus) {
    set.paymentStatus = paymentStatus;
    if (paymentStatus === 'Paid' && !order.paidAt) set.paidAt = new Date();
  }

  // the filter on the current status makes this safe against double clicks and races
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, orderStatus: order.orderStatus },
    { $set: set },
    { returnDocument: 'after' }
  );
  if (!updated) throw new AppError('Order was modified by someone else, please retry', 409);

  if (orderStatus === 'Cancelled') {
    await restoreStock(order.items);
    await delByPrefix('products:');
  }
  res.json({ success: true, data: updated });
});