import { useLikes } from '../hooks/data.js';
import ProductGrid from '../components/ProductGrid.jsx';

export default function Wishlist() {
  const { products, loading } = useLikes();
  return (
    <>
      <div className="page-head">
        <h1>Wishlist</h1>
        <span className="label">{products.length} saved</span>
      </div>
      <ProductGrid products={products} loading={loading} count={4} empty="Tap the heart on any product to save it here." />
    </>
  );
}