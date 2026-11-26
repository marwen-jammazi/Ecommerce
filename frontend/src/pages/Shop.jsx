import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductGrid from '../components/ProductGrid.jsx';
import Pagination from '../components/Pagination.jsx';
import { useCategories, useProducts } from '../hooks/data.js';

const SORTS = [
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Top rated'],
];

const enterToBlur = (e) => e.key === 'Enter' && e.currentTarget.blur();

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const params = {
    page: Number(sp.get('page')) || 1,
    limit: 12,
    search: sp.get('search') || '',
    category: sp.get('category') || '',
    sort: sp.get('sort') || 'newest',
    minPrice: sp.get('minPrice') || '',
    maxPrice: sp.get('maxPrice') || '',
  };

  const { data, isLoading, isError, isPlaceholderData } = useProducts(params);
  const { data: cats = [] } = useCategories();
  const [search, setSearch] = useState(params.search);
  const [open, setOpen] = useState(false);

  // changing any filter goes back to page 1
  const setParam = (obj) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(obj)) {
        if (v === '' || v == null) n.delete(k);
        else n.set(k, v);
      }
      if (!('page' in obj)) n.delete('page');
      return n;
    });

  useEffect(() => {
    setSearch(params.search);
  }, [params.search]);

  // debounced search box
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== params.search) setParam({ search });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <>
      <div className="page-head">
        <h1>Shop</h1>
        <span className="label">{data ? `${data.pagination.total} products` : ''}</span>
      </div>

      <section className="filters glass">
        <div className="filters-top">
          <input
            className="input"
            type="search"
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search products"
          />
          <select
            className="input"
            value={params.sort}
            onChange={(e) => setParam({ sort: e.target.value })}
            aria-label="Sort products"
          >
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button className="btn show-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            Filters
          </button>
        </div>

        <div className={`filters-more ${open ? 'open' : ''}`}>
          <div className="chips">
            <button className={`chip ${!params.category ? 'active' : ''}`} onClick={() => setParam({ category: '' })}>
              All
            </button>
            {cats.map((c) => (
              <button
                key={c._id}
                className={`chip ${params.category === c._id ? 'active' : ''}`}
                onClick={() => setParam({ category: c._id })}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="price-range">
            <input
              className="input"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="Min price"
              aria-label="Minimum price"
              key={`min${params.minPrice}`}
              defaultValue={params.minPrice}
              onBlur={(e) => e.target.value !== params.minPrice && setParam({ minPrice: e.target.value })}
              onKeyDown={enterToBlur}
            />
            <input
              className="input"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="Max price"
              aria-label="Maximum price"
              key={`max${params.maxPrice}`}
              defaultValue={params.maxPrice}
              onBlur={(e) => e.target.value !== params.maxPrice && setParam({ maxPrice: e.target.value })}
              onKeyDown={enterToBlur}
            />
          </div>
        </div>
      </section>

      {isError ? (
        <div className="empty glass">
          <p>Could not load products. Please try again.</p>
        </div>
      ) : (
        <div style={{ opacity: isPlaceholderData ? 0.55 : 1, transition: 'opacity .2s' }}>
          <ProductGrid
            products={data?.data}
            loading={isLoading}
            count={12}
            empty="No products match your filters."
          />
        </div>
      )}

      <Pagination
        page={params.page}
        pages={data?.pagination.pages || 1}
        onChange={(n) => {
          setParam({ page: String(n) });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </>
  );
}