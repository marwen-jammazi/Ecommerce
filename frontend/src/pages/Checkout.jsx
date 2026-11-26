import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useCart } from '../hooks/data.js';
import { startPayment, useCreateOrder } from '../hooks/orders.js';
import { FREE_SHIPPING_OVER, SHIPPING_FEE, formatPrice, img } from '../config.js';

const METHODS = [
  { key: 'cod', title: 'Cash on delivery', text: 'Pay in cash when your order arrives.' },
  { key: 'stripe', title: 'Card (Stripe)', text: 'Pay securely by bank card. You will be redirected.' },
  { key: 'flouci', title: 'Flouci', text: 'Pay with Flouci or a Tunisian card. You will be redirected.' },
];

const ADDRESS_KEY = 'atelier.address';
const loadAddress = () => {
  try {
    return JSON.parse(localStorage.getItem(ADDRESS_KEY)) || {};
  } catch {
    return {};
  }
};
const saveAddress = (a) => {
  try {
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(a));
  } catch {
    /* storage may be blocked, not important */
  }
};

export default function Checkout() {
  const { user } = useAuth();
  const { data: cart, isLoading } = useCart();
  const createOrder = useCreateOrder();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const saved = loadAddress();
  const [form, setForm] = useState({
    fullName: saved.fullName || user?.name || '',
    phone: saved.phone || '',
    street: saved.street || '',
    city: saved.city || '',
    postalCode: saved.postalCode || '',
  });
  const [method, setMethod] = useState('cod');
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const items = cart?.items || [];

  if (isLoading) return <div className="glass skeleton-block" />;
  // do not bounce to the cart while an order is being placed (the server empties the cart)
  if (!items.length && !submitting) return <Navigate to="/cart" replace />;

  const subtotal = cart?.subtotal || 0;
  const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErrors([]);
    setSubmitting(true);

    const shippingAddress = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      street: form.street.trim(),
      city: form.city.trim(),
      ...(form.postalCode.trim() ? { postalCode: form.postalCode.trim() } : {}),
      country: 'Tunisia',
    };

    let order;
    try {
      const res = await createOrder.mutateAsync({
        paymentMethod: method === 'cod' ? 'COD' : 'ONLINE',
        shippingAddress,
      });
      order = res.data;
    } catch (ex) {
      setErrors(ex.details?.length ? ex.details.map((d) => `${d.field.split('.').pop()}: ${d.message}`) : [ex.message]);
      setSubmitting(false);
      return;
    }

    saveAddress(form);
    qc.invalidateQueries({ queryKey: ['products'] }); // stock changed

    if (method === 'cod') {
      navigate(`/orders/${order._id}`, { replace: true, state: { placed: true } });
      qc.invalidateQueries({ queryKey: ['cart'] });
      return;
    }

    // online: the order exists (stock reserved), now send the customer to the gateway
    try {
      const pay = await startPayment(method, order._id);
      if (!pay.url) throw new Error('No payment link received');
      window.location.assign(pay.url); // leaves the app, keep the button disabled
    } catch (ex) {
      toast(ex.message, 'error');
      navigate(`/orders/${order._id}`, { replace: true, state: { payFailed: ex.message } });
      qc.invalidateQueries({ queryKey: ['cart'] });
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Checkout</h1>
        <Link to="/cart" className="label link">
          Back to cart
        </Link>
      </div>

      <form className="checkout" onSubmit={submit}>
        <div className="checkout-main">
          <section className="glass panel">
            <span className="label">Delivery address</span>
            <div className="form-grid">
              <label className="field span2">
                <span className="label">Full name</span>
                <input className="input" required minLength={2} maxLength={80} autoComplete="name" value={form.fullName} onChange={set('fullName')} />
              </label>
              <label className="field">
                <span className="label">Phone</span>
                <input className="input" type="tel" required minLength={6} maxLength={20} autoComplete="tel" inputMode="tel" value={form.phone} onChange={set('phone')} />
              </label>
              <label className="field">
                <span className="label">City</span>
                <input className="input" required minLength={2} maxLength={80} autoComplete="address-level2" value={form.city} onChange={set('city')} />
              </label>
              <label className="field span2">
                <span className="label">Street address</span>
                <input className="input" required minLength={3} maxLength={200} autoComplete="street-address" value={form.street} onChange={set('street')} />
              </label>
              <label className="field">
                <span className="label">Postal code (optional)</span>
                <input className="input" maxLength={20} autoComplete="postal-code" value={form.postalCode} onChange={set('postalCode')} />
              </label>
            </div>
          </section>

          <fieldset className="glass panel methods">
            <legend className="label">Payment method</legend>
            {METHODS.map((m) => (
              <label key={m.key} className={`method ${method === m.key ? 'on' : ''}`}>
                <input type="radio" name="method" value={m.key} checked={method === m.key} onChange={() => setMethod(m.key)} />
                <span className="radio-dot" aria-hidden="true" />
                <span>
                  <strong>{m.title}</strong>
                  <span className="hint">{m.text}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        <aside className="summary glass">
          <span className="label">Your order</span>
          <ul className="mini-list">
            {items.map(({ product: p, quantity, lineTotal }) => (
              <li key={p._id}>
                <span className="mini-thumb">
                  {p.images?.[0]?.url ? <img src={img(p.images[0].url, 120)} alt="" /> : <span className="ph">{p.name[0]}</span>}
                </span>
                <span className="mini-name">
                  {p.name} <em>x {quantity}</em>
                </span>
                <span>{formatPrice(lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="row">
            <span>Delivery</span>
            <span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
          </div>
          <div className="row total">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>
          {errors.length > 0 && (
            <div className="error" role="alert">
              {errors.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </div>
          )}
          <button className="btn btn-primary block" disabled={submitting}>
            {submitting ? (method === 'cod' ? 'Placing order...' : 'Redirecting...') : method === 'cod' ? 'Place order' : 'Continue to payment'}
          </button>
          <p className="hint">
            {method === 'cod' ? 'You pay the courier when the order arrives.' : 'You will be taken to the payment page to finish.'}
          </p>
        </aside>
      </form>
    </>
  );
}