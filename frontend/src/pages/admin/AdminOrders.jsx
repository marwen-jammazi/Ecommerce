import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminOrders, useUpdateOrderStatus } from '../../hooks/admin.js';
import { shortId } from '../../hooks/orders.js';
import { useToast } from '../../context/ToastContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import Pagination from '../../components/Pagination.jsx';
import { formatPrice } from '../../config.js';

const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
const NEXT = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

export default function AdminOrders() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const { data, isLoading, isError, error } = useAdminOrders({
    page,
    limit: 12,
    status,
    orderStatus: status,
    paymentMethod: method,
  });
  const update = useUpdateOrderStatus();
  const [busy, setBusy] = useState(null);

  const list = data?.data || [];

  const change = (o, next) => {
    setBusy(o._id);
    update.mutate(
      { id: o._id, status: next },
      {
        onSuccess: () => toast(`Order ${shortId(o._id)} is now ${next}`, 'success'),
        onError: (e) => toast(e.message, 'error'),
        onSettled: () => setBusy(null),
      }
    );
  };

  return (
    <>
      <div className="admin-head">
        <h1>Orders</h1>
      </div>

      <div className="chips range" role="group" aria-label="Filter by status">
        <button className={`chip ${status === '' ? 'active' : ''}`} onClick={() => { setStatus(''); setPage(1); }}>
          All
        </button>
        {STATUSES.map((s) => (
          <button key={s} className={`chip ${status === s ? 'active' : ''}`} onClick={() => { setStatus(s); setPage(1); }}>
            {s}
          </button>
        ))}
      </div>
      <div className="admin-filters one">
        <select className="input" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} aria-label="Payment method">
          <option value="">All payment methods</option>
          <option value="COD">Cash on delivery</option>
          <option value="ONLINE">Online</option>
        </select>
      </div>

      {isLoading && (
        <div className="center">
          <span className="spinner" aria-label="Loading" />
        </div>
      )}
      {isError && <p className="error">Could not load orders ({error?.message}).</p>}
      {!isLoading && !isError && list.length === 0 && (
        <div className="empty glass">
          <p>No orders found.</p>
        </div>
      )}

      {list.length > 0 && (
        <ul className="admin-list glass orders">
          {list.map((o) => {
            const next = NEXT[o.orderStatus] || [];
            const who = o.user?.name || o.shippingAddress?.fullName || o.user?.email || 'Customer';
            const count = (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
            return (
              <li key={o._id}>
                <div className="info">
                  <Link to={`/orders/${o._id}`} className="name">
                    {shortId(o._id)} <span className="who">{who}</span>
                  </Link>
                  <span className="meta">
                    {new Date(o.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} - {count} item{count === 1 ? '' : 's'} - {o.paymentMethod === 'COD' ? 'Cash on delivery' : o.paymentProvider || 'Online'}
                    {o.shippingAddress?.city ? ` - ${o.shippingAddress.city}` : ''}
                  </span>
                </div>
                <div className="num">
                  <strong>{formatPrice(o.totalPrice)}</strong>
                  <span className="badges">
                    <StatusBadge status={o.orderStatus} />
                    <StatusBadge status={o.paymentStatus} kind="payment" />
                  </span>
                </div>
                <div className="actions">
                  {next.length === 0 ? (
                    <span className="meta">No further steps</span>
                  ) : (
                    next.map((s) => (
                      <button key={s} className={`chip ${s === 'Cancelled' ? 'danger' : ''}`} disabled={busy === o._id} onClick={() => change(o, s)}>
                        {s === 'Cancelled' ? 'Cancel' : `Mark ${s.toLowerCase()}`}
                      </button>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data?.pagination && <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />}
    </>
  );
}