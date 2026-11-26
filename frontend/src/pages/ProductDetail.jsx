import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useCartActions, useLikes, useProduct, useReviews } from '../hooks/data.js';
import { Heart, Minus, Plus } from '../components/Icons.jsx';
import Price from '../components/Price.jsx';
import Stars from '../components/Stars.jsx';
import Pagination from '../components/Pagination.jsx';
import { img } from '../config.js';

export default function ProductDetail() {
  const { slug } = useParams();
  const { data: p, isLoading, isError, error } = useProduct(slug);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { add } = useCartActions();
  const likes = useLikes();

  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [rPage, setRPage] = useState(1);
  const reviews = useReviews(p?._id, rPage);

  if (isLoading) return <div className="pd glass skeleton-block" />;
  if (isError) {
    return (
      <div className="empty glass">
        <h2>{error.status === 404 ? 'Product not found' : 'Something went wrong'}</h2>
        <Link className="btn" to="/shop">
          Back to shop
        </Link>
      </div>
    );
  }

  const images = p.images || [];
  const maxQty = Math.max(1, Math.min(p.stock, 20));
  const soldOut = p.stock <= 0;
  const liked = likes.ids.has(p._id);
  const needLogin = () => navigate('/login', { state: { from: location } });

  const onAdd = () => {
    if (!user) return needLogin();
    add.mutate(
      { productId: p._id, quantity: qty },
      { onSuccess: () => toast('Added to cart'), onError: (e) => toast(e.message, 'error') }
    );
  };

  const onLike = () => {
    if (!user) return needLogin();
    likes.toggle.mutate({ id: p._id, liked }, { onError: (e) => toast(e.message, 'error') });
  };

  const stockText = soldOut ? 'Sold out' : p.stock <= 5 ? `Only ${p.stock} left` : 'In stock';

  return (
    <>
      <section className="pd glass">
        <div className="gallery">
          <div className="pd-main">
            {images[idx] ? <img src={img(images[idx].url, 1000)} alt={p.name} /> : <div className="ph">{p.name[0]}</div>}
          </div>
          {images.length > 1 && (
            <div className="thumbs">
              {images.map((im, n) => (
                <button
                  key={im.publicId || n}
                  className={`thumb ${n === idx ? 'on' : ''}`}
                  onClick={() => setIdx(n)}
                  aria-label={`Image ${n + 1}`}
                >
                  <img src={img(im.url, 160)} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <span className="label">{p.category?.name}</span>
          <h1>{p.name}</h1>
          <Stars value={p.ratingAvg} count={p.ratingCount} />
          <Price price={p.price} discountPrice={p.discountPrice} size="lg" />
          <p className="desc">{p.description}</p>
          <span className={`stock ${soldOut ? 'out' : p.stock <= 5 ? 'low' : ''}`}>{stockText}</span>

          <div className="buy">
            <div className="qty" role="group" aria-label="Quantity">
              <button className="btn-icon" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
                <Minus />
              </button>
              <span>{Math.min(qty, maxQty)}</span>
              <button className="btn-icon" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity">
                <Plus />
              </button>
            </div>
            <button className="btn btn-primary grow" onClick={onAdd} disabled={soldOut || add.isPending}>
              {soldOut ? 'Sold out' : add.isPending ? 'Adding...' : 'Add to cart'}
            </button>
            <button
              className={`btn-icon ${liked ? 'liked' : ''}`}
              onClick={onLike}
              aria-pressed={liked}
              aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart filled={liked} />
            </button>
          </div>
          <p className="hint">Pay with cash on delivery or online at checkout.</p>
        </div>
      </section>

      <div className="sec-head">
        <h2>Reviews</h2>
        <span className="label">{p.ratingCount} total</span>
      </div>
      <div className="reviews">
        {reviews.isLoading && <div className="glass review skeleton-block short" />}
        {reviews.data?.data.length === 0 && (
          <div className="empty glass">
            <p>No reviews yet. Customers who received this product can review it from their orders.</p>
          </div>
        )}
        {reviews.data?.data.map((r) => (
          <article key={r._id} className="review glass">
            <div className="review-top">
              <strong>{r.user?.name || 'Customer'}</strong>
              <span className="label">{new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
            <Stars value={r.rating} />
            {r.comment && <p>{r.comment}</p>}
          </article>
        ))}
      </div>
      <Pagination page={rPage} pages={reviews.data?.pagination.pages || 1} onChange={setRPage} />
    </>
  );
}