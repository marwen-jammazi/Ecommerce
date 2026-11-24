import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { delByPrefix } from './cache.js';

const restoreStock = (items) =>
  Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } })));

// idempotent: safe to call from webhooks, verify calls and the job at the same time
export async function markPaid(orderId, provider, paymentId) {
  const paid = await Order.findOneAndUpdate(
    { _id: orderId, paymentMethod: 'ONLINE', paymentStatus: { $in: ['Pending', 'Failed'] }, orderStatus: { $ne: 'Cancelled' } },
    { $set: { paymentStatus: 'Paid', paidAt: new Date(), paymentProvider: provider, paymentId } },
    { new: true }
  );
  if (paid) {
    await Order.updateOne({ _id: orderId, orderStatus: 'Pending' }, { $set: { orderStatus: 'Confirmed' } });
    return true;
  }

  const order = await Order.findById(orderId).lean();
  if (!order) return false;
  if (order.paymentStatus === 'Paid') return true; // duplicate webhook

  // customer paid after we already cancelled: record it so the admin can refund
  if (order.orderStatus === 'Cancelled' && order.paymentStatus !== 'Refunded') {
    await Order.updateOne(
      { _id: orderId },
      { $set: { paymentStatus: 'Paid', paidAt: new Date(), paymentProvider: provider, paymentId } }
    );
    console.warn(`[payments] order ${orderId} was paid after cancellation, refund it manually`);
  }
  return false;
}

export async function releaseUnpaid(orderId) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentMethod: 'ONLINE', paymentStatus: 'Pending', orderStatus: 'Pending' },
    { $set: { paymentStatus: 'Failed', orderStatus: 'Cancelled' } },
    { new: true }
  );
  if (!order) return false;
  await restoreStock(order.items);
  await delByPrefix('products:');
  return true;
}