import mongoose from 'mongoose';
import Order from '../models/Order.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { stripe, stripeCurrency, expectedTotal, createStripeSession } from '../services/stripe.js';
import { createFlouciPayment, verifyFlouciPayment, flouciAmount } from '../services/flouci.js';
import { markPaid } from '../services/orderPayment.js';

async function loadPayableOrder(orderId, userId) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new AppError('Order not found', 404);
  if (order.paymentMethod !== 'ONLINE') throw new AppError('This order is not an online-payment order', 400);
  if (order.paymentStatus === 'Paid') throw new AppError('Order already paid', 409);
  if (order.orderStatus !== 'Pending') throw new AppError('Order can no longer be paid', 409);
  return order;
}

// ---------- Stripe ----------

export const createStripeCheckout = asyncHandler(async (req, res) => {
  const order = await loadPayableOrder(req.body.orderId, req.user._id);
  const session = await createStripeSession(order, req.user.email);

  order.paymentProvider = 'stripe';
  order.paymentId = session.id;
  order.paymentExpiresAt = new Date(session.expires_at * 1000);
  await order.save();

  res.json({ success: true, url: session.url });
});

// mounted with express.raw() in app.js, Stripe needs the untouched body to verify the signature
export const stripeWebhook = async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }

  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const s = event.data.object;
      if (s.payment_status === 'paid') {
        const orderId = s.client_reference_id || s.metadata?.orderId;
        const order = mongoose.isValidObjectId(orderId) ? await Order.findById(orderId) : null;

        if (order && s.currency === stripeCurrency() && s.amount_total === expectedTotal(order)) {
          await markPaid(order._id, 'stripe', s.id);
        } else {
          console.error(`[stripe] ignored payment for order ${orderId}: order missing or amount/currency mismatch`);
        }
      }
    }
    res.json({ received: true });
  } catch (e) {
    console.error('[stripe webhook]', e);
    res.status(500).send('error'); // Stripe will retry
  }
};

// ---------- Flouci ----------

export const createFlouciCheckout = asyncHandler(async (req, res) => {
  const order = await loadPayableOrder(req.body.orderId, req.user._id);
  const { paymentId, link } = await createFlouciPayment(order);

  order.paymentProvider = 'flouci';
  order.paymentId = paymentId;
  order.paymentExpiresAt = new Date(Date.now() + 20 * 60 * 1000);
  await order.save();

  res.json({ success: true, url: link });
});

// frontend calls this ONCE after Flouci redirects back (Flouci rate-limits repeated pings)
export const verifyFlouci = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.body.orderId, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);
  if (order.paymentStatus === 'Paid') return res.json({ success: true, paid: true });
  if (order.paymentProvider !== 'flouci' || !order.paymentId) {
    throw new AppError('No Flouci payment was started for this order', 400);
  }

  const v = await verifyFlouciPayment(order.paymentId);
  let paid = false;
  if (v.success && v.status === 'SUCCESS') {
    if (v.amount !== flouciAmount(order)) {
      console.error(`[flouci] amount mismatch on order ${order._id}: got ${v.amount}`);
      throw new AppError('Paid amount does not match the order, contact support', 409);
    }
    paid = await markPaid(order._id, 'flouci', order.paymentId);
  }
  res.json({ success: true, paid, flouciStatus: v.status });
});

// Flouci says to verify after a webhook, so the body is only used to find the order
export const flouciWebhook = async (req, res) => {
  try {
    const paymentId = req.body?.payment_id || req.body?.id || req.query?.payment_id;
    if (typeof paymentId === 'string' && paymentId) {
      const order = await Order.findOne({ paymentProvider: 'flouci', paymentId });
      if (order && order.paymentStatus !== 'Paid') {
        const v = await verifyFlouciPayment(paymentId);
        if (v.success && v.status === 'SUCCESS' && v.amount === flouciAmount(order)) {
          await markPaid(order._id, 'flouci', paymentId);
        }
      }
    }
  } catch (e) {
    console.error('[flouci webhook]', e.message);
  }
  res.json({ received: true });
};