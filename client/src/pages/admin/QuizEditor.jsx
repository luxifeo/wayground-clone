import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Settings, Play, Rocket, Plus, Sparkles, Copy, Trash2, Pencil, GripVertical, Search, Languages, Lightbulb,
  ChevronDown, Minimize2, Maximize2, Lock, Globe, ImagePlus, BookOpen, GraduationCap, X,
} from 'lucide-react';
import { api, get, post, patch, del } from '../../lib/api.js';
import { QTYPES, QTYPE_UPPER, SUBJECTS, GRADES, LANGUAGES, TIME_OPTIONS, fmtShortTime, fmtTime, blankQuestion, UNGRADED } from '../../lib/constants.js';
import { Modal, Menu, MenuItem, Select, Spinner, useToast } from '../../components/ui.jsx';
import TypePicker from '../../components/editor/TypePicker.jsx';
import QuestionEditor from '../../components/editor/QuestionEditor.jsx';
import { QuestionBody } from '../../components/QuestionCard.jsx';
import AIGenerateModal from '../../components/AIGenerateModal.jsx';
import { useUpload } from '../../components/editor/bodies.jsx';

export function SettingsModal({ quiz, open, onClose, onSaved, requireAll }) {
  const toast = useToast();
  const [f, setF] = useState(quiz);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const { pick, busy: uploading } = useUpload();
  useEffect(() => { if (open) { setF(quiz); setTried(false); } }, [open, quiz]);
  if (!f) return null;
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const missing = { title: !f.title?.trim() || f.title === 'Untitled Quiz', subject: !f.subject, grade: !f.grade };
  const save = async () => {
    setTried(true);
    if (requireAll && (missing.title || missing.subject || missing.grade)) return;
    setBusy(true);
    try {
      const d = await patch(`/quizzes/${quiz.id}`, {
        title: f.title?.trim() || 'Untitled Quiz', subject: f.subject, grade: f.grade, language: f.language,
        visibility: f.visibility, cover_image: f.cover_image, teaching_goal: f.teaching_goal,
      });
      onSaved(d.quiz);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const err = (k, msg) => tried && requireAll && missing[k] && <div className="mt-1 text-xs font-semibold text-red-600">⚠ {msg}</div>;
  return (
    <Modal open={open} onClose={onClose} width="max-w-3xl" title="Quiz settings" icon={<Settings className="h-5 w-5 text-brand-500" />}
      footer={<><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}
    >
      <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <div className="relative">
              <input className={`input pr-14 ${tried && requireAll && missing.title ? 'border-red-400' : ''}`} maxLength={64} value={f.title === 'Untitled Quiz' ? '' : f.title || ''} placeholder="Untitled Quiz" onChange={(e) => set('title')(e.target.value)} autoFocus />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{(f.title === 'Untitled Quiz' ? '' : f.title || '').length}/64</span>
            </div>
            {err('title', 'Please name your quiz')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Subject</label><Select value={f.subject} onChange={set('subject')} options={SUBJECTS} icon={BookOpen} error={tried && requireAll && missing.subject} />{err('subject', 'Please select the subject')}</div>
            <div><label className="label">Grade</label><Select value={f.grade} onChange={set('grade')} options={GRADES} icon={GraduationCap} error={tried && requireAll && missing.grade} />{err('grade', 'Please select the grade')}</div>
          </div>
          <div><label className="label">Language</label><Select value={f.language} onChange={(v) => set('language')(v || 'English')} options={LANGUAGES} icon={Languages} /></div>
          <div>
            <label className="label">Visibility</label>
            {[['public', 'Publicly visible', 'This resource will be publicly visible in the Assessment library', Globe], ['private', 'Restricted', 'Only you can see and host this resource', Lock]].map(([v, l, d, I]) => (
              <button key={v} onClick={() => set('visibility')(v)} className={`mb-2 flex w-full items-start gap-3 rounded-lg border p-3 text-left ${f.visibility === v ? 'border-brand-400 bg-brand-50' : 'border-slate-200'}`}>
                <span className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full border-2 ${f.visibility === v ? 'border-slate-800' : 'border-slate-300'}`}>{f.visibility === v && <span className="h-2 w-2 rounded-full bg-slate-800" />}</span>
                <span><span className="flex items-center gap-1 text-sm font-semibold"><I className="h-3.5 w-3.5" />{l}</span><span className="text-xs text-slate-500">{d}</span></span>
              </button>
            ))}
          </div>
          <div>
            <label className="label">Teaching goal <span className="font-normal text-slate-400">(optional)</span></label>
            <div className="flex flex-wrap gap-2">{['Teach', 'Review', 'Practice', 'Assess', 'Other'].map((g) => <button key={g} onClick={() => set('teaching_goal')(f.teaching_goal === g ? null : g)} className={`chip ${f.teaching_goal === g ? 'border-slate-800 ring-1 ring-slate-800' : ''}`}>{g}</button>)}</div>
          </div>
        </div>
        <button onClick={async () => { const url = await pick(); if (url) set('cover_image')(url); }} className="group relative flex min-h-[260px] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50">
          {f.cover_image ? <img src={f.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : (
            <>{uploading ? <Spinner /> : <span className="grid h-9 w-9 place-items-center rounded bg-slate-500 text-white"><ImagePlus className="h-5 w-5" /></span>}<span className="text-sm">Add cover image</span></>
          )}
          {f.cover_image && <span onClick={(e) => { e.stopPropagation(); set('cover_image')(null); }} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"><X className="h-4 w-4" /></span>}
        </button>
      </div>
    </Modal>
  );
}

export async function openPreview(quizId, name = 'Teacher (preview)') {
  const w = window.open('', '_blank');
  const { session } = await post('/sessions', { quizId, kind: 'preview' });
  const d = await post(`/join/${session.code}`, { name, avatar: '🧑‍🏫' });
  w.location.href = `/play/${d.token}`;
}

export default function QuizEditor() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [quiz, setQuiz] = useState(null);
  const [editing, setEditing] = useState(null); // {question, position}
  const [picker, setPicker] = useState(null); // position for new question
  const [settings, setSettings] = useState(false);
  const [publishFlow, setPublishFlow] = useState(false);
  const [published, setPublished] = useState(false);
  const [aiBusy, setAiBusy] = useState(null);
  const [aiGen, setAiGen] = useState(false);
  const [translate, setTranslate] = useState(false);
  const [lang, setLang] = useState('Vietnamese');
  const [panel, setPanel] = useState(true);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState(null);
  const [dragId, setDragId] = useState(null);

  const load = useCallback(() => get(`/quizzes/${id}`).then((d) => setQuiz(d.quiz)).catch((e) => toast(e.message, 'error')), [id, toast]);
  useEffect(() => { load(); }, [load]);

  if (!quiz) return <div className="grid h-full place-items-center"><Spinner className="h-8 w-8 text-slate-400" /></div>;
  const qs = quiz.questions;
  const totalPts = qs.filter((q) => !UNGRADED.includes(q.type)).reduce((a, q) => a + q.points, 0);
  const totalTime = qs.reduce((a, q) => a + q.time_limit, 0);
  const showPicker = qs.length === 0 && !editing;

  const startNew = (type, position = qs.length) => {
    setPicker(null);
    setEditing({ question: blankQuestion(type), position });
    if (params.get('new')) setParams({});
  };

  const publish = async () => {
    if (!qs.length) return toast('Add at least one question', 'error');
    if (!quiz.subject || !quiz.grade || !quiz.title || quiz.title === 'Untitled Quiz') { setPublishFlow(true); setSettings(true); return; }
    try {
      const d = await post(`/quizzes/${quiz.id}/publish`);
      setQuiz(d.quiz); setPublished(true);
      setTimeout(() => nav(`/admin/quiz/${quiz.id}`), 1800);
    } catch (e) { toast(e.data?.problems?.slice(0, 3).join(' · ') || e.message, 'error'); }
  };

  const runAI = async (key, fn) => {
    setAiBusy(key);
    try { await fn(); } catch (e) { toast(e.message, 'error'); } finally { setAiBusy(null); }
  };

  const reorder = async (fromId, toId) => {
    if (fromId === toId) return;
    const ids = qs.map((q) => q.id);
    const from = ids.indexOf(fromId); const to = ids.indexOf(toId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setQuiz({ ...quiz, questions: ids.map((i) => qs.find((q) => q.id === i)) });
    const d = await post(`/quizzes/${quiz.id}/reorder`, { ids });
    setQuiz(d.quiz);
  };

  const doSearch = async (e) => {
    e?.preventDefault();
    const d = await get(`/questions/search?q=${encodeURIComponent(search)}&exclude=${quiz.id}`);
    setFound(d.questions);
  };

  const addFound = async (q) => {
    await post(`/quizzes/${quiz.id}/questions`, { ...q, id: undefined });
    toast('Question added', 'success'); load();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <button onClick={() => nav(quiz.status === 'published' ? `/admin/quiz/${quiz.id}` : '/admin/library')} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></button>
        <button onClick={() => setSettings(true)} className="max-w-xs truncate rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">{quiz.title}</button>
        {quiz.status === 'draft' && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">DRAFT</span>}
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setSettings(true)}><Settings className="h-4 w-4" />Settings</button>
          <button className="btn-ghost" disabled={!qs.length} onClick={() => openPreview(quiz.id).catch((e) => toast(e.message, 'error'))}><Play className="h-4 w-4" />{qs.length ? 'Preview quiz' : 'Add at least one question'}</button>
          <button className="btn-primary" onClick={publish}><Rocket className="h-4 w-4" />{quiz.status === 'published' ? 'Save & exit' : 'Publish'}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden bg-white p-4">
        <div className="min-w-0 flex-1 overflow-auto pr-1 scrollbar-thin">
          {showPicker ? (
            <div className="card mx-auto max-w-4xl p-6">
              <form onSubmit={(e) => { e.preventDefault(); setPanel(true); doSearch(); }} className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
                <Search className="h-4 w-4 text-slate-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search for quizzes on any topic…" className="flex-1 py-1.5 text-sm outline-none" />
                <button className="btn-outline btn-sm" disabled={!search}>Search quizzes →</button>
              </form>
              <div className="mx-auto max-w-2xl">
                <TypePicker onPick={(t) => startNew(t, 0)} />
                <div className="mt-2 border-t border-slate-100 pt-4 text-center">
                  <button className="btn-violet" onClick={() => setAiGen(true)}><Sparkles className="h-4 w-4" />Or generate questions with AI</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="text-lg font-semibold text-slate-700">{qs.length} Question{qs.length !== 1 && 's'} <span className="mx-1 text-slate-300">•</span> {totalPts} Points <span className="mx-1 text-slate-300">•</span> {fmtShortTime(totalTime)}</div>
                <Menu trigger={<button className="btn-ghost btn-sm">Bulk update<ChevronDown className="h-3.5 w-3.5" /></button>} align="left">
                  <div className="px-3 py-1 text-xs font-bold uppercase text-slate-400">Set every question to</div>
                  {[1, 2, 5].map((p) => <MenuItem key={p} onClick={async () => setQuiz((await patch(`/quizzes/${quiz.id}/questions-bulk`, { points: p })).quiz)}>{p} point{p > 1 && 's'}</MenuItem>)}
                  {[20, 30, 60].map((t) => <MenuItem key={t} onClick={async () => setQuiz((await patch(`/quizzes/${quiz.id}/questions-bulk`, { time_limit: t })).quiz)}>{fmtTime(t)}</MenuItem>)}
                </Menu>
                <button className="btn-outline btn-sm ml-auto" onClick={() => setPicker(qs.length)}><Plus className="h-3.5 w-3.5" />Create question</button>
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-700"><Sparkles className="h-4 w-4 text-cyan-500" />AI actions</span>
                <button className="chip" disabled={!!aiBusy} onClick={() => runAI('similar', async () => { const d = await api(`/ai/quizzes/${quiz.id}/similar`, { method: 'POST', body: { count: 5 } }); setQuiz(d.quiz); toast(`Added ${d.added} questions`, 'success'); })}>{aiBusy === 'similar' && <Spinner className="h-3 w-3" />}Add similar questions</button>
                <button className="chip" disabled={!!aiBusy} onClick={() => runAI('expl', async () => { const d = await api(`/ai/quizzes/${quiz.id}/explanations`, { method: 'POST', body: {} }); setQuiz(d.quiz); toast(`Wrote ${d.updated} explanations`, 'success'); })}>{aiBusy === 'expl' && <Spinner className="h-3 w-3" />}<Lightbulb className="h-3 w-3" />Add answer explanations</button>
                <button className="chip" disabled={!!aiBusy} onClick={() => setTranslate(true)}><Languages className="h-3 w-3" />Translate quiz</button>
                <button className="chip" disabled={!!aiBusy} onClick={() => setAiGen(true)}><Sparkles className="h-3 w-3" />Generate more</button>
              </div>

              <div className="space-y-3">
                {qs.map((q, i) => {
                  const T = QTYPES[q.type] || QTYPES.mcq;
                  return (
                    <div
                      key={q.id} className={`card group relative p-4 ${dragId === q.id ? 'opacity-50' : ''}`}
                      draggable onDragStart={() => setDragId(q.id)} onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => e.preventDefault()} onDrop={() => { reorder(dragId, q.id); setDragId(null); }}
                    >
                      <GripVertical className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rotate-90 cursor-grab text-slate-300" />
                      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold text-slate-700">{String(i + 1).padStart(2, '0')}</span>
                        <T.icon className={`h-3.5 w-3.5 ${T.color}`} />
                        <span className="font-semibold">{QTYPE_UPPER[q.type]}</span>•
                        <Menu align="left" trigger={<button className="hover:text-slate-800">{fmtShortTime(q.time_limit)} ▾</button>}>
                          <div className="max-h-60 overflow-auto">{TIME_OPTIONS.map((t) => <MenuItem key={t} onClick={async () => { await api(`/questions/${q.id}`, { method: 'PUT', body: { time_limit: t } }); load(); }}>{fmtTime(t)}</MenuItem>)}</div>
                        </Menu>•
                        {UNGRADED.includes(q.type) ? <span>Ungraded</span> : (
                          <Menu align="left" trigger={<button className="hover:text-slate-800">{q.points} Pt ▾</button>}>
                            <div className="max-h-60 overflow-auto">{Array.from({ length: 20 }, (_, k) => k + 1).map((p) => <MenuItem key={p} onClick={async () => { await api(`/questions/${q.id}`, { method: 'PUT', body: { points: p } }); load(); }}>{p} point{p > 1 && 's'}</MenuItem>)}</div>
                          </Menu>
                        )}
                        <div className="ml-auto flex items-center gap-0.5">
                          <button title="Duplicate" onClick={async () => { await post(`/questions/${q.id}/duplicate`); load(); }} className="rounded p-1.5 hover:bg-slate-100"><Copy className="h-4 w-4" /></button>
                          <button title="Delete" onClick={async () => { if (confirm('Delete this question?')) { await del(`/questions/${q.id}`); load(); } }} className="rounded p-1.5 hover:bg-slate-100"><Trash2 className="h-4 w-4" /></button>
                          <button title="Add similar questions with AI" disabled={!!aiBusy} onClick={() => runAI(`q${q.id}`, async () => { const d = await api(`/ai/quizzes/${quiz.id}/similar`, { method: 'POST', body: { questionIds: [q.id], count: 2 } }); setQuiz(d.quiz); toast(`Added ${d.added} similar questions`, 'success'); })} className="rounded p-1.5 hover:bg-slate-100">{aiBusy === `q${q.id}` ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</button>
                          <button onClick={() => setEditing({ question: q })} className="ml-1 flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" />Edit</button>
                        </div>
                      </div>
                      <QuestionBody q={q} />
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setPicker(qs.length)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold hover:bg-slate-50"><Plus className="h-4 w-4" />Add question</button>
              <div className="h-10" />
            </div>
          )}
        </div>

        {panel ? (
          <aside className="hidden w-[400px] shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/50 lg:flex">
            <div className="flex items-center justify-between p-4">
              <div className="font-semibold">Find questions</div>
              <button onClick={() => setPanel(false)} className="rounded-lg border border-slate-200 bg-white p-1.5"><Minimize2 className="h-4 w-4" /></button>
            </div>
            <form onSubmit={doSearch} className="mx-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search for questions on any topic" className="flex-1 text-sm outline-none" />
            </form>
            <div className="mt-3 flex-1 space-y-2 overflow-auto px-4 pb-4 scrollbar-thin">
              {found === null ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-600">
                  <BookOpen className="h-10 w-10 text-slate-300" />
                  <div className="font-semibold">Find questions from published quizzes on any topic</div>
                  <div className="text-xs text-slate-400">— or —</div>
                  <button className="btn-brand-outline btn-sm" onClick={() => setAiGen(true)}><Sparkles className="h-3.5 w-3.5" />Generate with AI</button>
                </div>
              ) : found.length === 0 ? <div className="py-10 text-center text-sm text-slate-500">No questions found.</div> : found.map((q) => (
                <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                    <span className="truncate">{QTYPE_UPPER[q.type]} · {q.quiz_title}</span>
                    <button onClick={() => addFound(q)} className="btn-outline btn-sm"><Plus className="h-3 w-3" />Add</button>
                  </div>
                  <QuestionBody q={q} compact />
                </div>
              ))}
            </div>
          </aside>
        ) : (
          <button onClick={() => setPanel(true)} className="hidden h-fit flex-col items-center gap-3 rounded-xl border border-slate-200 p-3 lg:flex" title="Find questions">
            <Sparkles className="h-4 w-4" /><Search className="h-4 w-4" /><Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <Modal open={picker !== null} onClose={() => setPicker(null)} width="max-w-3xl" title="Create new question">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
          <span className="flex items-center gap-1 text-sm font-semibold"><Sparkles className="h-4 w-4 text-cyan-500" />Create with AI</span>
          <button className="chip" onClick={() => { setPicker(null); runAI('similar', async () => { const d = await api(`/ai/quizzes/${quiz.id}/similar`, { method: 'POST', body: { count: 3 } }); setQuiz(d.quiz); toast(`Added ${d.added} questions`, 'success'); }); }}>Generate similar questions</button>
          <button className="chip" onClick={() => { setPicker(null); setAiGen(true); }}>Generate questions on topic</button>
        </div>
        <TypePicker onPick={(t) => startNew(t, picker)} />
      </Modal>

      {editing && (
        <QuestionEditor
          quizId={quiz.id} question={editing.question} position={editing.position}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <SettingsModal
        quiz={quiz} open={settings} requireAll={publishFlow}
        onClose={() => { setSettings(false); setPublishFlow(false); }}
        onSaved={async (q) => {
          setQuiz(q); setSettings(false);
          if (publishFlow) {
            setPublishFlow(false);
            try { const d = await post(`/quizzes/${q.id}/publish`); setQuiz(d.quiz); setPublished(true); setTimeout(() => nav(`/admin/quiz/${q.id}`), 1800); } catch (e) { toast(e.data?.problems?.slice(0, 3).join(' · ') || e.message, 'error'); }
          }
        }}
      />

      <Modal open={published} onClose={() => nav(`/admin/quiz/${quiz.id}`)}>
        <div className="flex items-center gap-5 py-2">
          <div className="w-32 shrink-0 rounded-xl border border-slate-200 p-3 shadow-card">
            <div className="mb-6 h-10 rounded bg-slate-100" /><div className="truncate text-xs font-bold">{quiz.title}</div><div className="text-[10px] text-slate-500">{qs.length} Questions</div>
          </div>
          <div><div className="text-xl font-bold">Great work!</div><div className="text-slate-600">Your quiz is saved and ready to play with students.</div></div>
        </div>
      </Modal>

      <Modal open={translate} onClose={() => setTranslate(false)} title="Translate quiz" icon={<Languages className="h-5 w-5 text-violet-600" />}
        footer={<><button className="btn-outline" onClick={() => setTranslate(false)}>Cancel</button><button className="btn-violet" disabled={aiBusy === 'translate'} onClick={() => runAI('translate', async () => { const d = await api(`/ai/quizzes/${quiz.id}/translate`, { method: 'POST', body: { language: lang } }); setTranslate(false); toast('Translated copy created', 'success'); nav(`/admin/quiz/${d.quiz.id}/edit`); })}>{aiBusy === 'translate' ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}Translate</button></>}
      >
        <p className="mb-3 text-sm text-slate-600">AI creates a translated copy of this quiz in your library. The original is not changed.</p>
        <Select value={lang} onChange={(v) => setLang(v || 'Vietnamese')} options={LANGUAGES} icon={Languages} />
      </Modal>

      <AIGenerateModal open={aiGen} onClose={() => setAiGen(false)} quizId={quiz.id} onDone={(q) => setQuiz(q)} />
    </div>
  );
}
