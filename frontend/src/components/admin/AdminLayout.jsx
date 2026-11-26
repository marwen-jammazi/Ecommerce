import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/reviews', label: 'Reviews' },
  { to: '/admin/users', label: 'Users' },
];

export default function AdminLayout() {
  return (
    <div className="admin">
      <aside className="admin-side glass" aria-label="Admin">
        <span className="label">Admin</span>
        <nav>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="admin-main">
        <Outlet />
      </section>
    </div>
  );
}