import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { startPayment, useCancelOrder, useOrder, shortId } from '../hooks/orders.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import { formatPrice, img } from '../config.js';

const STEPS = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];
const METHOD_LABEL = { COD: 'Cash on delivery', ONLINE: 'Online payment' };

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const toast = useToast();
  const { data: o, isLoading, isError, error } = useOrder(id);
  const cancel = useCancelOrder();

  const [paying, setPaying] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reviewState, setReviewState] = useState({}); // productId -> 'idle' | 'open' | 'done'

  if (isLoading) return <div className="glass skeleton-block" />;
  if (isError) {
    return (
      <div className="empty glass">
        <h2>{error.status === 404 ? 'Order not found' : 'Something went wrong'}</h2>
        <Link className="btn" to="/orders">
          My orders
        </Link>
      </div>
    );
  }

  const cancelled = o.orderStatus === 'Cancelled';
  const step = STEPS.indexOf(o.orderStatus);
  const canPay = o.paymentMethod === 'ONLINE' && o.paymentStatus !== 'Paid' && o.orderStatus === 'Pending';
  const canCancel = o.orderStatus === 'Pending' && o.paymentStatus !== 'Paid';
  const delivered = o.orderStatus === 'Delivered';

  const pay = async (provider) => {
    setPaying(provider);
    try {
      const res = await startPayment(provider, o._id);
      window.location.assign(res.url);
    } catch (ex) {
      toast(ex.message, 'error');
      setPaying('');
    }
  };

  const doCancel = () =>
    cancel.mutate(o._id, {
      onSuccess: () => {
        toast('Order cancelled');
        setConfirmCancel(false);
      },
      onError: (ex) => toast(ex.message, 'error'),
    });

  const a = o.shippingAddress;

  return (
    <>
      <div className="page-head">
        <h1>Order {shortId(o._id)}</h1>
        <Link to="/orders" className="label link">
          All orders
        </Link>
      </div>

      {location.state?.placed && (
        <div className="notice glass" role="status">
          <strong>Thank you, your order is placed.</strong> We will contact you to arrange delivery. You pay the courier on arrival.
        </div>
      )}
      {location.state?.payFailed && canPay && (
        <div className="notice glass warn" role="alert">
          Your order is saved, but we could not open the payment page ({location.state.payFailed}). You can try again below.
        </div>
      )}

      <section className="glass panel">
        <div className="order-head">
          <div className="order-badges">
            <StatusBadge status={o.orderStatus} />
            <StatusBadge status={o.paymentStatus} kind="payment" />
          </div>
          <span className="hint">Placed {new Date(o.createdAt).toLocaleString()}</span>
        </div>

        {cancelled ? (
          <p className="hint">This order was cancelled.</p>
        ) : (
          <ol className="steps" aria-label="Order progress">
            {STEPS.map((s, i) => (
              <li key={s} className={i <= step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
                <span className="step-dot" />
                <span className="label">{s}</span>
              </li>
            ))}
          </ol>
        )}

        {canPay && (
          <div className="pay-box">
            <p>
              <strong>Payment pending.</strong> Complete your payment to confirm this order.
            </p>
            <div className="pay-actions">
              <button className="btn btn-primary" disabled={!!paying} onClick={() => pay('stripe')}>
                {paying === 'stripe' ? 'Redirecting...' : 'Pay by card'}
              </button>
              <button className="btn" disabled={!!paying} onClick={() => pay('flouci')}>
                {paying === 'flouci' ? 'Redirecting...' : 'Pay with Flouci'}
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="order-grid">
        <section className="glass panel">
          <span className="label">Items</span>
          <ul className="order-items">
            {o.items.map((it) => {
              const state = reviewState[it.product] || 'idle';
              return (
                <li key={it.product}>
                  <div className="order-item-row">
                    <Link to={`/product/${it.product}`} className="mini-thumb big">
                      {it.image ? <img src={img(it.image, 160)} alt="" /> : <span className="ph">{it.name[0]}</span>}
                    </Link>
                    <div className="order-item-info">
                      <Link to={`/product/${it.product}`}>{it.name}</Link>
                      <span className="hint">
                        {formatPrice(it.price)} x {it.quantity}
                      </span>
                      {delivered && state === 'idle' && (
                        <button className="btn slim" onClick={() => setReviewState((s) => ({ ...s, [it.product]: 'open' }))}>
                          Write a review
                        </button>
                      )}
                      {delivered && state === 'done' && <span className="hint">Review sent. Thank you!</span>}
                    </div>
                    <strong>{formatPrice(it.price * it.quantity)}</strong>
                  </div>
                  {delivered && state === 'open' && (
                    <ReviewForm productId={it.product} onDone={(next) => setReviewState((s) => ({ ...s, [it.product]: next }))} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="glass panel summary static">
          <span className="label">Summary</span>
          <div className="row">
            <span>Subtotal</span>
            <span>{formatPrice(o.itemsPrice)}</span>
          </div>
          <div className="row">
            <span>Delivery</span>
            <span>{o.shippingPrice === 0 ? 'Free' : formatPrice(o.shippingPrice)}</span>
          </div>
          <div className="row total">
            <span>Total</span>
            <strong>{formatPrice(o.totalPrice)}</strong>
          </div>

          <span className="label">Payment</span>
          <p>{METHOD_LABEL[o.paymentMethod]}</p>

          <span className="label">Delivery address</span>
          <address>
            {a.fullName}
            <br />
            {a.street}
            <br />
            {a.postalCode ? `${a.postalCode} ` : ''}
            {a.city}, {a.country}
            <br />
            {a.phone}
          </address>

          {canCancel && !confirmCancel && (
            <button className="btn block" onClick={() => setConfirmCancel(true)}>
              Cancel order
            </button>
          )}
          {canCancel && confirmCancel && (
            <div className="confirm">
              <p className="hint">Cancel this order? The items go back in stock.</p>
              <div className="review-actions">
                <button className="btn btn-primary slim" disabled={cancel.isPending} onClick={doCancel}>
                  {cancel.isPending ? 'Cancelling...' : 'Yes, cancel'}
                </button>
                <button className="btn slim" onClick={() => setConfirmCancel(false)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}