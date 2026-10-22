import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, BookOpenText, Check, ChevronDown, ClipboardPaste, Crop, GraduationCap, Image as ImageIcon, Languages,
  Lightbulb, ListChecks, PenLine, Play, Pencil, Plus, RotateCcw, Save, ScanSearch, ScanText, Settings2, SlidersHorizontal,
  Timer, TriangleAlert, Upload, Wand2, X, CircleMinus,
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout.jsx';
import { ZoomImage } from '../../components/Passage.jsx';
import { Segmented, Select, Spinner, Toggle, useToast } from '../../components/ui.jsx';
import { api, get } from '../../lib/api.js';
import { GRADES, LANGUAGES, QTYPES, SUBJECTS, rid } from '../../lib/constants.js';
import { gradeLabel, languageLabel, subjectLabel } from '../../i18n/index.js';
import { openPreview } from './QuizEditor.jsx';

const FALLBACK_CONFIG = { cropRounds: 3, maxCropRounds: 5, maxFiles: 6 };
const MAX_MB = 15;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MODES = [['auto', Wand2], ['worksheet', ScanText], ['photo', ImageIcon]];
const GENRES = ['nonfiction', 'fiction', 'poem', 'dialogue', 'news', 'letter'];
const PARAGRAPHS = [3, 4, 5, 6, 7];
const QUESTION_COUNTS = Array.from({ length: 13 }, (_, i) => i + 3); // 3–15
const TYPES = ['mcq', 'msq', 'tf', 'fill', 'dropdown', 'dragdrop', 'reorder', 'match', 'open'];
const STEPS = [['upload', Upload], ['detect', ScanSearch], ['crop', Crop], ['write', PenLine], ['questions', ListChecks], ['save', Save]];
const POLL_MS = 1500;
const MAX_POLL_FAILS = 5;

const DEFAULT_OPTS = {
  mode: 'auto', language: 'English', grade: null, subject: null,
  genre: 'nonfiction', paragraphs: 4, questions: 6, types: ['mcq', 'tf', 'fill'], words: '', crossword: false, topic: '',
  cropRounds: FALLBACK_CONFIG.cropRounds,
};

const int = (v, d) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);
const fmtElapsed = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** One preference: label (+ help) beside its control, or above it when `stack`. */
function Row({ label, help, stack = false, inline = false, children }) {
  const side = inline ? 'flex-row items-center justify-between gap-4' : 'flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4';
  return (
    <div className={`flex py-3 ${stack ? 'flex-col gap-2' : side}`}>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        {help && <div className="text-xs text-slate-500">{help}</div>}
      </div>
      <div className={stack ? '' : inline ? 'shrink-0' : 'sm:w-52 sm:shrink-0'}>{children}</div>
    </div>
  );
}

function Group({ icon: Icon, title, open, onToggle, children }) {
  return (
    <div className="border-t border-slate-200">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 py-3 text-left text-sm font-bold text-slate-800 hover:text-violet-700">
        <Icon className="h-4 w-4 text-violet-600" /><span className="flex-1">{title}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="divide-y divide-slate-200/70 pb-2">{children}</div>}
    </div>
  );
}

