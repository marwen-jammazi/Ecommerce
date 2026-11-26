import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const target = from ? `${from.pathname}${from.search || ''}` : '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate(target, { replace: true });
  }, [user, target, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      await register(name, email, password);
    } catch (ex) {
      setErrors(ex.details?.length ? ex.details.map((d) => `${d.field}: ${d.message}`) : [ex.message]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth glass" onSubmit={submit}>
      <span className="label">Join us</span>
      <h1>Create account</h1>
      <label className="field">
        <span className="label">Name</span>
        <input className="input" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span className="label">Email</span>
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span className="label">Password</span>
        <input className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <span className="hint">At least 8 characters.</span>
      </label>
      {errors.length > 0 && (
        <div className="error" role="alert">
          {errors.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      )}
      <button className="btn btn-primary block" disabled={busy}>
        {busy ? 'Creating...' : 'Sign up'}
      </button>
      <p className="hint center-text">
        Already have an account? <Link to="/login" state={location.state}>Log in</Link>
      </p>
    </form>
  );
}