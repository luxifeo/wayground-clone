import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Clock, Flame, RotateCcw, Trophy, ChevronDown, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api.js';
import { Avatar, Spinner } from '../../components/ui.jsx';
import { QuestionBody } from '../../components/QuestionCard.jsx';
import { FormatAnswer } from '../../lib/formatAnswer.jsx';
import LanguageSwitcher from '../../components/LanguageSwitcher.jsx';

const STATUS = {
  correct: ['bg-emerald-500', 'common:result.correct'], incorrect: ['bg-red-500', 'common:result.incorrect'], partial: ['bg-amber-400', 'summary.partial'],
  ungraded: ['bg-blue-500', 'summary.submitted'], skipped: ['bg-slate-400', 'common:result.skipped'],
};

export default function Summary({ token, onAgain }) {
  const { t } = useTranslation('play');
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`/play/${token}/summary`).then(setD).catch(() => {});
    const iv = setInterval(() => api(`/play/${token}/summary`).then(setD).catch(() => {}), 8000);
    return () => clearInterval(iv);
  }, [token]);
  if (!d) return <div className="grid min-h-full place-items-center game-bg"><Spinner className="h-10 w-10 text-white" /></div>;
  const { stats } = d;
  const again = async () => {
    setBusy(true);
    try {
      const r = await api(`/play/${token}/again`, { method: 'POST', body: {} });
      localStorage.setItem(`wg_play_${d.session.code}`, JSON.stringify({ token: r.token, name: d.participant.name }));
      onAgain(r.token);
    } catch { setBusy(false); }
  };
  const praise = t(stats.accuracy === null ? 'summary.praiseThanks' : stats.accuracy >= 90 ? 'summary.praiseGreat' : stats.accuracy >= 60 ? 'summary.praiseGood' : 'summary.praiseTry');

  return (
    <div className="min-h-full game-bg px-4 pb-12 pt-6">
      <div className="mx-auto mb-3 flex max-w-5xl justify-end"><LanguageSwitcher dark /></div>
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="game-panel flex items-center gap-4 p-5 text-white">
            <div className="flex-1">
              <div className="font-game text-xl font-bold">{d.session.title}</div>
              <div className="mt-1 flex items-center gap-1 text-sm">🎉 {praise}</div>
              <div className="mt-4 flex items-end gap-6">
                {d.session.settings.leaderboard && <div><div className="font-game text-4xl font-bold">{d.rank}<span className="text-lg text-white/60">/{d.players}</span></div><div className="text-xs text-white/60">{t('summary.rank')}</div></div>}
                <div><div className="font-game text-4xl font-bold">{d.participant.score}</div><div className="text-xs text-white/60">{t('summary.score')}</div></div>
                {d.participant.attempt > 1 && <div><div className="font-game text-4xl font-bold">{d.participant.attempt}</div><div className="text-xs text-white/60">{t('summary.attempt')}</div></div>}
              </div>
            </div>
            <div className="animate-float"><Avatar avatar={d.participant.avatar} name={d.participant.name} size={96} /></div>
          </div>

          <div className="game-panel p-5 text-white">
            <div className="mb-2 font-semibold">{t('summary.accuracy')}</div>
            <div className="relative h-4 rounded-full bg-white/15">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${stats.accuracy ?? 0}%` }} />
              <span className="absolute -top-1.5 rounded-full bg-white px-2 text-xs font-bold text-slate-800" style={{ left: `calc(${Math.min(88, stats.accuracy ?? 0)}%)` }}>{stats.accuracy ?? '–'}%</span>
            </div>
          </div>

          <div className="game-panel p-5 text-white">
            <div className="mb-3 flex justify-between font-semibold">{t('summary.performance')} <span className="text-sm text-white/60">{t('common:count.questions', { count: d.session.total })}</span></div>
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-emerald-300"><Check className="h-4 w-4" />{t('summary.statCorrect', { n: stats.correct })}</span>
              <span className="flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-1 text-red-300"><X className="h-4 w-4" />{t('summary.statIncorrect', { n: stats.incorrect })}</span>
              {stats.partial > 0 && <span className="rounded-md bg-amber-500/20 px-2 py-1 text-amber-300">{t('summary.statPartial', { n: stats.partial })}</span>}
              {stats.ungraded > 0 && <span className="rounded-md bg-blue-500/20 px-2 py-1 text-blue-300">{t('summary.statUngraded', { n: stats.ungraded })}</span>}
              <span className="flex items-center gap-1 rounded-md bg-sky-500/20 px-2 py-1 text-sky-300"><Clock className="h-4 w-4" />{t('summary.avgTime', { n: stats.avgTime })}</span>
              <span className="flex items-center gap-1 rounded-md bg-orange-500/20 px-2 py-1 text-orange-300"><Flame className="h-4 w-4" />{t('summary.streak', { n: d.participant.maxStreak })}</span>
            </div>
          </div>

          {d.review.length > 0 && (
            <div className="game-panel p-5 text-white">
              <div className="mb-1 font-semibold">{t('summary.review')}</div>
              <div className="mb-3 text-xs text-white/60">{t(d.review[0].revealed ? 'summary.clickAnswers' : 'summary.clickResponses')}</div>
              <div className="space-y-2">
                {d.review.map((r, i) => {
                  const [color, label] = STATUS[r.status] || STATUS.skipped;
                  const isOpen = open === i;
                  return (
                    <div key={r.question.id} className="overflow-hidden rounded-xl bg-white text-slate-800">
                      <button onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center gap-3 border-l-8 px-4 py-3 text-left" style={{ borderColor: 'transparent' }}>
                        <span className={`h-full w-1.5 self-stretch rounded ${color}`} />
                        <span className="flex-1 font-semibold">{i + 1}. {r.question.text.replace(/\[\[[^\]]+\]\]/g, '____') || t('summary.question')}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-bold text-white ${color}`}>{t(label)}{r.score > 0 && ` +${r.score}`}</span>
                        <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm">
                          <div><span className="font-semibold text-slate-500">{t('summary.yourAnswer')}</span><FormatAnswer q={r.question} answer={r.answer} /></div>
                          {r.feedback && <div className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800">💬 {r.feedback}</div>}
                          {r.revealed && <div className="rounded-lg bg-slate-50 p-3"><QuestionBody q={r.question} /></div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {d.canPlayAgain && <button onClick={again} disabled={busy} className="game-btn flex w-full items-center justify-center gap-2 bg-white py-4 text-lg text-violet-800">{busy ? <Spinner className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}{t('summary.playAgain')}</button>}
          <Link to="/join" className="game-btn flex w-full items-center justify-center gap-2 bg-violet-500 py-3 text-white"><Home className="h-5 w-5" />{t('summary.joinAnother')}</Link>
          {d.leaderboard.length > 0 && (
            <div className="game-panel p-4 text-white">
              <div className="mb-3 flex items-center gap-2 font-game font-bold"><Trophy className="h-5 w-5 text-yellow-300" />{t('summary.leaderboard')}</div>
              {d.leaderboard.map((p, i) => (
                <div key={p.id} className={`mb-1.5 flex items-center gap-2 rounded-lg px-3 py-2 ${p.id === d.participant.id ? 'bg-white/25' : 'bg-white/5'}`}>
                  <span className="w-5 text-sm font-bold">{i + 1}</span><Avatar avatar={p.avatar} name={p.name} size={26} />
                  <span className="flex-1 truncate text-sm font-semibold">{p.name}</span><span className="text-sm font-bold text-yellow-300">{p.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
