import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useCartActions, useLikes } from '../hooks/data.js';
import { Heart, Plus } from './Icons.jsx';
import Price from './Price.jsx';
import Stars from './Stars.jsx';
import { img } from '../config.js';

export default function ProductCard({ product: p }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { add } = useCartActions();
  const likes = useLikes();

  const liked = likes.ids.has(p._id);
  const soldOut = p.stock <= 0;
  const to = `/product/${p.slug}`;

  const needLogin = () => navigate('/login', { state: { from: location } });

  const onAdd = () => {
    if (!user) return needLogin();
    add.mutate(
      { productId: p._id, quantity: 1 },
      { onSuccess: () => toast('Added to cart'), onError: (e) => toast(e.message, 'error') }
    );
  };

  const onLike = () => {
    if (!user) return needLogin();
    likes.toggle.mutate({ id: p._id, liked }, { onError: (e) => toast(e.message, 'error') });
  };

  return (
    <article className="card glass">
      <div className="card-media">
        <Link to={to} aria-label={p.name}>
          {p.images?.[0]?.url ? (
            <img src={img(p.images[0].url, 600)} alt={p.name} loading="lazy" />
          ) : (
            <div className="ph">{p.name[0]}</div>
          )}
        </Link>
        <button
          className="btn-icon like"
          onClick={onLike}
          aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={liked}
        >
          <Heart filled={liked} />
        </button>
        {soldOut && <span className="badge">Sold out</span>}
      </div>
      <div className="card-body">
        <span className="label">{p.category?.name}</span>
        <h3>
          <Link to={to}>{p.name}</Link>
        </h3>
        <Stars value={p.ratingAvg} count={p.ratingCount} />
        <div className="card-foot">
          <Price price={p.price} discountPrice={p.discountPrice} />
          <button className="btn-icon" onClick={onAdd} disabled={soldOut || add.isPending} aria-label="Add to cart">
            <Plus />
          </button>
        </div>
      </div>
    </article>
  );
}