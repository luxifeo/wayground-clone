import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Sparkles, ChartPie, Gamepad2, SquareCheck, Upload, Users } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from '../components/ui.jsx';

const FEATURES = [
  { icon: SquareCheck, title: 'Interactive assessments', text: 'Multiple choice, multi-select, fill in the blank, reorder, match, polls, open ended and drawing questions.' },
  { icon: Sparkles, title: 'AI that saves hours', text: 'Turn a topic, a PDF, a Word file or a photo of a worksheet into a ready-to-play quiz with a multimodal Gemma model.' },
  { icon: Gamepad2, title: 'Live & self-paced games', text: 'Host teacher-led sessions on the big screen or let students play at their own pace with a live leaderboard.' },
  { icon: ChartPie, title: 'Instant reports', text: 'Accuracy per student and per question, answer distributions and AI-assisted grading of open ended answers.' },
  { icon: Upload, title: 'Bring your content', text: 'Upload documents, paste text or share a link. Edit everything before you publish.' },
  { icon: Users, title: 'Homework mode', text: 'Assign quizzes with a deadline and a join code. Students can join from any device.' },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const [code, setCode] = useState('');
  const nav = useNavigate();
  if (!loading && user) return <Navigate to="/admin" replace />;
  return (
    <div className="min-h-full bg-white">
      <header className="flex items-center justify-between px-6 py-4 lg:px-12">
        <Logo />
        <div className="flex items-center gap-2">
          <Link to="/join" className="btn-ghost">Enter code</Link>
          <Link to="/login" className="btn-outline">Log in</Link>
          <Link to="/signup" className="btn-primary">Sign up</Link>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 pb-20 pt-10 text-center lg:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-brand-50 via-violet-50 to-white" />
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
          Assessments students <span className="text-brand-500">love</span> to take
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Create engaging quizzes in seconds with AI, run them live or as homework and see exactly where every student needs help.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/signup" className="btn-primary px-6 py-3 text-base">Get started — it&apos;s free</Link>
          <form
            onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/join/${code.replace(/\s/g, '')}`); }}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-1.5 pl-4"
          >
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter a join code" className="w-40 text-base font-semibold outline-none" inputMode="numeric" />
            <button className="btn-violet">Join</button>
          </form>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
          {['Earth', 'Mars', 'Jupiter', 'Venus'].map((t, i) => (
            <div key={t} className={`opt-${i} flex h-28 items-center justify-center rounded-2xl font-game text-xl font-bold text-white shadow-lg animate-rise`} style={{ animationDelay: `${i * 80}ms` }}>{t}</div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-6">
            <f.icon className="mb-3 h-7 w-7 text-brand-500" />
            <h3 className="font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">Wayground clone — built for learning purposes.</footer>
    </div>
  );
}
