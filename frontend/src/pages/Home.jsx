import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductGrid from '../components/ProductGrid.jsx';
import { Plus } from '../components/Icons.jsx';
import { useCategories, useProducts } from '../hooks/data.js';
import { FREE_SHIPPING_OVER, CURRENCY } from '../config.js';

const SLIDES = [
  { title: ['Objects of', 'quiet design'], a: 'Curated', b: 'Delivered' },
  { title: ['Soft forms,', 'honest materials'], a: 'Crafted', b: 'Lasting' },
  { title: ['Pay online', 'or at your door'], a: 'Secure', b: 'Flexible' },
];

export default function Home() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5500);
    return () => clearInterval(t);
  }, []);

  const { data: cats = [] } = useCategories();
  const latest = useProducts({ page: 1, limit: 8, sort: 'newest' });
  const top = useProducts({ page: 1, limit: 4, sort: 'rating' });
  const topRated = (top.data?.data || []).filter((p) => p.ratingCount > 0);

  return (
    <>
      <div className="hero-wrap">
        <section className="hero glass" aria-roledescription="carousel">
          <div className="dots">
            {SLIDES.map((_, n) => (
              <button
                key={n}
                className={`dot ${n === i ? 'on' : ''}`}
                onClick={() => setI(n)}
                aria-label={`Slide ${n + 1}`}
                aria-current={n === i}
              />
            ))}
            <Link to="/shop" className="dot-grid" aria-label="Browse the shop" />
          </div>

          <h1 key={i} className="hero-title">
            {slide.title[0]}
            <br />
            {slide.title[1]}
          </h1>

          <div className="hero-foot">
            <Link to="/shop" className="btn-icon plus" aria-label="Shop now">
              <Plus />
            </Link>
            <span className="label">{slide.a}</span>
            <span className="label">{slide.b}</span>
          </div>
        </section>
      </div>

      {cats.length > 0 && (
        <div className="chips center-chips">
          {cats.map((c) => (
            <Link key={c._id} className="chip" to={`/shop?category=${c._id}`}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="sec-head">
        <h2>New arrivals</h2>
        <Link to="/shop" className="label link">
          View all
        </Link>
      </div>
      <ProductGrid products={latest.data?.data} loading={latest.isLoading} empty="No products yet, check back soon." />

      {topRated.length > 0 && (
        <>
          <div className="sec-head">
            <h2>Top rated</h2>
            <Link to="/shop?sort=rating" className="label link">
              View all
            </Link>
          </div>
          <ProductGrid products={topRated} />
        </>
      )}

      <div className="perks">
        <div className="glass perk">
          <span className="label">Cash on delivery</span>
          <p>Pay when your order arrives at your door.</p>
        </div>
        <div className="glass perk">
          <span className="label">Secure online payment</span>
          <p>Card or wallet through trusted gateways.</p>
        </div>
        <div className="glass perk">
          <span className="label">Free delivery</span>
          <p>
            On orders over {FREE_SHIPPING_OVER} {CURRENCY}.
          </p>
        </div>
      </div>
    </>
  );
}