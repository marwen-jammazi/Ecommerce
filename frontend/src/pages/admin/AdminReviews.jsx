import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminReviews, useDeleteReview } from '../../hooks/admin.js';
import { useToast } from '../../context/ToastContext.jsx';
import Stars from '../../components/Stars.jsx';
import Pagination from '../../components/Pagination.jsx';
import { Trash } from '../../components/Icons.jsx';
import { img } from '../../config.js';

export default function AdminReviews() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error } = useAdminReviews({ page, limit: 10, rating, search });
  const del = useDeleteReview();
  const [confirming, setConfirming] = useState(null);

  const list = data?.data || [];

  const remove = (r) =>
    del.mutate(r._id, {
      onSuccess: () => {
        setConfirming(null);
        toast('Review deleted', 'success');
      },
      onError: (e) => toast(e.message, 'error'),
    });

  return (
    <>
      <div className="admin-head">
        <h1>Reviews</h1>
        {data?.pagination && <span className="label">{data.pagination.total} in total</span>}
      </div>

      <div className="chips range" role="group" aria-label="Filter by rating">
        <button className={`chip ${rating === '' ? 'active' : ''}`} onClick={() => { setRating(''); setPage(1); }}>
          All
        </button>
        {[5, 4, 3, 2, 1].map((n) => (
          <button key={n} className={`chip ${String(n) === rating ? 'active' : ''}`} aria-pressed={String(n) === rating} onClick={() => { setRating(String(n)); setPage(1); }}>
            {n} star{n > 1 ? 's' : ''}
          </button>
        ))}
      </div>
      <div className="admin-filters one">
        <input className="input" type="search" placeholder="Search in comments" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search comments" />
      </div>

      {isLoading && (
        <div className="center">
          <span className="spinner" aria-label="Loading" />
        </div>
      )}
      {isError && (
        <p className="error">
          Could not load reviews ({error?.message}).
          {error?.status === 404 && ' The backend still needs the new "list all reviews" route.'}
        </p>
      )}
      {!isLoading && !isError && list.length === 0 && (
        <div className="empty glass">
          <p>No reviews found.</p>
        </div>
      )}

      {list.length > 0 && (
        <ul className="admin-list glass reviews">
          {list.map((r) => (
            <li key={r._id}>
              <div className="thumb">{r.product?.images?.[0] ? <img src={img(r.product.images[0].url, 120)} alt="" /> : <span>No image</span>}</div>
              <div className="info">
                <div className="r-top">
                  <Stars value={r.rating} />
                  <span className="meta">{new Date(r.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</span>
                </div>
                <p className="r-text">{r.comment || <em className="meta">No comment</em>}</p>
                <span className="meta">
                  {r.user?.name || 'Deleted user'}
                  {r.user?.email ? ` (${r.user.email})` : ''} on{' '}
                  {r.product?.slug ? <Link to={`/product/${r.product.slug}`}>{r.product.name}</Link> : r.product?.name || 'a removed product'}
                </span>
              </div>
              <div className="actions">
                {confirming === r._id ? (
                  <>
                    <button className="chip danger" onClick={() => remove(r)} disabled={del.isPending}>
                      Confirm
                    </button>
                    <button className="chip" onClick={() => setConfirming(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button className="btn-icon" aria-label={`Delete review by ${r.user?.name || 'user'}`} onClick={() => setConfirming(r._id)}>
                    <Trash width="16" height="16" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data?.pagination && <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />}
    </>
  );
}