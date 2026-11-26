import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { useCart, useCartActions } from '../hooks/data.js';
import { Minus, Plus, Trash } from '../components/Icons.jsx';
import { FREE_SHIPPING_OVER, SHIPPING_FEE, formatPrice, img } from '../config.js';

export default function Cart() {
  const { data: cart, isLoading } = useCart();
  const { update, remove } = useCartActions();
  const toast = useToast();

  if (isLoading) return <div className="glass skeleton-block" />;

  const items = cart?.items || [];
  if (!items.length) {
    return (
      <div className="empty glass">
        <h2>Your cart is empty</h2>
        <p>Find something you like and it will wait for you here.</p>
        <Link className="btn btn-primary" to="/shop">
          Browse the shop
        </Link>
      </div>
    );
  }

  const subtotal = cart.subtotal;
  const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;
  const busy = update.isPending || remove.isPending;
  const onError = (e) => toast(e.message, 'error');

  return (
    <>
      <div className="page-head">
        <h1>Cart</h1>
        <span className="label">{cart.itemCount} items</span>
      </div>

      <div className="cart">
        <div className="cart-list">
          {items.map(({ product: p, quantity, unitPrice, lineTotal }) => {
            const max = Math.min(p.stock, 20);
            return (
              <article key={p._id} className="cart-item glass">
                <Link to={`/product/${p.slug}`} className="cart-thumb">
                  {p.images?.[0]?.url ? <img src={img(p.images[0].url, 200)} alt={p.name} /> : <div className="ph">{p.name[0]}</div>}
                </Link>
                <div className="cart-info">
                  <Link to={`/product/${p.slug}`} className="cart-name">
                    {p.name}
                  </Link>
                  <span className="label">{formatPrice(unitPrice)}</span>
                  <div className="qty small" role="group" aria-label={`Quantity for ${p.name}`}>
                    <button
                      className="btn-icon"
                      disabled={busy || quantity <= 1}
                      onClick={() => update.mutate({ productId: p._id, quantity: quantity - 1 }, { onError })}
                      aria-label="Decrease quantity"
                    >
                      <Minus />
                    </button>
                    <span>{quantity}</span>
                    <button
                      className="btn-icon"
                      disabled={busy || quantity >= max}
                      onClick={() => update.mutate({ productId: p._id, quantity: quantity + 1 }, { onError })}
                      aria-label="Increase quantity"
                    >
                      <Plus />
                    </button>
                  </div>
                  {quantity >= p.stock && <span className="hint">Max available</span>}
                </div>
                <div className="cart-side">
                  <strong>{formatPrice(lineTotal)}</strong>
                  <button
                    className="btn-icon"
                    disabled={busy}
                    onClick={() => remove.mutate(p._id, { onError })}
                    aria-label={`Remove ${p.name}`}
                  >
                    <Trash />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="summary glass">
          <span className="label">Summary</span>
          <div className="row">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="row">
            <span>Delivery</span>
            <span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
          </div>
          {shipping > 0 && (
            <p className="hint">Add {formatPrice(FREE_SHIPPING_OVER - subtotal)} more for free delivery.</p>
          )}
          <div className="row total">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>
          <Link className="btn btn-primary block" to="/checkout">
            Checkout
          </Link>
        </aside>
      </div>
    </>
  );
}