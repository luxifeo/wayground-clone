import { useState } from 'react';
import { ChevronUp, ChevronDown, Copy, QrCode, AlarmClock, Pencil, Mail, X, Settings } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../lib/api.js';
import { Spinner, Toggle, useToast } from './ui.jsx';

export const gameLink = (code) => `${window.location.origin}/join?gc=${code}`;

/** "Share with students": create an assignment due in 24h and return the new session. */
export async function shareWithStudents(quizId) {
  const { session } = await api('/sessions', {
    method: 'POST',
    body: { quizId, kind: 'homework', deadline: new Date(Date.now() + 86400000).toISOString(), settings: { shuffleQuestions: false, shuffleAnswers: false } },
  });
  return session;
}
const fmtCode = (c) => String(c).replace(/(\d{3,4})(\d{3,4})$/, '$1 $2');

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDeadline = (d) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Brand-coloured share targets that only need a URL. */
function shareTargets(link, title) {
  const text = `Join "${title}" on Wayground: ${link}`;
  const e = encodeURIComponent;
  return [
    { key: 'classroom', label: 'Google Classroom', bg: '#0f9d58', url: `https://classroom.google.com/share?url=${e(link)}&title=${e(title)}`, glyph: 'GC' },
    { key: 'teams', label: 'Microsoft Teams', bg: '#5b5fc7', url: `https://teams.microsoft.com/share?href=${e(link)}&msgText=${e(text)}`, glyph: 'T' },
    { key: 'email', label: 'Email', bg: '#2563eb', url: `mailto:?subject=${e(title)}&body=${e(text)}`, icon: Mail },
    { key: 'whatsapp', label: 'WhatsApp', bg: '#22c55e', url: `https://wa.me/?text=${e(text)}`, glyph: 'W' },
    { key: 'facebook', label: 'Facebook', bg: '#1877f2', url: `https://www.facebook.com/sharer/sharer.php?u=${e(link)}`, glyph: 'f' },
    { key: 'x', label: 'X (Twitter)', bg: '#111827', url: `https://twitter.com/intent/tweet?text=${e(text)}`, glyph: '𝕏' },
  ];
}

export function QrModal({ open, onClose, code }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 animate-rise" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[#2b2b2b] text-white shadow-2xl">
        <div className="flex items-center justify-center gap-3 bg-[#1f1f1f] px-5 py-4 font-game text-2xl font-bold">
          <span>{window.location.host}/join</span><span className="text-white/50">•</span><span className="tracking-widest">{code}</span>
          <button onClick={onClose} className="ml-auto rounded-full p-1 hover:bg-white/10" aria-label="Close"><X className="h-6 w-6" /></button>
        </div>
        <div className="grid place-items-center p-8">
          <div className="rounded-2xl bg-white p-4 ring-8 ring-black/40"><QRCodeSVG value={gameLink(code)} size={260} /></div>
        </div>
      </div>
    </div>
  );
}

