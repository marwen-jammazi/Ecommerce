export default function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;

  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '...') nums.push('...');
  }

  return (
    <nav className="pager" aria-label="Pagination">
      <button className="chip" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Prev
      </button>
      {nums.map((n, i) =>
        n === '...' ? (
          <span key={`gap${i}`}>...</span>
        ) : (
          <button
            key={n}
            className={`chip ${n === page ? 'active' : ''}`}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        )
      )}
      <button className="chip" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}