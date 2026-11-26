import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminProducts, useProductActions } from '../../hooks/admin.js';
import { useCategories } from '../../hooks/data.js';
import { useToast } from '../../context/ToastContext.jsx';
import Pagination from '../../components/Pagination.jsx';
import { Plus, Trash } from '../../components/Icons.jsx';
import { formatPrice, img } from '../../config.js';

export default function AdminProducts() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const { data, isLoading, isError } = useAdminProducts({ page, limit: 12, search, category });
  const { data: cats = [] } = useCategories();
  const { update, remove } = useProductActions();
  const [confirming, setConfirming] = useState(null);

  const list = data?.data || [];
  const pagination = data?.pagination;

  const toggle = (p) =>
    update.mutate(
      { id: p._id, body: { isActive: p.isActive === false } },
      { onSuccess: () => toast(p.isActive === false ? 'Product is visible again' : 'Product hidden from the shop', 'success'), onError: (e) => toast(e.message, 'error') }
    );

  const del = (p) =>
    remove.mutate(p._id, {
      onSuccess: () => {
        setConfirming(null);
        toast('Product deleted', 'success');
      },
      onError: (e) => toast(e.message, 'error'),
    });

  return (
    <>
      <div className="admin-head">
        <h1>Products</h1>
        <Link to="/admin/products/new" className="btn btn-primary">
          <Plus width="16" height="16" /> New product
        </Link>
      </div>

      <div className="admin-filters">
        <input
          className="input"
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search products"
        />
        <select
          className="input"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="center">
          <span className="spinner" aria-label="Loading" />
        </div>
      )}
      {isError && <p className="error">Could not load products.</p>}

      {!isLoading && !isError && list.length === 0 && (
        <div className="empty glass">
          <p>No products yet.</p>
          <Link to="/admin/products/new" className="btn btn-primary">
            Create the first product
          </Link>
        </div>
      )}

      {list.length > 0 && (
        <ul className="admin-list glass">
          {list.map((p) => (
            <li key={p._id} className={p.isActive === false ? 'is-hidden' : ''}>
              <div className="thumb">{p.images?.[0] ? <img src={img(p.images[0].url, 120)} alt="" /> : <span>No image</span>}</div>
              <div className="info">
                <Link to={`/admin/products/${p._id}`} className="name">
                  {p.name}
                </Link>
                <span className="meta">{p.category?.name || 'No category'}</span>
              </div>
              <div className="num">
                <strong>{formatPrice(p.discountPrice != null && p.discountPrice < p.price ? p.discountPrice : p.price)}</strong>
                <span className={`meta ${p.stock <= 5 ? 'low' : ''}`}>{p.stock} in stock</span>
              </div>
              <div className="actions">
                <button className="chip" onClick={() => toggle(p)} disabled={update.isPending}>
                  {p.isActive === false ? 'Hidden' : 'Visible'}
                </button>
                <Link to={`/admin/products/${p._id}`} className="chip">
                  Edit
                </Link>
                {confirming === p._id ? (
                  <>
                    <button className="chip danger" onClick={() => del(p)} disabled={remove.isPending}>
                      Confirm
                    </button>
                    <button className="chip" onClick={() => setConfirming(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button className="btn-icon" aria-label={`Delete ${p.name}`} onClick={() => setConfirming(p._id)}>
                    <Trash width="16" height="16" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination && <Pagination page={pagination.page} pages={pagination.pages} onChange={setPage} />}
    </>
  );
}