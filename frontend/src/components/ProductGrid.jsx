import ProductCard from './ProductCard.jsx';

export default function ProductGrid({ products = [], loading, count = 8, empty = 'Nothing here yet.' }) {
  if (loading) {
    return (
      <div className="grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card glass">
            <div className="card-media skeleton" />
            <div className="card-body">
              <div className="skeleton line w40" />
              <div className="skeleton line" />
              <div className="skeleton line w60" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!products.length) {
    return (
      <div className="empty glass">
        <p>{empty}</p>
      </div>
    );
  }
  return (
    <div className="grid">
      {products.map((p) => (
        <ProductCard key={p._id} product={p} />
      ))}
    </div>
  );
}