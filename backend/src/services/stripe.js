import Stripe from 'stripe';
import AppError from '../utils/AppError.js';
import { clientUrl } from '../utils/clientUrl.js';

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const THREE_DECIMAL = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd']);
export const stripeCurrency = () => (process.env.STRIPE_CURRENCY || 'usd').toLowerCase();

// store price -> Stripe smallest unit (supports 2 and 3 decimal currencies)
export function toMinor(amount) {
  const rate = Number(process.env.STRIPE_RATE) || 1;
  if (THREE_DECIMAL.has(stripeCurrency())) return Math.round((amount * rate * 1000) / 10) * 10; // Stripe wants a multiple of 10
  return Math.round(amount * rate * 100);
}

export const expectedTotal = (order) =>
  order.items.reduce((n, i) => n + i.quantity * toMinor(i.price), 0) +
  (order.shippingPrice > 0 ? toMinor(order.shippingPrice) : 0);

export async function createStripeSession(order, email) {
  if (!stripe) throw new AppError('Stripe is not configured', 503);
  const currency = stripeCurrency();
  const client = clientUrl();

  const line_items = order.items.map((i) => ({
    quantity: i.quantity,
    price_data: {
      currency,
      unit_amount: toMinor(i.price),
      product_data: { name: i.name, ...(i.image ? { images: [i.image] } : {}) },
    },
  }));
  if (order.shippingPrice > 0) {
    line_items.push({
      quantity: 1,
      price_data: { currency, unit_amount: toMinor(order.shippingPrice), product_data: { name: 'Shipping' } },
    });
  }

  try {
    return await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email,
      client_reference_id: String(order._id),
      metadata: { orderId: String(order._id) },
      success_url: `${client}/payment/success?orderId=${order._id}&provider=stripe`,
      cancel_url: `${client}/payment/cancelled?orderId=${order._id}`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60, // Stripe minimum is 30 min
    });
  } catch (e) {
    console.error('[stripe]', e.message);
    throw new AppError(`Could not start Stripe payment: ${e.message}`, 502);
  }
}