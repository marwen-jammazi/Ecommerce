import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Orbs from './Orbs.jsx';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

const variantFor = (path) => (path === '/' ? 'home' : path === '/login' || path === '/register' ? 'auth' : 'page');

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Orbs />
      <div className="shell">
        {/* rendered inside .shell so it can sit behind the content and scroll with the page */}
        <OrbsTop variant={variantFor(pathname)} />
        <Navbar />
        <main className="container">
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  );
}

function OrbsTop({ variant }) {
  if (variant === 'page') return null;
  return (
    <div className="orbs-top" aria-hidden="true">
      <i className="orb-dark o1" />
      <i className="orb-dark o2" />
      {variant === 'home' && <i className="orb-dark o3" />}
    </div>
  );
}