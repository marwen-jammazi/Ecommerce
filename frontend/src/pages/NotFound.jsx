import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="empty glass">
      <span className="label">Error 404</span>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link className="btn btn-primary" to="/">
        Back home
      </Link>
    </div>
  );
}