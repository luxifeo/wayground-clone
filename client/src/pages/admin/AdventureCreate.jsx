import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, CircleCheck, ListChecks, Map as MapIcon, Settings2, Eye, Users, CalendarClock,
  Clock, TriangleAlert, Pencil, Shapes,
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout.jsx';
import Scene from '../../components/adventure/Scene.jsx';
import WorldPicker from '../../components/adventure/WorldPicker.jsx';
import { AGES, DEFAULT_ADVENTURE, DIFFICULTY, HEROES, worldById } from '../../components/adventure/data.js';
import { get, post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { DEFAULT_SETTINGS, QTYPES } from '../../lib/constants.js';
import { QuizThumb, Spinner, useToast } from '../../components/ui.jsx';
import { gradeLabel, subjectLabel } from '../../i18n/index.js';

const STEPS = ['questions', 'world', 'review'];
const COUNTS = [10, 20, 50];
const CHOICE = ['mcq', 'msq', 'tf', 'poll'];
const AGE_EMOJI = { '4-5': '🧸', '6-7': '🎒', '8-10': '🧭' };
const DIFF_EMOJI = { easy: '🌱', medium: '⭐', hard: '🔥' };
const ATTEMPTS = [1, 2, 3, 0]; // 0 = unlimited

const pad = (n) => String(n).padStart(2, '0');
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dash = (age) => age.replace('-', '–');
/** ≈ 0.5–0.8 minutes per question. */
const playMinutes = (n) => { const min = Math.max(1, Math.round(n * 0.5)); return { min, max: Math.max(min + 1, Math.round(n * 0.8)) }; };

const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-5 py-3 font-bold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60';
const btnBack = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-100';

function Stepper({ step, maxStep, onGo, t }) {
  return (
    <nav aria-label={t('steps.aria')} className="mt-6 border-b border-slate-200">
      <ol className="flex gap-2 sm:gap-6">
        {STEPS.map((k, i) => {
          const active = i === step; const done = !active && i < maxStep; const can = i <= maxStep;
          return (
            <li key={k} className={active ? 'min-w-0 flex-1 sm:flex-none' : 'shrink-0'}>
              <button
                type="button" disabled={!can} onClick={() => onGo(i)} aria-current={active ? 'step' : undefined}
                className={`-mb-px flex w-full items-center gap-2 border-b-[3px] px-1 pb-3 pt-1 text-sm font-semibold transition sm:px-2 ${active ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500'} ${can && !active ? 'hover:text-slate-800' : ''} disabled:cursor-not-allowed`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition ${active ? 'bg-violet-600 text-white shadow-sm' : done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={`truncate ${active ? '' : 'hidden sm:inline'}`}>{t(`steps.${k}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SectionHead({ icon: Icon, title, sub }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      {Icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Icon className="h-4 w-4" /></span>}
      <div className="min-w-0"><h2 className="font-game text-lg font-bold leading-8 text-slate-900">{title}</h2>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div>
    </div>
  );
}

/** Violet pill choice used for counts, difficulty and attempts. */
function Pills({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)} type="button" onClick={() => onChange(o.value)} aria-pressed={on}
            className={`rounded-xl border-2 px-4 py-2 text-sm font-bold transition ${on ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50/50'}`}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

function WorldThumb({ world, className = '', hero, width = 900 }) {
  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`}>
      <Scene world={world} width={width} />
      {hero && <span className="absolute bottom-[12%] left-[14%] text-4xl drop-shadow-lg">{hero}</span>}
      {hero && <span className="absolute bottom-[16%] right-[12%] text-3xl drop-shadow-md">{world.boss}</span>}
    </div>
  );
}

function QuestionRow({ q, i, t }) {
  const text = (q.text || '').replace(/\[\[[^\]]+\]\]/g, '_____').trim();
  const T = QTYPES[q.type] || QTYPES.mcq;
  const choice = CHOICE.includes(q.type) && q.options?.length > 0;
  const optText = (o) => (q.type === 'tf' && ['true', 'false'].includes(o.id) ? t(`common:tf.${o.id}`) : o.text);
  return (
    <li className="flex gap-3 px-4 py-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{i + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-3 break-words font-semibold text-slate-800">{text || <span className="font-normal italic text-slate-400">{t('questions.noText')}</span>}</div>
        {choice ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {q.options.map((o) => {
              const ok = q.type !== 'poll' && (q.answer || []).includes(o.id);
              return (
                <span key={o.id} className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                  {ok && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
                  {o.image && <img src={o.image} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />}
                  <span className="truncate">{optText(o) || '—'}</span>
                </span>
              );
            })}
          </div>
        ) : (
          <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${T.bg} ${T.color}`}><T.icon className="h-3.5 w-3.5" />{T.label}</span>
        )}
      </div>
    </li>
  );
}

export default function AdventureCreate() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useTranslation('adventureCreate');
  const topRef = useRef(null);
  const [quiz, setQuiz] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [title, setTitle] = useState('');
  const [adv, setAdv] = useState({ ...DEFAULT_ADVENTURE });
  const [runs, setRuns] = useState(''); // '' = auto
  const [attempts, setAttempts] = useState(1);
  const [share, setShare] = useState('assign');
  const [deadline, setDeadline] = useState(localInput(new Date(Date.now() + 7 * 86400000)));
  const [showList, setShowList] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [picker, setPicker] = useState(false);
  const [hero, setHero] = useState(0);
  const [busy, setBusy] = useState(null); // 'create' | 'preview'
  const upd = (patch) => setAdv((a) => ({ ...a, ...patch }));
  const closePicker = useCallback(() => setPicker(false), []);
  const chooseWorld = useCallback((world) => { setAdv((a) => ({ ...a, world })); setPicker(false); }, []);

  useEffect(() => {
    get(`/quizzes/${id}`)
      .then((d) => { setQuiz(d.quiz); setIsOwner(!!d.isOwner); setTitle(d.quiz.title || ''); })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <AdminLayout compact>
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <TriangleAlert className="mx-auto h-10 w-10 text-amber-500" />
            <div className="mt-3 font-game text-xl font-bold">{t('notFound')}</div>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <Link to="/admin/library" className={`${btnSecondary} mt-5`}>{t('toLibrary')}</Link>
          </div>
        </div>
      </AdminLayout>
    );
  }
  if (!quiz) return <AdminLayout compact><div className="grid h-full place-items-center"><Spinner className="h-8 w-8 text-slate-400" /></div></AdminLayout>;

  const qs = quiz.questions || [];
  const total = qs.length;
  const counts = [...COUNTS.filter((n) => n < total).map((n) => ({ value: n, label: String(n) })), { value: 0, label: `${t('questions.all')} (${total})` }];
  const playN = adv.count && adv.count < total ? adv.count : total;
  const minutes = t('minutes', playMinutes(playN));
  const questionsN = t('common:count.questions', { count: playN });
  const autoRuns = Math.floor(playN / 5);
  const world = worldById(adv.world);
  const worldName = t(`adventure:worlds.${world.id}.name`);
  const heroEmoji = HEROES[hero % HEROES.length].emoji;
  const rules = t(`adventure:ages.${adv.age}.rules`, { returnObjects: true });
  const ageLabel = t(`adventure:ages.${adv.age}.label`);
  const shownTitle = title.trim() || quiz.title || t('preview.untitled');

  const go = (n) => {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const body = (kind) => ({
    quizId: quiz.id, kind, pace: 'student', gameType: 'adventure',
    title: title.trim() || quiz.title,
    deadline: kind === 'homework' && deadline ? new Date(deadline).toISOString() : undefined,
    settings: {
      ...DEFAULT_SETTINGS, scoring: 'perQuestion', attempts,
      adventure: {
        world: adv.world, age: adv.age, difficulty: adv.difficulty, count: adv.count || 0,
        runs: runs === '' ? null : Math.min(50, Math.max(0, parseInt(runs, 10) || 0)),
      },
    },
  });

  const generate = async () => {
    const kind = share === 'assign' ? 'homework' : 'live';
    if (kind === 'homework' && deadline && new Date(deadline) <= new Date()) { toast(t('review.pastDeadline'), 'error'); return; }
    setBusy('create');
    try {
      const { session } = await post('/sessions', body(kind));
      nav(kind === 'homework' ? `/admin/reports/${session.id}?assigned=1` : `/host/${session.id}`);
    } catch (e) { toast(e.message, 'error'); setBusy(null); }
  };

  const tryIt = async () => {
    const w = window.open('', '_blank'); // open synchronously so popup blockers allow it
    setBusy('preview');
    try {
      const { session } = await post('/sessions', body('preview'));
      const d = await post(`/join/${session.code}`, { name: user?.name || t('quiz:preview.teacherName'), avatar: '🧑‍🏫' });
      if (w) w.location.href = `/play/${d.token}`;
      else window.open(`/play/${d.token}`, '_blank');
    } catch (e) { w?.close(); toast(e.message, 'error'); } finally { setBusy(null); }
  };

  return (
    <AdminLayout compact>
      <div className="min-h-full bg-gradient-to-b from-violet-50 via-white to-white">
        <div ref={topRef} className="mx-auto w-full max-w-6xl scroll-mt-4 px-4 py-6 sm:px-6 sm:py-8">
          <Link to={`/admin/quiz/${quiz.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-violet-700"><ArrowLeft className="h-4 w-4" />{t('backToQuiz')}</Link>

          <header className="mt-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">{t('eyebrow')}</div>
            <h1 className="mt-2 font-game text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">{t('title')}</h1>
            <p className="mt-2 max-w-2xl text-slate-600">{t('subtitle')}</p>
          </header>

          <Stepper step={step} maxStep={maxStep} onGo={go} t={t} />

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-3xl bg-white p-4 shadow-[0_10px_40px_-14px_rgba(76,29,149,.22)] ring-1 ring-slate-100 sm:p-8">
              {step === 0 && (
                <section className="animate-rise">
                  <SectionHead icon={ListChecks} title={t('questions.fromQuiz')} />
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                    <QuizThumb quiz={quiz} size={52} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{quiz.title}</div>
                      <div className="truncate text-xs text-slate-500">{[subjectLabel(quiz.subject), gradeLabel(quiz.grade), t('common:count.questions', { count: total })].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>

                  {total > 0 ? (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                      <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <div><div className="font-bold">{t('questions.ready', { questions: t('common:count.questions', { count: total }) })}</div><div className="text-sm text-emerald-700">{t('questions.readyDesc')}</div></div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1 text-sm">{t('questions.empty')}</div>
                      {isOwner && <Link to={`/admin/quiz/${quiz.id}/edit`} className="btn-outline"><Pencil className="h-4 w-4" />{t('questions.editQuiz')}</Link>}
                    </div>
                  )}

                  {total > 0 && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                      <button type="button" onClick={() => setShowList((v) => !v)} aria-expanded={showList} className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-slate-50">
                        <span className="min-w-0 flex-1 text-sm"><span className="font-bold text-slate-800">{t('questions.found')}</span><span className="text-slate-500"> — {t('questions.foundSub')}</span></span>
                        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${showList ? 'rotate-180' : ''}`} />
                      </button>
                      {showList && (
                        <ol className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto border-t border-slate-100 scrollbar-thin">
                          {qs.map((q, i) => <QuestionRow key={q.id ?? i} q={q} i={i} t={t} />)}
                        </ol>
                      )}
                    </div>
                  )}

                  {total > 0 && (
                    <div className="mt-6">
                      <div className="label">{t('questions.count')}</div>
                      <Pills value={adv.count && adv.count < total ? adv.count : 0} onChange={(v) => upd({ count: v })} options={counts} />
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><Clock className="h-4 w-4 shrink-0" />{t('questions.plays', { time: minutes })}</p>
                      {playN < total && <p className="mt-1 text-xs text-slate-400">{t('questions.random', { questions: questionsN })}</p>}
                    </div>
                  )}

                  <div className="mt-8 flex justify-end border-t border-slate-100 pt-5">
                    <button type="button" disabled={!total} onClick={() => go(1)} className={`${btnPrimary} w-full sm:w-auto`}>{t('questions.next')}<ArrowRight className="h-4 w-4" /></button>
                  </div>
                </section>
              )}

              {step === 1 && (
                <section className="animate-rise space-y-6">
                  <div>
                    <label htmlFor="adv-title" className="label">{t('world.gameTitle')}</label>
                    <input id="adv-title" className="input rounded-xl py-2.5 text-base" maxLength={150} value={title} placeholder={t('world.gameTitlePlaceholder')} onChange={(e) => setTitle(e.target.value)} />
                  </div>

                  <div>
                    <div className="label">{t('world.age')}</div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {Object.keys(AGES).map((a) => {
                        const on = adv.age === a;
                        return (
                          <button
                            key={a} type="button" onClick={() => upd({ age: a })} aria-pressed={on}
                            className={`rounded-2xl border-2 px-1.5 py-3 text-center transition sm:px-4 sm:py-4 ${on ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'}`}
                          >
                            <div className="text-2xl" aria-hidden="true">{AGE_EMOJI[a]}</div>
                            <div className={`mt-1 font-game text-xl font-bold leading-none sm:text-2xl ${on ? 'text-violet-700' : 'text-slate-800'}`}>{dash(a)}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{t('world.years')}</div>
                            <div className={`mt-1.5 text-xs font-semibold leading-tight sm:text-sm ${on ? 'text-violet-700' : 'text-slate-600'}`}>{t(`adventure:ages.${a}.label`)}</div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 rounded-2xl bg-violet-50 p-4">
                      <div className="text-sm font-bold text-violet-900">{t('world.changes')}</div>
                      <ul className="mt-2 space-y-1.5">
                        {(Array.isArray(rules) ? rules : []).map((r) => <li key={r} className="flex gap-2 text-sm text-slate-700"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{r}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <div className="label">{t('world.world')}</div>
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <WorldThumb world={world} className="h-16 w-24 rounded-xl sm:h-20 sm:w-32" />
                        <div className="min-w-0">
                          <div className="font-game text-lg font-bold leading-tight text-slate-900">{worldName}</div>
                          <div className="mt-0.5 text-sm text-slate-500">{t('world.bossMini', { boss: `${world.boss} ${t(`adventure:worlds.${world.id}.boss`)}`, mini: `${world.mini} ${t(`adventure:worlds.${world.id}.mini`)}` })}</div>
                        </div>
                      </div>
                      <button type="button" onClick={() => setPicker(true)} className={`${btnSecondary} py-2.5 text-sm`}><Shapes className="h-4 w-4" />{t('world.change')}</button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <button type="button" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
                      <Settings2 className="h-5 w-5 shrink-0 text-violet-600" />
                      <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-800">{t('world.advanced')}</span><span className="block text-xs text-slate-500">{t('world.advancedSub')}</span></span>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${advanced ? 'rotate-180' : ''}`} />
                    </button>
                    {advanced && (
                      <div className="space-y-5 border-t border-slate-100 px-4 py-4">
                        <div>
                          <div className="label">{t('world.difficulty')}</div>
                          <Pills value={adv.difficulty} onChange={(v) => upd({ difficulty: v })} options={Object.keys(DIFFICULTY).map((d) => ({ value: d, label: `${DIFF_EMOJI[d]} ${t(`adventure:difficulty.${d}.label`)}` }))} />
                          <p className="mt-2 text-sm text-slate-500">{t(`adventure:difficulty.${adv.difficulty}.desc`)}</p>
                        </div>
                        <div>
                          <label htmlFor="adv-runs" className="label">{t('world.runs')}</label>
                          <input id="adv-runs" type="number" inputMode="numeric" min={0} max={50} className="input w-44 rounded-xl" value={runs} placeholder={t('world.runsAuto', { n: autoRuns })} onChange={(e) => setRuns(e.target.value)} />
                          <p className="mt-1.5 text-xs text-slate-500">{t('world.runsHelp')}</p>
                        </div>
                        <div>
                          <div className="label">{t('world.attempts')}</div>
                          <Pills value={attempts} onChange={setAttempts} options={ATTEMPTS.map((n) => ({ value: n, label: n ? String(n) : t('world.unlimited') }))} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
                    <button type="button" onClick={() => go(0)} className={btnBack}><ArrowLeft className="h-4 w-4" />{t('back')}</button>
                    <button type="button" onClick={() => go(2)} className={btnPrimary}>{t('world.next')}<ArrowRight className="h-4 w-4" /></button>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section className="animate-rise space-y-6">
                  <div className="overflow-hidden rounded-3xl border border-slate-200">
                    <div className="flex flex-col sm:flex-row">
                      <WorldThumb world={world} hero={heroEmoji} width={1600} className="aspect-video sm:aspect-auto sm:min-h-[9.5rem] sm:w-60" />
                      <div className="min-w-0 flex-1 p-4 sm:p-5">
                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">{worldName}</div>
                        <div className="mt-1 break-words font-game text-2xl font-bold leading-tight text-slate-900">{shownTitle}</div>
                        <div className="mt-1.5 text-sm text-slate-500">{questionsN} · {minutes}</div>
                      </div>
                    </div>
                  </div>

                  <dl className="grid gap-3 sm:grid-cols-3">
                    {[
                      [t('review.age'), t('review.ageValue', { age: dash(adv.age), label: ageLabel })],
                      [t('review.difficulty'), `${DIFF_EMOJI[adv.difficulty]} ${t(`adventure:difficulty.${adv.difficulty}.label`)}`],
                      [t('review.attempts'), attempts ? String(attempts) : t('world.unlimited')],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
                        <dd className="mt-0.5 font-semibold text-slate-800">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <fieldset>
                    <legend className="label">{t('review.share')}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['assign', CalendarClock, t('review.assign'), t('review.assignDesc')],
                        ['live', Users, t('review.live'), t('review.liveDesc')],
                      ].map(([k, I, label, desc]) => {
                        const on = share === k;
                        return (
                          <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${on ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-violet-200 hover:bg-violet-50/40'}`}>
                            <input type="radio" name="adv-share" value={k} checked={on} onChange={() => setShare(k)} className="mt-1 h-4 w-4 shrink-0 accent-violet-600" />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 font-bold text-slate-900"><I className={`h-4 w-4 ${on ? 'text-violet-600' : 'text-slate-400'}`} />{label}</span>
                              <span className="mt-0.5 block text-sm text-slate-500">{desc}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {share === 'assign' && (
                      <div className="mt-3 animate-rise">
                        <label htmlFor="adv-deadline" className="label">{t('review.deadline')}</label>
                        <input id="adv-deadline" type="datetime-local" className="input rounded-xl sm:w-72" min={localInput(new Date())} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                      </div>
                    )}
                  </fieldset>

                  <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                    <button type="button" onClick={() => go(1)} className={btnBack}><ArrowLeft className="h-4 w-4" />{t('back')}</button>
                    <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
                      <button type="button" onClick={tryIt} disabled={!!busy} className={btnSecondary}>{busy === 'preview' ? <Spinner className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{t('review.try')}</button>
                      <button type="button" onClick={generate} disabled={!!busy} className={btnPrimary}>{busy === 'create' ? <Spinner className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}{t('review.generate')} ✨</button>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-6">
              <div className="overflow-hidden rounded-3xl bg-white shadow-[0_10px_40px_-14px_rgba(76,29,149,.22)] ring-1 ring-slate-100">
                <div className="flex items-center gap-2 px-5 pt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                  {t('preview.label')}
                </div>
                <div className="p-3">
                  <div className="relative aspect-video overflow-hidden rounded-2xl">
                    <Scene world={world} width={1600} />
                    <button type="button" onClick={() => setHero((h) => h + 1)} title={t('preview.heroHint')} className="absolute bottom-[10%] left-[14%] text-5xl drop-shadow-lg animate-float">{heroEmoji}</button>
                    <span className="absolute bottom-[16%] right-[12%] text-4xl drop-shadow-md" aria-hidden="true">{world.boss}</span>
                    <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm backdrop-blur">{AGE_EMOJI[adv.age]} {dash(adv.age)} · {ageLabel}</span>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <div className="break-words font-game text-xl font-bold leading-tight text-slate-900">{shownTitle}</div>
                  <div className="mt-1 text-sm text-slate-500">{worldName} · {questionsN}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{DIFF_EMOJI[adv.difficulty]} {t(`adventure:difficulty.${adv.difficulty}.label`)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><Clock className="h-3 w-3" />{minutes}</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">{t('preview.heroHint')}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <WorldPicker open={picker} value={adv.world} onClose={closePicker} onSelect={chooseWorld} />
    </AdminLayout>
  );
}
