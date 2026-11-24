import AppError from '../utils/AppError.js';
import { clientUrl } from '../utils/clientUrl.js';

const BASE = 'https://developers.flouci.com/api/v2';

const headers = () => ({
  Authorization: `Bearer ${process.env.FLOUCI_PUBLIC_KEY}:${process.env.FLOUCI_PRIVATE_KEY}`,
  'Content-Type': 'application/json',
});

const configured = () => process.env.FLOUCI_PUBLIC_KEY && process.env.FLOUCI_PRIVATE_KEY;

// Flouci amounts are integers in millimes (1 TND = 1000)
export const flouciAmount = (order) => Math.round(order.totalPrice * 1000);

export async function createFlouciPayment(order) {
  if (!configured()) throw new AppError('Flouci is not configured', 503);
  const client = clientUrl();

  const body = {
    amount: flouciAmount(order),
    accept_card: true,
    session_timeout_secs: 1200,
    success_link: `${client}/payment/success?orderId=${order._id}&provider=flouci`,
    fail_link: `${client}/payment/cancelled?orderId=${order._id}`,
    developer_tracking_id: String(order._id),
  };
  if (process.env.API_PUBLIC_URL) {
    body.webhook = `${process.env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/payments/flouci/webhook`;
  }

  let data;
  try {
    const res = await fetch(`${BASE}/generate_payment`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data?.result?.message || data?.message || `HTTP ${res.status}`);
  } catch (e) {
    console.error('[flouci] generate_payment failed:', e.message);
    throw new AppError('Could not start Flouci payment', 502);
  }

  const r = data?.result;
  if (!r?.payment_id || !r?.link) {
    console.error('[flouci] unexpected response', JSON.stringify(data));
    throw new AppError('Could not start Flouci payment', 502);
  }
  return { paymentId: r.payment_id, link: r.link };
}

export async function verifyFlouciPayment(paymentId) {
  if (!configured()) throw new AppError('Flouci is not configured', 503);
  const res = await fetch(`${BASE}/verify_payment/${encodeURIComponent(paymentId)}`, {
    headers: headers(),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Flouci verify HTTP ${res.status}`);
  return {
    success: data.success === true,
    status: data.result?.status, // SUCCESS | PENDING | EXPIRED | FAILURE | ...
    amount: Number(data.result?.amount),
  };
}