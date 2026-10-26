import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Sparkles, Upload, FileText, Link2, X, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import { GRADES, LANGUAGES, QTYPES } from '../lib/constants.js';
import { Modal, Select, Toggle, useToast } from './ui.jsx';
import { gradeLabel, languageLabel } from '../i18n/index.js';

const AI_TYPES = ['mcq', 'msq', 'tf', 'fill', 'open', 'reorder', 'match', 'dropdown', 'dragdrop', 'categorize', 'math', 'crossword', 'poll'];
const LOADING_TIPS = ['reading', 'concepts', 'writing', 'distractors', 'checking']; // ai:tips.<key>

/**
 * mode: 'prompt' | 'upload' | 'link'
 * quizId: when set, questions are appended to that quiz and onDone(quiz) is called.
 * folderId: library folder for a new quiz.
 */
export default function AIGenerateModal({ open, onClose, initialMode = 'prompt', initialTopic = '', initialFiles = null, initialUrl = "", quizId, folderId, onDone }) {
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useTranslation('ai');
  const [mode, setMode] = useState(initialMode);
  const [topic, setTopic] = useState(initialTopic);
  const [files, setFiles] = useState([]);
  const [url, setUrl] = useState('');
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState(['mcq']);
  const [grade, setGrade] = useState(null);
  const [language, setLanguage] = useState('English');
  const [difficulty, setDifficulty] = useState('medium');
  const [withImages, setWithImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState(0);
  const [status, setStatus] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode); setTopic(initialTopic); setFiles(initialFiles ? [...initialFiles] : []); setUrl(initialUrl || "");
    api('/ai/status').then(setStatus).catch(() => setStatus({ ok: false }));
  }, [open, initialMode, initialTopic, initialFiles, initialUrl]);

  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(() => setTip((x) => (x + 1) % LOADING_TIPS.length), 2500);
    return () => clearInterval(timer);
  }, [busy]);

  const toggleType = (ty) => setTypes((x) => (x.includes(ty) ? (x.length > 1 ? x.filter((y) => y !== ty) : x) : [...x, ty]));

  const addFiles = (list) => setFiles((x) => [...x, ...Array.from(list)].slice(0, 10));

  const generate = async () => {
    const form = new FormData();
    form.append('topic', topic);
    form.append('count', count);
    form.append('types', types.join(','));
    form.append('language', language);
    form.append('difficulty', difficulty);
    form.append('images', withImages ? 'true' : 'false');
    if (grade) form.append('grade', grade);
    if (quizId) form.append('quizId', quizId);
    else if (folderId) form.append('folderId', folderId);
    if (mode === 'upload') files.forEach((f) => form.append('files', f));
    if (mode === 'link' && url) form.append('url', url);
    setBusy(true);
    try {
      const d = await api('/ai/generate', { method: 'POST', form });
      toast(t('generated', { count: d.added }) + (d.illustrated ? t('generatedImages', { count: d.illustrated }) : ''), 'success');
      onClose();
      if (onDone) onDone(d.quiz);
      else nav(`/admin/quiz/${d.quiz.id}/edit`);
    } catch (e) {
      toast(e.message, 'error');
    } finally { setBusy(false); }
  };

  const canGo = mode === 'prompt' ? topic.trim().length > 2 : mode === 'upload' ? files.length > 0 : /^https?:\/\//.test(url);

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} width="max-w-2xl" title={quizId ? t('titleGenerate') : t('titleCreate')} icon={<Sparkles className="h-5 w-5 text-violet-600" />}>
      {busy ? (
        <div className="flex flex-col items-center gap-4 py-14">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 animate-ping rounded-full bg-violet-200" />
            <div className="relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-brand-500 text-white"><Sparkles className="h-7 w-7" /></div>
          </div>
          <div className="font-semibold">{t(`tips.${LOADING_TIPS[tip]}`)}</div>
          <div className="text-xs text-slate-500">{t('working')}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {status && !status.ok && (
            <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div><Trans ns="ai" i18nKey="unreachable" values={{ baseUrl: status.baseUrl, error: status.error }} components={{ b: <b />, code: <code /> }} /></div>
            </div>
          )}
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            {[['prompt', FileText], ['upload', Upload], ['link', Link2]].map(([m, I]) => (
              <button key={m} onClick={() => setMode(m)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 ${mode === m ? 'bg-white shadow-card' : 'text-slate-500'}`}><I className="h-4 w-4" />{t(`modes.${m}`)}</button>
            ))}
          </div>

          {mode === 'prompt' && (
            <textarea
              className="input min-h-[130px]" autoFocus value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder={t('topicPlaceholder')}
            />
          )}
          {mode === 'upload' && (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-8 text-center hover:border-violet-400 hover:bg-violet-50/40"
              >
                <Upload className="h-7 w-7 text-slate-400" />
                <div className="text-sm"><Trans ns="ai" i18nKey="dropzone" components={{ b: <b /> }} /></div>
                <div className="text-xs text-slate-500">{t('formats')}</div>
                <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,image/*" onChange={(e) => addFiles(e.target.files)} />
              </div>
              {files.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      {f.type.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-violet-500" /> : <FileText className="h-4 w-4 text-violet-500" />}
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-slate-400">{Math.round(f.size / 1024)} KB</span>
                      <button title={t('removeFile')} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-4 w-4 text-slate-400" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <input className="input mt-3" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('instructionsExample')} />
            </div>
          )}
          {mode === 'link' && (
            <div className="space-y-2">
              <input className="input" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://en.wikipedia.org/wiki/Photosynthesis" />
              <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('instructions')} />
            </div>
          )}

          <div>
            <div className="label">{t('types')}</div>
            <div className="flex flex-wrap gap-2">
              {AI_TYPES.map((ty) => {
                const T = QTYPES[ty];
                const on = types.includes(ty);
                return (
                  <button key={ty} type="button" onClick={() => toggleType(ty)} className={`chip ${on ? 'border-violet-450 bg-violet-50 text-violet-700' : ''}`}>
                    <T.icon className="h-3.5 w-3.5" />{T.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div><div className="label">{t('count')}</div><input type="number" min={1} max={30} className="input" value={count} onChange={(e) => setCount(e.target.value)} /></div>
            <div><div className="label">{t('grade')}</div><Select value={grade} onChange={setGrade} options={GRADES.map((v) => ({ value: v, label: gradeLabel(v) }))} placeholder={t('any')} /></div>
            <div><div className="label">{t('common:language')}</div><Select value={language} onChange={(v) => setLanguage(v || 'English')} options={LANGUAGES.map((v) => ({ value: v, label: languageLabel(v) }))} /></div>
            <div><div className="label">{t('difficulty')}</div><Select value={difficulty} onChange={(v) => setDifficulty(v || 'medium')} options={['easy', 'medium', 'hard'].map((v) => ({ value: v, label: t(`levels.${v}`) }))} /></div>
          </div>
          <label className="flex items-center gap-3 rounded-lg bg-violet-50 px-3 py-2 text-sm">
            <Toggle checked={withImages} onChange={setWithImages} />
            <span><Trans ns="ai" i18nKey="findImages" components={{ b: <b />, muted: <span className="text-slate-500" /> }} /></span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-outline" onClick={onClose}>{t('common:actions.cancel')}</button>
            <button className="btn-violet" disabled={!canGo} onClick={generate}><Sparkles className="h-4 w-4" />{t('generate')}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
