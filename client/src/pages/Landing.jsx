import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Sparkles, ChartPie, Gamepad2, SquareCheck, Upload, Users } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from '../components/ui.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

const FEATURES = [
  { icon: SquareCheck, key: 'assessments' },
  { icon: Sparkles, key: 'ai' },
  { icon: Gamepad2, key: 'games' },
  { icon: ChartPie, key: 'reports' },
  { icon: Upload, key: 'content' },
  { icon: Users, key: 'homework' },
];

export default function Landing() {
  const { t } = useTranslation('landing');
  const { user, loading } = useAuth();
  const [code, setCode] = useState('');
  const nav = useNavigate();
  if (!loading && user) return <Navigate to="/admin" replace />;
  return (
    <div className="min-h-full bg-white">
      <header className="flex items-center justify-between px-6 py-4 lg:px-12">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to="/join" className="btn-ghost">{t('header.enterCode')}</Link>
          <Link to="/login" className="btn-outline">{t('header.logIn')}</Link>
          <Link to="/signup" className="btn-primary">{t('header.signUp')}</Link>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 pb-20 pt-10 text-center lg:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-brand-50 via-violet-50 to-white" />
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
          <Trans ns="landing" i18nKey="hero.title" components={{ hl: <span className="text-brand-500" /> }} />
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          {t('hero.sub')}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/signup" className="btn-primary px-6 py-3 text-base">{t('hero.cta')}</Link>
          <form
            onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/join/${code.replace(/\s/g, '')}`); }}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-1.5 pl-4"
          >
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('hero.codePlaceholder')} className="w-40 text-base font-semibold outline-none" inputMode="numeric" />
            <button className="btn-violet">{t('hero.join')}</button>
          </form>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
          {['earth', 'mars', 'jupiter', 'venus'].map((k, i) => (
            <div key={k} className={`opt-${i} flex h-28 items-center justify-center rounded-2xl font-game text-xl font-bold text-white shadow-lg animate-rise`} style={{ animationDelay: `${i * 80}ms` }}>{t(`demo.${k}`)}</div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.key} className="card p-6">
            <f.icon className="mb-3 h-7 w-7 text-brand-500" />
            <h3 className="font-bold">{t(`features.${f.key}.title`)}</h3>
            <p className="mt-1 text-sm text-slate-600">{t(`features.${f.key}.text`)}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">{t('footer')}</footer>
    </div>
  );
}
