import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../hooks/data.js';
import { Cart, Close, Menu } from './Icons.jsx';
import { STORE_NAME } from '../config.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { data: cart } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const count = cart?.itemCount || 0;
  const close = () => setOpen(false);
  const onLogout = async () => {
    await logout();
    close();
    navigate('/');
  };

  return (
    <header className="nav glass">
      <Link to="/" className="brand" onClick={close}>
        {STORE_NAME}
      </Link>

      <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Main">
        <NavLink to="/shop" onClick={close}>
          Shop
        </NavLink>
        {user && (
          <>
            <NavLink to="/orders" onClick={close}>
              Orders
            </NavLink>
            <NavLink to="/wishlist" onClick={close}>
              Wishlist
            </NavLink>
            {user.role === 'admin' && (
              <NavLink to="/admin" onClick={close}>
                Admin
              </NavLink>
            )}
          </>
        )}
        {user ? (
          <button className="only-sm" onClick={onLogout}>
            Log out
          </button>
        ) : (
          <>
            <NavLink className="only-sm" to="/login" onClick={close}>
              Log in
            </NavLink>
            <NavLink className="only-sm" to="/register" onClick={close}>
              Sign up
            </NavLink>
          </>
        )}
      </nav>

      <div className="nav-actions">
        <div className="nav-auth hide-sm">
          {user ? (
            <>
              <span className="label">Hi, {user.name.split(' ')[0]}</span>
              <button className="btn slim" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className="btn slim" to="/login">
                Log in
              </Link>
              <Link className="btn btn-primary slim" to="/register">
                Sign up
              </Link>
            </>
          )}
        </div>
        <Link to="/cart" className="btn-icon" aria-label={`Cart, ${count} items`} onClick={close}>
          <Cart />
          {count > 0 && <span className="count">{count}</span>}
        </Link>
        <button
          className="btn-icon menu-btn"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <Close /> : <Menu />}
        </button>
      </div>
    </header>
  );
}