function StepRow({ icon: Icon, label, step, t }) {
  const { status, detail } = step;
  const dot = {
    pending: 'bg-slate-100 text-slate-400',
    running: 'bg-violet-100 text-violet-700 ring-4 ring-violet-50',
    done: 'bg-emerald-500 text-white',
    skipped: 'bg-slate-100 text-slate-300',
    error: 'bg-red-500 text-white',
  }[status] || 'bg-slate-100 text-slate-400';
  return (
    <li className="flex gap-3 py-2">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${dot}`}>
        {status === 'running' ? <Spinner className="h-4 w-4" />
          : status === 'done' ? <Check className="h-4 w-4" strokeWidth={3} />
            : status === 'error' ? <X className="h-4 w-4" strokeWidth={3} />
              : status === 'skipped' ? <CircleMinus className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className={`text-sm font-semibold ${status === 'pending' || status === 'skipped' ? 'text-slate-400' : status === 'error' ? 'text-red-700' : 'text-slate-800'}`}>
          {label}{status === 'skipped' && <span className="ml-1.5 text-xs font-normal">· {t('progress.skipped')}</span>}
        </div>
        {detail && status !== 'skipped' && <div className="break-words text-xs text-slate-500">{detail}</div>}
      </div>
    </li>
  );
}

/** A cropped figure with the crop of every review round; the round that became the figure is highlighted. */
function FigureCard({ f, t }) {
  const rounds = f.rounds || [];
  let final = rounds.length - 1;
  for (let i = rounds.length - 1; i >= 0; i -= 1) if (rounds[i].url === f.url) { final = i; break; }
  return (
    <figure className="w-40 shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-card sm:w-48">
      {f.url
        ? <ZoomImage src={f.url} alt={f.what || ''} wrapClassName="w-full" className="h-28 w-full rounded-lg bg-slate-50 object-contain" />
        : <div className="grid h-28 place-items-center rounded-lg bg-slate-50 text-xs text-slate-400"><span className="flex items-center gap-1.5"><Spinner className="h-3.5 w-3.5" />{t('progress.cropping')}</span></div>}
      {f.what && <figcaption className="mt-1.5 line-clamp-2 text-xs font-semibold text-slate-700" title={f.what}>{f.what}</figcaption>}
      {f.page != null && <div className="text-[11px] text-slate-400">{t('progress.page', { n: f.page })}</div>}
      {rounds.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-1.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('progress.rounds', { count: rounds.length })}</div>
          <div className="flex flex-wrap gap-1.5">
            {rounds.map((r, i) => (
              <ZoomImage
                key={i} src={r.url} hint={false}
                title={`${t('progress.round', { n: i + 1 })}${i === final ? ` (${t('progress.final')})` : ''}${r.verdict ? `: ${r.verdict}` : ''}`}
                className={`h-9 w-9 rounded-md bg-slate-50 object-cover ${i === final ? 'ring-2 ring-violet-500 ring-offset-1' : 'opacity-60 ring-1 ring-slate-200 hover:opacity-100'}`}
              />
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}

export default function ReadingCreate() {
  const { id: quizId } = useParams(); // set on /admin/quiz/:id/reading: append to that quiz
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useTranslation('reading');
  const [cfg, setCfg] = useState(FALLBACK_CONFIG);
  const [quiz, setQuiz] = useState(null);
  const [files, setFiles] = useState([]); // { id, file, url }
  const [opts, setOpts] = useState(DEFAULT_OPTS);
  const [photoOpen, setPhotoOpen] = useState(true);
  const [advOpen, setAdvOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState('form'); // form | progress
  const [job, setJob] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [startedAt, setStartedAt] = useState(0);
  const [endedAt, setEndedAt] = useState(0);
  const [now, setNow] = useState(0);
  const inputRef = useRef(null);
  const topRef = useRef(null);
  const urlsRef = useRef([]);
  const pastedRef = useRef(0);
  const set = (patch) => setOpts((o) => ({ ...o, ...patch }));

  useEffect(() => {
    get('/ai/reading/config').then((c) => {
      const maxCropRounds = Math.max(0, int(c?.maxCropRounds, FALLBACK_CONFIG.maxCropRounds));
      const next = {
        maxCropRounds,
        cropRounds: Math.min(maxCropRounds, Math.max(0, int(c?.cropRounds, FALLBACK_CONFIG.cropRounds))),
        maxFiles: Math.max(1, int(c?.maxFiles, FALLBACK_CONFIG.maxFiles)),
      };
      setCfg(next);
      setOpts((o) => ({ ...o, cropRounds: next.cropRounds }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!quizId) return;
    get(`/quizzes/${quizId}`).then(({ quiz: q }) => {
      setQuiz(q);
      setOpts((o) => ({ ...o, language: q.language || o.language, grade: q.grade || o.grade, subject: q.subject || o.subject }));
    }).catch((e) => toast(e.message, 'error'));
  }, [quizId, toast]);

  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const addFiles = (list) => {
    const next = [...files];
    const errors = [];
    for (const f of Array.from(list || [])) {
      if (!ACCEPT.includes(f.type)) errors.push(t('upload.badType', { name: f.name }));
      else if (f.size > MAX_MB * 1024 * 1024) errors.push(t('upload.tooBig', { name: f.name, size: MAX_MB }));
      else if (next.length >= cfg.maxFiles) { errors.push(t('upload.tooMany', { max: cfg.maxFiles })); break; }
      else {
        const url = URL.createObjectURL(f);
        urlsRef.current.push(url);
        next.push({ id: rid(), file: f, url });
      }
    }
    if (next.length !== files.length) setFiles(next);
    if (errors.length) toast([...new Set(errors)].join(' · '), 'error');
  };
  const addRef = useRef(addFiles);
  addRef.current = addFiles;

  const removeFile = (fid) => {
    const f = files.find((x) => x.id === fid);
    if (f) URL.revokeObjectURL(f.url);
    setFiles(files.filter((x) => x.id !== fid));
  };

  // Ctrl+V anywhere on the form adds pasted images (screenshots arrive as "image.png")
  useEffect(() => {
    if (view !== 'form') return undefined;
    const onPaste = (e) => {
      const list = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
      if (!list.length) return;
      // text copied from an office app may carry a picture too: typing into a field keeps the text
      if (e.target?.closest?.('input, textarea') && e.clipboardData.types.includes('text/plain')) return;
      e.preventDefault();
      addRef.current(list.map((f) => {
        pastedRef.current += 1;
        const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        return new File([f], `pasted-${pastedRef.current}.${ext}`, { type: f.type }); // ASCII: safe in multipart
      }));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [view]);

  // poll the job until it ends
  useEffect(() => {
    if (!jobId) return undefined;
    let alive = true;
    let timer;
    let fails = 0;
    const tick = async () => {
      try {
        const j = await get(`/ai/jobs/${jobId}`);
        if (!alive) return;
        fails = 0;
        setJob(j);
        if (j.status === 'done' || j.status === 'error') { setEndedAt(Date.now()); return; }
      } catch (e) {
        if (!alive) return;
        // 4xx (job gone, signed out) is final; network hiccups are retried a few times
        fails += 1;
        if ((e.status >= 400 && e.status < 500) || fails >= MAX_POLL_FAILS) {
          setJob((j) => ({ ...j, status: 'error', error: e.status === 404 ? t('progress.lost') : e.message }));
          setEndedAt(Date.now());
          return;
        }
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [jobId, t]);

  const running = view === 'progress' && job?.status === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const showView = (v) => {
    setView(v);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  const toggleType = (ty) => set({ types: opts.types.includes(ty) ? (opts.types.length > 1 ? opts.types.filter((x) => x !== ty) : opts.types) : [...opts.types, ty] });

  const generate = async () => {
    if (!files.length) return;
    const form = new FormData();
    files.forEach((f) => form.append('files', f.file));
    form.append('mode', opts.mode);
    form.append('language', opts.language);
    if (opts.grade) form.append('grade', opts.grade);
    if (opts.subject) form.append('subject', opts.subject);
    if (opts.mode !== 'worksheet') {
      form.append('genre', opts.genre);
      form.append('paragraphs', String(opts.paragraphs));
      form.append('questions', String(opts.questions));
      form.append('types', opts.types.join(','));
      const words = opts.words.split(/[,;\n]/).map((w) => w.trim()).filter(Boolean);
      if (words.length) form.append('words', words.join(','));
      form.append('crossword', opts.crossword ? 'true' : 'false');
      if (opts.topic.trim()) form.append('topic', opts.topic.trim());
    }
    form.append('cropRounds', String(opts.cropRounds));
    if (quizId) form.append('quizId', quizId);

    const start = Date.now();
    setStartedAt(start); setNow(start); setEndedAt(0); setJobId(null);
    setJob({ status: 'running', kind: null, steps: [{ key: 'upload', status: 'running' }], figures: [], result: null });
    showView('progress');
    try {
      const d = await api('/ai/reading', { method: 'POST', form });
      setJobId(d.jobId);
    } catch (e) {
      setJob((j) => ({ ...j, status: 'error', error: e.message, steps: [{ key: 'upload', status: 'error' }] }));
      setEndedAt(Date.now());
    }
  };

  const backToForm = () => { setJob(null); setJobId(null); showView('form'); };
  const back = () => nav(quizId ? `/admin/quiz/${quizId}/edit` : '/admin');

  const full = files.length >= cfg.maxFiles;
  const elapsed = Math.max(0, Math.round(((endedAt || now) - startedAt) / 1000));

  const form = (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* upload */}
      <div className="p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-bold text-slate-800">{t('upload.heading')}</h2>
          <span className="text-xs font-semibold text-slate-500">{t('upload.count', { n: files.length, max: cfg.maxFiles })}</span>
        </div>
        <div
          role="button" tabIndex={full ? -1 : 0} aria-disabled={full}
          onClick={() => !full && inputRef.current?.click()}
          onKeyDown={(e) => { if (!full && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-violet-300
            ${files.length ? 'py-7' : 'min-h-[260px] py-10 sm:min-h-[340px]'}
            ${dragging ? 'border-violet-500 bg-violet-50' : full ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60' : 'cursor-pointer border-slate-300 bg-slate-50/60 hover:border-violet-400 hover:bg-violet-50/40'}`}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-violet-600 shadow-card"><Upload className="h-6 w-6" /></span>
          <div className="text-sm text-slate-700 sm:text-base">
            {dragging ? t('upload.dropActive') : full ? t('upload.full') : <Trans ns="reading" i18nKey="upload.drop" components={{ b: <b className="text-violet-700 underline underline-offset-2" /> }} />}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><ClipboardPaste className="h-3.5 w-3.5" />{t('upload.paste')}</div>
          <div className="text-xs text-slate-400">{t('upload.formats', { size: MAX_MB, max: cfg.maxFiles })}</div>
        </div>
        <input ref={inputRef} type="file" hidden multiple accept={ACCEPT.join(',')} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

        {files.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((f, i) => (
              <li key={f.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                <ZoomImage src={f.url} alt={f.file.name} wrapClassName="w-full" className="aspect-[3/4] w-full bg-slate-50 object-cover" />
                <span className="pointer-events-none absolute left-1.5 top-1.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-black/60 px-1 text-[10px] font-bold text-white">{i + 1}</span>
                <button type="button" onClick={() => removeFile(f.id)} title={t('upload.remove')} aria-label={t('upload.remove')} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button>
                <div className="truncate border-t border-slate-100 px-2 py-1 text-[11px] text-slate-500" title={f.file.name}>{f.file.name}</div>
              </li>
            ))}
            {!full && (
              <li>
                <button type="button" onClick={() => inputRef.current?.click()} className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-violet-400 hover:text-violet-700">
                  <Plus className="h-5 w-5" />{t('upload.addMore')}
                </button>
              </li>
            )}
          </ul>
        )}

        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><span>{t('upload.tip')}</span>
        </div>
      </div>

      {/* preferences */}
      <aside className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-6 lg:border-l lg:border-t-0">
        <h2 className="mb-1 flex items-center gap-2 font-bold text-slate-800"><SlidersHorizontal className="h-4 w-4 text-violet-600" />{t('prefs.heading')}</h2>
        <div className="divide-y divide-slate-200/70">
          <Row stack label={t('prefs.detect')} help={t(`prefs.modeHelp.${opts.mode}`)}>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/60 p-1" role="radiogroup" aria-label={t('prefs.detect')}>
              {MODES.map(([m, I]) => (
                <button
                  key={m} type="button" role="radio" aria-checked={opts.mode === m} onClick={() => set({ mode: m })}
                  className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-2 text-xs font-semibold transition sm:flex-row sm:gap-1.5 ${opts.mode === m ? 'bg-white text-violet-700 shadow-card' : 'text-slate-600 hover:text-slate-900'}`}
                ><I className="h-4 w-4 shrink-0" /><span className="max-w-full truncate">{t(`prefs.modes.${m}`)}</span></button>
              ))}
            </div>
          </Row>
          <Row label={t('prefs.language')}>
            <Select value={opts.language} onChange={(v) => set({ language: v || 'English' })} options={LANGUAGES.map((v) => ({ value: v, label: languageLabel(v) }))} icon={Languages} />
          </Row>
          <Row label={t('prefs.grade')}>
            <Select value={opts.grade} onChange={(v) => set({ grade: v })} options={GRADES.map((v) => ({ value: v, label: gradeLabel(v) }))} placeholder={t('prefs.any')} icon={GraduationCap} />
          </Row>
          <Row label={t('prefs.subject')} help={t('prefs.optional')}>
            <Select value={opts.subject} onChange={(v) => set({ subject: v })} options={SUBJECTS.map((v) => ({ value: v, label: subjectLabel(v) }))} placeholder={t('prefs.any')} icon={BookOpen} />
          </Row>
        </div>

        {opts.mode !== 'worksheet' && (
          <Group icon={ImageIcon} title={t('prefs.photoGroup')} open={photoOpen} onToggle={() => setPhotoOpen((v) => !v)}>
            <Row label={t('prefs.genre')}>
              <Select value={opts.genre} onChange={(v) => set({ genre: v || 'nonfiction' })} options={GENRES.map((g) => ({ value: g, label: t(`prefs.genres.${g}`) }))} />
            </Row>
            <Row stack label={t('prefs.paragraphs')}>
              <Segmented value={opts.paragraphs} onChange={(v) => set({ paragraphs: v })} options={PARAGRAPHS.map((n) => ({ value: n, label: String(n) }))} />
            </Row>
            <Row label={t('prefs.questions')}>
              <Select value={String(opts.questions)} onChange={(v) => set({ questions: int(v, 6) })} options={QUESTION_COUNTS.map((n) => ({ value: String(n), label: String(n) }))} icon={ListChecks} />
            </Row>
            <Row stack label={t('prefs.types')}>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((ty) => {
                  const T = QTYPES[ty];
                  const on = opts.types.includes(ty);
                  return (
                    <button key={ty} type="button" aria-pressed={on} onClick={() => toggleType(ty)} className={`chip ${on ? 'border-violet-450 bg-violet-50 text-violet-700' : ''}`}>
                      <T.icon className="h-3.5 w-3.5" />{T.label}
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row stack label={t('prefs.words')} help={t('prefs.wordsHelp')}>
              <input className="input" value={opts.words} onChange={(e) => set({ words: e.target.value })} placeholder={t('prefs.wordsPlaceholder')} />
            </Row>
            <Row inline label={t('prefs.crossword')} help={t('prefs.crosswordHelp')}>
              <Toggle checked={opts.crossword} onChange={(v) => set({ crossword: v })} />
            </Row>
            <Row stack label={t('prefs.topic')} help={t('prefs.optional')}>
              <textarea className="input min-h-[76px] resize-y" value={opts.topic} onChange={(e) => set({ topic: e.target.value })} placeholder={t('prefs.topicPlaceholder')} />
            </Row>
          </Group>
        )}

        {opts.mode !== 'photo' && (
          <Group icon={Settings2} title={t('prefs.advanced')} open={advOpen} onToggle={() => setAdvOpen((v) => !v)}>
            <Row stack label={t('prefs.cropRounds')} help={t('prefs.cropRoundsHelp')}>
              <Segmented
                value={opts.cropRounds} onChange={(v) => set({ cropRounds: v })}
                options={Array.from({ length: cfg.maxCropRounds + 1 }, (_, n) => ({ value: n, label: n === 0 ? t('prefs.off') : String(n) }))}
              />
            </Row>
          </Group>
        )}

        <button type="button" className="btn-primary mt-5 w-full py-3 text-base" disabled={!files.length} onClick={generate}>{t('generate')}</button>
        {!files.length && <p className="mt-2 text-center text-xs text-slate-500">{t('needFiles')}</p>}
      </aside>
    </div>
  );

  const stepOf = (key) => job?.steps?.find((s) => s.key === key) || { key, status: 'pending' };
  const figures = job?.figures || [];
  const cropStep = stepOf('crop');
  const status = job?.status;
  const showFigures = job && opts.mode !== 'photo' && job.kind !== 'photo' && cropStep.status !== 'skipped'
    && (figures.length > 0 || status === 'running' || cropStep.status === 'done');
  const result = job?.result;

  const progress = job && (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${status === 'done' ? 'bg-emerald-500 text-white' : status === 'error' ? 'bg-red-500 text-white' : 'bg-gradient-to-br from-violet-500 to-brand-500 text-white'}`}>
          {status === 'done' ? <Check className="h-6 w-6" strokeWidth={3} /> : status === 'error' ? <TriangleAlert className="h-5 w-5" /> : <Spinner className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900">{t(`progress.${status === 'done' ? 'done' : status === 'error' ? 'failed' : 'running'}`)}</div>
          <div className="text-xs text-slate-500">
            {t('progress.images', { count: files.length })}
            {job.kind && <> · <span className="font-semibold text-violet-700">{t(`progress.kind.${job.kind}`)}</span></>}
          </div>
        </div>
        <span title={t('progress.elapsed')} className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold tabular-nums text-slate-700">
          <Timer className="h-4 w-4" />{fmtElapsed(elapsed)}
        </span>
      </div>

      {status === 'done' && result && (
        <div className="mx-4 mt-5 flex flex-col items-center gap-4 rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200 sm:mx-6 sm:flex-row sm:text-left">
          <span className="text-4xl">🎉</span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold text-emerald-900">{t('success.created', { count: result.added ?? 0 })}</div>
            {result.title && <div className="truncate text-sm text-emerald-800">{result.title}</div>}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-outline" onClick={() => openPreview(result.quizId).catch((e) => toast(e.message, 'error'))}><Play className="h-4 w-4" />{t('success.preview')}</button>
            <Link to={`/admin/quiz/${result.quizId}/edit`} className="btn-primary"><Pencil className="h-4 w-4" />{t('success.open')}</Link>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="mx-4 mt-5 flex flex-col gap-3 rounded-2xl bg-red-50 p-5 ring-1 ring-red-200 sm:mx-6 sm:flex-row sm:items-center">
          <TriangleAlert className="h-6 w-6 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1 break-words text-sm text-red-800">{job.error || t('progress.failed')}</div>
          <button type="button" className="btn-outline shrink-0" onClick={backToForm}><RotateCcw className="h-4 w-4" />{t('common:actions.retry')}</button>
        </div>
      )}

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ol className="divide-y divide-slate-100">
          {STEPS.map(([key, icon]) => <StepRow key={key} icon={icon} label={t(`progress.steps.${key}`)} step={stepOf(key)} t={t} />)}
        </ol>
        <div className="min-w-0 space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">{t('progress.yourImages')}</h3>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {files.map((f) => <ZoomImage key={f.id} src={f.url} alt={f.file.name} hint={false} title={f.file.name} className="h-16 w-12 shrink-0 rounded-lg border border-slate-200 object-cover" />)}
            </div>
          </section>
          {showFigures && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <Crop className="h-4 w-4 text-violet-600" />{t('progress.figures')}
                {figures.length > 0 && <span className="rounded-full bg-violet-100 px-2 text-xs text-violet-700">{figures.length}</span>}
              </h3>
              {figures.length ? (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">{figures.map((f, i) => <FigureCard key={f.id ?? i} f={f} t={t} />)}</div>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-400">
                  {cropStep.status === 'running' && <Spinner className="h-3.5 w-3.5" />}
                  {cropStep.status === 'done' ? t('progress.figuresNone') : t('progress.figuresWaiting')}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout compact>
      <div className="min-h-full bg-slate-50/70 px-3 pb-16 pt-4 sm:px-6 sm:pt-8">
        <div ref={topRef} className="card mx-auto w-full max-w-6xl scroll-mt-4 overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
            <button type="button" onClick={back} title={t('common:actions.back')} aria-label={t('common:actions.back')} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></button>
            <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-600 text-white shadow-md sm:grid"><BookOpenText className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{quizId ? t('titleAppend') : t('title')}</h1>
              <p className="truncate text-xs text-slate-500 sm:text-sm">{quizId ? (quiz ? t('appendTo', { title: quiz.title }) : '') : t('subtitle')}</p>
            </div>
          </div>
          {view === 'form' ? form : progress}
        </div>
      </div>
    </AdminLayout>
  );
}