/** "Invite participants" box shown on a running assignment / session report. */
export default function InvitePanel({ session, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [qr, setQr] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deadline, setDeadline] = useState(toLocalInput(new Date(session.deadline || Date.now() + 86400000)));
  const link = gameLink(session.code);
  const copy = (t, msg) => { navigator.clipboard.writeText(t); toast(msg, 'success'); };

  const saveDeadline = async () => {
    const d = await api(`/sessions/${session.id}`, { method: 'PATCH', body: { deadline: new Date(deadline).toISOString() } });
    setEditing(false); toast('Deadline updated', 'success'); onChanged?.(d);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-start justify-between bg-slate-100 px-6 py-4">
        <div>
          <div className="text-lg font-bold">Invite participants</div>
          {session.kind === 'homework' && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <AlarmClock className="h-4 w-4" />
              {editing ? (
                <>
                  <input type="datetime-local" className="input w-auto py-1" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  <button className="btn-primary btn-sm" onClick={saveDeadline}>Save</button>
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                </>
              ) : (
                <>
                  Deadline : <b>{session.deadline ? fmtDeadline(session.deadline) : 'No deadline'}</b>
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-semibold"><Pencil className="h-3 w-3" />Edit</button>
                </>
              )}
            </div>
          )}
        </div>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-sm font-semibold">{open ? <>Show less<ChevronUp className="h-4 w-4" /></> : <>Show more<ChevronDown className="h-4 w-4" /></>}</button>
      </div>
      {open && (
        <div className="grid gap-6 px-6 py-6 md:grid-cols-[1fr_auto_1fr] md:px-10">
          <div>
            <div className="mb-4 font-bold">Join using game code</div>
            <div className="mb-1 text-xs font-semibold text-slate-600">STEP 1: Use any device to open</div>
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 font-semibold">{window.location.host}/join</div>
            <div className="mb-1 text-xs font-semibold text-slate-600">STEP 2: Enter join code</div>
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-4 pr-1.5">
              <span className="flex-1 font-mono text-lg font-bold tracking-wider">{fmtCode(session.code)}</span>
              <button onClick={() => setQr(true)} className="btn-brand-outline btn-sm"><QrCode className="h-3.5 w-3.5" />QR code</button>
            </div>
          </div>
          <div className="hidden items-center md:flex"><div className="flex h-full flex-col items-center text-xs text-slate-400"><span className="w-px flex-1 bg-slate-200" />or<span className="w-px flex-1 bg-slate-200" /></div></div>
          <div>
            <div className="mb-4 font-bold">Join using link</div>
            <div className="mb-1 text-xs font-semibold text-slate-600">Game link</div>
            <div className="mb-4 flex items-center rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-4 pr-1.5">
              <span className="flex-1 truncate text-sm font-semibold">{link}</span>
              <button onClick={() => copy(link, 'Link copied')} className="btn-brand-outline btn-sm"><Copy className="h-3.5 w-3.5" />Copy</button>
            </div>
            <div className="mb-2 text-xs font-semibold text-slate-600">Share to</div>
            <div className="flex flex-wrap gap-2">
              {shareTargets(link, session.title).map((t) => (
                <a key={t.key} href={t.url} target="_blank" rel="noreferrer" title={t.label} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5">
                  <span className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-black text-white" style={{ background: t.bg }}>{t.icon ? <t.icon className="h-3.5 w-3.5" /> : t.glyph}</span>
                </a>
              ))}
              <button title="Copy invite message" onClick={() => copy(`Join "${session.title}": go to ${window.location.host}/join and enter code ${session.code} — or open ${link}`, 'Invite message copied')} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white shadow-sm hover:-translate-y-0.5"><Copy className="h-4 w-4 text-slate-600" /></button>
            </div>
          </div>
        </div>
      )}
      <QrModal open={qr} onClose={() => setQr(false)} code={session.code} />
    </div>
  );
}

/** Right-side drawer to change the settings of a running activity (no gamification options). */
export function SettingsDrawer({ session, open, onClose, onSaved }) {
  const toast = useToast();
  const [s, setS] = useState(session.settings || {});
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const set = (k) => (v) => setS({ ...s, [k]: v });
  const Row = ({ label, sub, children }) => (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3.5">
      <div><div className="text-sm font-semibold">{label}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}</div>{children}
    </div>
  );
  const save = async () => {
    setBusy(true);
    try {
      const d = await api(`/sessions/${session.id}`, { method: 'PATCH', body: { settings: s } });
      toast('Settings updated', 'success'); onSaved?.(d); onClose();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-rise">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-500"><Settings className="h-5 w-5" /></span>
          <div className="flex-1"><div className="font-bold">Edit Activity Setting</div><div className="text-xs text-slate-500">Modify settings for the current game</div></div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-auto px-5 scrollbar-thin">
          <Row label="Participant attempts">
            <select className="input w-36" value={s.attempts || 0} onChange={(e) => set('attempts')(Number(e.target.value))}>
              <option value={0}>Unlimited</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
            </select>
          </Row>
          <Row label="Show answers during activity" sub="After each question">
            <select className="input w-36" value={s.showAnswers || 'on'} onChange={(e) => set('showAnswers')(e.target.value)}>
              <option value="on">On</option><option value="validate">Validate only</option><option value="off">Off</option>
            </select>
          </Row>
          <Row label="Show answers after activity">
            <select className="input w-36" value={s.showAnswersAfter || 'on'} onChange={(e) => set('showAnswersAfter')(e.target.value)}>
              <option value="on">On</option><option value="questions">Questions only</option><option value="off">Off</option>
            </select>
          </Row>
          <Row label="Question timer" sub="Use each question's time limit"><Toggle checked={!!s.timer} onChange={set('timer')} /></Row>
          <Row label="Show leaderboard"><Toggle checked={!!s.leaderboard} onChange={set('leaderboard')} /></Row>
          <Row label="Shuffle questions" sub="Applies to students who join from now on"><Toggle checked={!!s.shuffleQuestions} onChange={set('shuffleQuestions')} /></Row>
          <Row label="Shuffle answer options"><Toggle checked={!!s.shuffleAnswers} onChange={set('shuffleAnswers')} /></Row>
          <Row label="Skip questions & attempt later"><Toggle checked={!!s.skipQuestions} onChange={set('skipQuestions')} /></Row>
          <Row label="Anonymize student names"><Toggle checked={!!s.anonymize} onChange={set('anonymize')} /></Row>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={save}>{busy && <Spinner className="h-4 w-4" />}Save</button>
        </div>
      </div>
    </div>
  );
}

