import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../lib/auth.jsx';
import { Logo, Spinner } from '../components/ui.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

function Shell({ title, sub, children }) {
  return (
    <div className="relative flex min-h-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-violet-50 p-4">
      <LanguageSwitcher className="absolute right-4 top-4" />
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
  const { t } = useTranslation('auth');
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
    <Shell title={t('login.title')} sub={t('login.sub')}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">{t('email')}</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
        <div><label className="label">{t('password')}</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('login.submit')}</button>
      </form>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        {t('login.demo')} <button className="font-semibold text-violet-700 underline" onClick={() => { setEmail('demo@wayground.local'); setPassword('demo123'); }}>demo@wayground.local / demo123</button>
      </div>
      <p className="mt-5 text-center text-sm text-slate-600"><Trans ns="auth" i18nKey="login.newHere" components={{ link: <Link className="font-semibold text-brand-600" to="/signup" /> }} /></p>
      <p className="mt-2 text-center text-sm text-slate-600"><Trans ns="auth" i18nKey="login.student" components={{ link: <Link className="font-semibold text-violet-700" to="/join" /> }} /></p>
    </Shell>
  );
}

export function Signup() {
  const { t } = useTranslation('auth');
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
    <Shell title={t('signup.title')} sub={t('signup.sub')}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">{t('signup.fullName')}</label><input className="input" value={f.name} onChange={set('name')} required autoFocus /></div>
        <div><label className="label">{t('email')}</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
        <div><label className="label">{t('password')}</label><input className="input" type="password" minLength={6} value={f.password} onChange={set('password')} required /><p className="mt-1 text-xs text-slate-400">{t('signup.passwordHint')}</p></div>
        {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('signup.submit')}</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600"><Trans ns="auth" i18nKey="signup.haveAccount" components={{ link: <Link className="font-semibold text-brand-600" to="/login" /> }} /></p>
    </Shell>
  );
}
