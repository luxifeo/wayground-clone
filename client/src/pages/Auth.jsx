import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Logo, Spinner } from '../components/ui.jsx';

function Shell({ title, sub, children }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-violet-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Link to="/"><Logo /></Link></div>
        <div className="card p-7">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(email, password);
      nav(params.get('next') || '/admin', { replace: true });
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  return (
    <Shell title="Welcome back" sub="Log in to create and host assessments.">
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
        <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Log in</button>
      </form>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        Demo account: <button className="font-semibold text-violet-700 underline" onClick={() => { setEmail('demo@wayground.local'); setPassword('demo123'); }}>demo@wayground.local / demo123</button>
      </div>
      <p className="mt-5 text-center text-sm text-slate-600">New here? <Link className="font-semibold text-brand-600" to="/signup">Create an account</Link></p>
      <p className="mt-2 text-center text-sm text-slate-600">Student? <Link className="font-semibold text-violet-700" to="/join">Join a game</Link></p>
    </Shell>
  );
}

export function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await signup(f.name, f.email, f.password);
      nav('/admin', { replace: true });
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  return (
    <Shell title="Create your teacher account" sub="Free forever. Start making engaging assessments in minutes.">
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Full name</label><input className="input" value={f.name} onChange={set('name')} required autoFocus /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
        <div><label className="label">Password</label><input className="input" type="password" minLength={6} value={f.password} onChange={set('password')} required /><p className="mt-1 text-xs text-slate-400">At least 6 characters.</p></div>
        {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Sign up</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">Already have an account? <Link className="font-semibold text-brand-600" to="/login">Log in</Link></p>
    </Shell>
  );
}
