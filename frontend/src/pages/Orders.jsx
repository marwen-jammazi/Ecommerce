import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrders, shortId } from '../hooks/orders.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Pagination from '../components/Pagination.jsx';
import { formatPrice, img } from '../config.js';

export default function Orders() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useOrders(page);
  const orders = data?.data || [];

  return (
    <>
      <div className="page-head">
        <h1>My orders</h1>
        <span className="label">{data ? `${data.pagination.total} total` : ''}</span>
      </div>

      {isLoading && (
        <div className="order-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass skeleton-block short" />
          ))}
        </div>
      )}

      {isError && (
        <div className="empty glass">
          <p>Could not load your orders. Please try again.</p>
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <div className="empty glass">
          <h2>No orders yet</h2>
          <p>When you place an order it will show up here.</p>
          <Link className="btn btn-primary" to="/shop">
            Start shopping
          </Link>
        </div>
      )}

      <div className="order-list">
        {orders.map((o) => {
          const count = o.items.reduce((n, i) => n + i.quantity, 0);
          return (
            <Link key={o._id} to={`/orders/${o._id}`} className="order-card glass">
              <div className="order-thumbs">
                {o.items.slice(0, 3).map((it) => (
                  <span key={it.product} className="mini-thumb">
                    {it.image ? <img src={img(it.image, 120)} alt="" /> : <span className="ph">{it.name[0]}</span>}
                  </span>
                ))}
              </div>
              <div className="order-meta">
                <strong>{shortId(o._id)}</strong>
                <span className="hint">
                  {new Date(o.createdAt).toLocaleDateString()} - {count} item{count > 1 ? 's' : ''}
                </span>
              </div>
              <div className="order-badges">
                <StatusBadge status={o.orderStatus} />
                <StatusBadge status={o.paymentStatus} kind="payment" />
              </div>
              <strong className="order-total">{formatPrice(o.totalPrice)}</strong>
            </Link>
          );
        })}
      </div>

      <Pagination page={page} pages={data?.pagination.pages || 1} onChange={setPage} />
    </>
  );
}