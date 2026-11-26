import { Link } from 'react-router-dom';
import { STORE_NAME } from '../config.js';

export default function Footer() {
  return (
    <footer className="footer glass">
      <span className="brand small">{STORE_NAME}</span>
      <span className="label">Cash on delivery &middot; Secure online payment</span>
      <nav className="footer-links">
        <Link to="/shop">Shop</Link>
        <Link to="/cart">Cart</Link>
      </nav>
      <span className="label">&copy; {new Date().getFullYear()}</span>
    </footer>
  );
}