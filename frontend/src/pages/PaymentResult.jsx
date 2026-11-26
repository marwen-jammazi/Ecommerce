import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useOrder, shortId } from '../hooks/orders.js';

const MAX_POLLS = 40; // polls every 2 seconds, enough for a slow webhook to arrive

export function PaymentSuccess() {
  const [sp] = useSearchParams();
  const orderId = sp.get('orderId');
  const provider = sp.get('provider');
  const qc = useQueryClient();
  const asked = useRef(false);
  const [verify, setVerify] = useState(provider === 'flouci' ? 'checking' : 'skip');
  const [expired, setExpired] = useState(false);

  // after about 30 seconds stop saying "confirming" and tell the customer what to do
  useEffect(() => {
    const t = setTimeout(() => setExpired(true), 32000);
    return () => clearTimeout(t);
  }, []);

  // Flouci: ask the server to verify with Flouci exactly once (it rate-limits repeated calls)
  useEffect(() => {
    if (provider !== 'flouci' || !orderId || asked.current) return;
    asked.current = true;
    api('/payments/flouci/verify', { method: 'POST', body: { orderId } })
      .then((r) => setVerify(r.paid ? 'paid' : 'unpaid'))
      .catch(() => setVerify('error'))
      .finally(() => qc.invalidateQueries({ queryKey: ['order', orderId] }));
  }, [provider, orderId, qc]);

  // Stripe confirms through a webhook, so poll the order until it shows as paid
  const { data: o, isError } = useOrder(orderId, {
    refetchInterval: (q) =>
      q.state.data?.paymentStatus === 'Paid' || q.state.dataUpdateCount > MAX_POLLS ? false : 2000,
  });

  if (!orderId || isError) {
    return (
      <div className="empty glass">
        <h2>We could not find this payment</h2>
        <Link className="btn" to="/orders">
          My orders
        </Link>
      </div>
    );
  }

  // polling keeps running in the background, so a late confirmation still flips this page to "paid"
  const paid = o?.paymentStatus === 'Paid';
  const notConfirmed = expired || verify === 'unpaid' || verify === 'error';

  if (paid) {
    return (
      <div className="result glass">
        <span className="result-mark ok" aria-hidden="true">
          &#10003;
        </span>
        <h1>Payment received</h1>
        <p>Thank you! Order {shortId(orderId)} is confirmed and we are getting it ready.</p>
        <div className="pay-actions">
          <Link className="btn btn-primary" to={`/orders/${orderId}`}>
            View order
          </Link>
          <Link className="btn" to="/shop">
            Keep shopping
          </Link>
        </div>
      </div>
    );
  }

  if (notConfirmed) {
    return (
      <div className="result glass">
        <span className="result-mark wait" aria-hidden="true">
          ...
        </span>
        <h1>We have not got the confirmation yet</h1>
        <p>
          {verify === 'unpaid'
            ? 'The payment provider has not confirmed this payment. If you did not finish paying, you can try again from your order.'
            : 'This can take a minute. Your order is saved. Check its status in a moment.'}
        </p>
        <div className="pay-actions">
          <Link className="btn btn-primary" to={`/orders/${orderId}`}>
            Go to my order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="result glass" role="status">
      <span className="spinner" aria-hidden="true" />
      <h1>Confirming your payment</h1>
      <p>Please wait a moment, do not close this page.</p>
    </div>
  );
}

export function PaymentCancelled() {
  const [sp] = useSearchParams();
  const orderId = sp.get('orderId');
  return (
    <div className="result glass">
      <span className="result-mark no" aria-hidden="true">
        &times;
      </span>
      <h1>Payment not completed</h1>
      <p>No money was taken. Your order is saved for a short time, so you can try paying again.</p>
      <div className="pay-actions">
        {orderId && (
          <Link className="btn btn-primary" to={`/orders/${orderId}`}>
            Back to my order
          </Link>
        )}
        <Link className="btn" to="/shop">
          Keep shopping
        </Link>
      </div>
    </div>
  );
}