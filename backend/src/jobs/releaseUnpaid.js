import Order from '../models/Order.js';
import redis from '../config/redis.js';
import { stripe, expectedTotal } from '../services/stripe.js';
import { verifyFlouciPayment, flouciAmount } from '../services/flouci.js';
import { markPaid, releaseUnpaid } from '../services/orderPayment.js';

// asks the gateway one last time before giving up on an order
async function reconcile(order) {
  try {
    if (order.paymentProvider === 'flouci' && order.paymentId) {
      const v = await verifyFlouciPayment(order.paymentId);
      if (v.success && v.status === 'SUCCESS' && v.amount === flouciAmount(order)) {
        await markPaid(order._id, 'flouci', order.paymentId);
        return 'paid';
      }
    }
    if (order.paymentProvider === 'stripe' && order.paymentId && stripe) {
      const s = await stripe.checkout.sessions.retrieve(order.paymentId);
      if (s.payment_status === 'paid' && s.amount_total === expectedTotal(order)) {
        await markPaid(order._id, 'stripe', order.paymentId);
        return 'paid';
      }
    }
    return 'unpaid';
  } catch (e) {
    console.error('[release-job] gateway check failed for', String(order._id), e.message);
    return 'error'; // gateway down: try again next round instead of cancelling
  }
}

async function run() {
  try {
    // with several API instances only one runs the job per cycle (all updates are atomic anyway)
    if (redis) {
      try {
        if (!(await redis.set('lock:release-unpaid', '1', 'EX', 240, 'NX'))) return;
      } catch {}
    }

    const minutes = Number(process.env.ORDER_PAYMENT_TIMEOUT_MIN) || 45;
    const stale = await Order.find({
      paymentMethod: 'ONLINE',
      paymentStatus: 'Pending',
      orderStatus: 'Pending',
      createdAt: { $lt: new Date(Date.now() - minutes * 60000) },
    })
      .limit(50)
      .lean();

    let released = 0;
    for (const order of stale) {
      const result = await reconcile(order);
      if (result === 'unpaid' && (await releaseUnpaid(order._id))) released++;
    }
    if (released) console.log(`[release-job] cancelled ${released} unpaid order(s) and released their stock`);
  } catch (e) {
    console.error('[release-job]', e.message);
  }
}

export function startReleaseJob() {
  setTimeout(run, 30 * 1000);
  setInterval(run, 5 * 60 * 1000);
}