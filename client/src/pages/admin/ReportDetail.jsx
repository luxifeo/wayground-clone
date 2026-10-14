import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  ArrowLeft, Download, Square, RotateCcw, Users, Target, Clock, Trophy, Sparkles, Check, X, Monitor, Trash2, Pencil, CalendarDays,
} from 'lucide-react';
import InvitePanel, { SettingsDrawer } from '../../components/InvitePanel.jsx';
import AdminLayout from '../../components/AdminLayout.jsx';
import { api, getToken, del } from '../../lib/api.js';
import { useSocket } from '../../lib/socket.js';
import { QTYPES, QTYPE_UPPER, UNGRADED, CHOICE_TYPES } from '../../lib/constants.js';
import { Avatar, Modal, Spinner, useToast } from '../../components/ui.jsx';
import { QuestionBody } from '../../components/QuestionCard.jsx';
import ParticipantActions from '../../components/ParticipantActions.jsx';
import SuspectBadge from '../../components/SuspectBadge.jsx';
import { FormatAnswer } from '../../lib/formatAnswer.jsx';
import { toCSV } from '../../lib/csv.js';
import { WordCloud } from '../../components/play/answers.jsx';
import { fmtDate } from '../../i18n/index.js';

const ST = { correct: 'bg-emerald-500', incorrect: 'bg-red-500', partial: 'bg-amber-400', ungraded: 'bg-blue-500', skipped: 'bg-slate-400' };

function GradeButtons({ r, onGrade }) {
  const { t } = useTranslation('common');
  return (
    <span className="inline-flex gap-1">
      {[[1, Check, 'bg-emerald-500'], [0.5, null, 'bg-amber-400'], [0, X, 'bg-red-500']].map(([f, I, c]) => (
        <button key={f} title={t(f === 1 ? 'result.correct' : f === 0 ? 'result.incorrect' : 'result.partial')} onClick={() => onGrade(r, f)} className={`grid h-6 w-6 place-items-center rounded text-xs font-bold text-white ${c} ${r.status !== 'ungraded' && r.fraction === f ? 'ring-2 ring-slate-800' : 'opacity-70 hover:opacity-100'}`}>{I ? <I className="h-3.5 w-3.5" /> : '½'}</button>
      ))}
    </span>
  );
}

export default function ReportDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useTranslation('report');
  const [d, setD] = useState(null);
  const [tab, setTab] = useState(params.get('tab') || 'participants');
  const [player, setPlayer] = useState(null);
  const [aiBusy, setAiBusy] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(() => api(`/sessions/${id}/report`).then(setD).catch((e) => toast(e.message, 'error')), [id, toast]);
  useEffect(() => { load(); }, [load]);
  useSocket('host:watch', { sessionId: Number(id), token: getToken() }, { 'session:host': () => load() });

  if (!d) return <AdminLayout compact><div className="grid h-full place-items-center"><Spinner className="h-8 w-8 text-slate-400" /></div></AdminLayout>;
  const s = d.session;
  const rename = async () => {
    setRenaming(false);
    if (newTitle.trim() && newTitle.trim() !== s.title) { await api(`/sessions/${id}`, { method: 'PATCH', body: { title: newTitle.trim() } }); load(); }
  };
  const avgScore = d.players.length ? Math.round(d.players.reduce((a, p) => a + p.score, 0) / d.players.length) : 0;
  const completion = d.players.length ? Math.round((d.players.filter((p) => p.finished_at).length / d.players.length) * 100) : 0;

  const grade = async (r, fraction) => { await api(`/responses/${r.id}`, { method: 'PATCH', body: { fraction } }); load(); };
  const aiGrade = async (qid) => {
    setAiBusy(qid || 'all');
    try { const x = await api(`/ai/sessions/${id}/grade`, { method: 'POST', body: { questionId: qid } }); toast(t('aiGraded', { count: x.graded }), 'success'); load(); } catch (e) { toast(e.message, 'error'); } finally { setAiBusy(null); }
  };
  const exportCsv = () => {
    const rows = [[t('csv.rank'), t('csv.name'), t('csv.attempt'), t('csv.score'), t('csv.accuracy'), ...d.questions.map((q, i) => t('csv.q', { n: i + 1 }))]];
    d.players.forEach((p) => rows.push([p.rank, p.name, p.attempt, p.score, p.accuracy ?? '', ...p.statuses.map((x) => x || '')]));
    const blob = new Blob([`\uFEFF${toCSV(rows)}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${s.title || t('csvFile')}.csv`; a.click();
  };
  const hasOpen = d.questions.some((q) => q.type === 'open' && q.responses.some((r) => r.status === 'ungraded'));
  const playerResponses = (p) => d.questions.map((q) => ({ q, r: q.responses.find((r) => r.participant_id === p.id) }));

  return (
    <AdminLayout compact>
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <button onClick={() => nav('/admin/reports')} className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" />{t('back')}</button>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {renaming ? (
                <input autoFocus className="input w-80 py-1 text-xl font-bold" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && rename()} />
              ) : (
                <h1 className="text-2xl font-bold">{s.title}</h1>
              )}
              {!renaming && <button title={t('common:actions.rename')} onClick={() => { setNewTitle(s.title); setRenaming(true); }} className="rounded p-1 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}
              {s.status === 'ended'
                ? <span className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">{t('common:status.completed')}</span>
                : <span className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-0.5 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('common:status.running')}</span>}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />{t('started', { date: fmtDate(s.started_at || s.created_at) })}
              <span className="text-slate-300">·</span>{s.kind === 'homework' ? t('assignedQuiz') : t(s.pace === 'teacher' ? 'common:session.teacherLed' : 'common:session.studentPaced')}{s.game_type === 'test' && ` · ${t('common:session.test')}`}{s.settings?.scoring === 'perQuestion' && ` · ${t('scoringPerQuestion')}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/quiz/${s.quiz_id}/edit`} className="btn-outline">{t('editQuestions')}</Link>
            {s.status !== 'ended' && <button className="btn-outline" onClick={() => setSettingsOpen(true)}>{t('editSettings')}</button>}
            {s.status !== 'ended' && s.kind === 'live' && <Link to={`/host/${s.id}`} className="btn-brand-outline"><Monitor className="h-4 w-4" />{t('viewLeaderboard')}</Link>}
            {hasOpen && <button className="btn-violet" disabled={!!aiBusy} onClick={() => aiGrade(null)}>{aiBusy === 'all' ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}{t('aiGradeOpen')}</button>}
            <button className="btn-outline" onClick={exportCsv}><Download className="h-4 w-4" />{t('export')}</button>
            {s.status !== 'ended'
              ? <button className="btn-outline text-red-600" onClick={async () => { await api(`/sessions/${id}/end`, { method: 'POST', body: {} }); load(); }}><Square className="h-4 w-4" />{t('common:actions.end')}</button>
              : <button className="btn-outline" onClick={async () => { await api(`/sessions/${id}/reopen`, { method: 'POST', body: { deadline: s.kind === 'homework' ? new Date(Date.now() + 7 * 86400000).toISOString() : null } }); load(); }}><RotateCcw className="h-4 w-4" />{t('reopen')}</button>}
            <button className="btn-outline px-2.5" title={t('deleteReport')} onClick={async () => { if (confirm(t('confirmDelete'))) { await del(`/sessions/${id}`); nav('/admin/reports'); } }}><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>

        {s.status !== 'ended' && <div className="mx-auto mt-5 max-w-4xl"><InvitePanel session={s} onChanged={load} /></div>}

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <div className="card col-span-2 p-4">
            <div className="text-xs font-semibold text-slate-500">{t('classAccuracy')}</div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${d.accuracy ?? 0}%` }} /></div>
              <span className="text-2xl font-bold">{d.accuracy ?? '–'}%</span>
            </div>
          </div>
          {[[Users, d.players.length, 'participants'], [Target, `${completion}%`, 'completion'], [Trophy, avgScore, 'avgScore']].map(([I, v, l]) => (
            <div key={l} className="card flex items-center gap-3 p-4"><I className="h-6 w-6 text-violet-500" /><div><div className="text-xl font-bold">{v}</div><div className="text-xs text-slate-500">{t(l)}</div></div></div>
          ))}
        </div>

        <div className="mt-6 flex gap-1 border-b border-slate-200">
          {['participants', 'questions'].map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500'}`}>{t(k)}</button>
          ))}
        </div>

        {tab === 'participants' && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr><th className="p-3">#</th><th className="p-3">{t('name')}</th><th className="p-3">{t('score')}</th><th className="p-3">{t('accuracy')}</th>{d.questions.map((q, i) => <th key={q.id} className="p-1 text-center text-xs">{t('qShort', { n: i + 1 })}<div className="font-normal text-slate-400">{q.accuracy ?? '–'}%</div></th>)}<th className="sticky right-0 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.25)] w-10 bg-slate-50 p-1" /></tr>
              </thead>
              <tbody>
                {d.players.map((p) => (
                  <tr key={p.id} className="group cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setPlayer(p)}>
                    <td className="p-3 text-slate-500">{p.rank}</td>
                    <td className="p-3"><span className="flex items-center gap-2"><Avatar avatar={p.avatar} name={p.name} size={26} /><span className="font-semibold">{p.name}</span>{p.attempt > 1 && <span className="text-xs text-slate-400">{t('attempt', { n: p.attempt })}</span>}<SuspectBadge suspect={p.suspect} />{p.disconnected
                      ? <span className="whitespace-nowrap rounded bg-slate-100 px-1.5 text-[10px] font-bold uppercase text-slate-500">{t('common:status.disconnected')}</span>
                      : !p.finished_at && s.status !== 'ended' && <span className="whitespace-nowrap rounded bg-emerald-50 px-1.5 text-[10px] font-bold uppercase text-emerald-600">{t('common:status.inProgress')}</span>}</span></td>
                    <td className="p-3 font-bold">{p.score}</td>
                    <td className="p-3">{p.accuracy === null ? '–' : `${p.accuracy}%`}</td>
                    {p.statuses.map((st, i) => <td key={i} className="p-1"><span className={`mx-auto block h-6 w-6 rounded ${st ? ST[st] : 'bg-slate-100'}`} title={t(`common:result.${st || 'unattempted'}`)} /></td>)}
                    <td className="sticky right-0 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.25)] bg-white p-1 group-hover:bg-slate-50"><ParticipantActions sessionId={s.id} player={p} onChange={() => load()} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!d.players.length && <div className="p-10 text-center text-slate-500"><Trans ns="report" i18nKey="noParticipants" values={{ code: s.code }} components={{ b: <b className="font-mono" /> }} /></div>}
          </div>
        )}

        {tab === 'questions' && (
          <div className="mt-4 space-y-4">
            {d.questions.map((q, i) => {
              const T = QTYPES[q.type] || QTYPES.mcq;
              const dist = {};
              if (CHOICE_TYPES.includes(q.type)) q.responses.forEach((r) => (Array.isArray(r.answer) ? r.answer : [r.answer]).forEach((a) => { dist[a] = (dist[a] || 0) + 1; }));
              const max = Math.max(1, ...Object.values(dist));
              return (
                <div key={q.id} className="card p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-bold text-slate-700">{t('qLong', { n: i + 1 })}</span><T.icon className={`h-3.5 w-3.5 ${T.color}`} />{QTYPE_UPPER[q.type]}
                    <span className="ml-auto flex items-center gap-3">
                      <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" />{UNGRADED.includes(q.type) && q.accuracy === null ? t('common:result.ungraded') : t('accuracyPct', { value: q.accuracy ?? '–' })}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t('avgTime', { value: q.avgTime ?? '–' })}</span>
                      <span>{t('responses', { count: q.attempts })}</span>
                    </span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <QuestionBody q={q} />
                    <div>
                      {CHOICE_TYPES.includes(q.type) ? (
                        <div className="space-y-1.5">
                          {q.options.map((o, oi) => (
                            <div key={o.id} className="flex items-center gap-2 text-sm">
                              <span className="w-28 truncate">{o.text}</span>
                              <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100"><div className={`h-full ${(q.answer || []).includes(o.id) ? 'bg-emerald-500' : q.type === 'poll' ? `edit-${oi % 5}` : 'bg-red-300'}`} style={{ width: `${((dist[o.id] || 0) / max) * 100}%` }} /></div>
                              <span className="w-6 text-right font-semibold">{dist[o.id] || 0}</span>
                            </div>
                          ))}
                        </div>
                      ) : q.type === 'wordcloud' ? (
                        <div className="rounded-xl bg-slate-50"><WordCloud words={q.responses.map((r) => r.answer)} dark={false} /></div>
                      ) : (
                        <div className="max-h-72 space-y-1.5 overflow-auto scrollbar-thin">
                          {q.type === 'open' && q.responses.some((r) => r.status === 'ungraded') && (
                            <button className="btn-violet btn-sm mb-1" disabled={!!aiBusy} onClick={() => aiGrade(q.id)}>{aiBusy === q.id ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}{t('gradeWithAi')}</button>
                          )}
                          {q.responses.map((r) => (
                            <div key={r.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${ST[r.status]}`} />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-500">{r.name}</div>
                                <FormatAnswer q={q} answer={r.answer} />
                                {r.feedback && <div className="mt-0.5 text-xs text-blue-700">💬 {r.feedback}</div>}
                              </div>
                              {(UNGRADED.includes(q.type) && q.type !== 'poll') || ['fill', 'math'].includes(q.type) ? <GradeButtons r={r} onGrade={grade} /> : null}
                            </div>
                          ))}
                          {!q.responses.length && <div className="text-sm text-slate-400">{t('noResponses')}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={!!player} onClose={() => setPlayer(null)} width="max-w-3xl" title={player && <span className="flex items-center gap-2"><Avatar avatar={player.avatar} name={player.name} size={30} />{player.name} · {t('pts', { count: player.score })} · {player.accuracy ?? '–'}%</span>}>
        {player && (
          <div className="space-y-2">
            {playerResponses(player).map(({ q, r }, i) => (
              <div key={q.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded px-1.5 text-xs font-bold text-white ${ST[r?.status || 'skipped']}`}>{t(`common:result.${r?.status || 'unattempted'}`)}</span>
                  <span className="font-semibold">{t('qLong', { n: i + 1 })}. {q.text.replace(/\[\[[^\]]+\]\]/g, '____')}</span>
                  {r && <span className="ml-auto text-xs text-slate-400">{t('common:time.sec', { count: Math.round(r.time_ms / 1000) })} · +{r.score}</span>}
                </div>
                {r && <div><span className="text-slate-500">{t('answer')}</span><FormatAnswer q={q} answer={r.answer} /></div>}
                {r && (UNGRADED.includes(q.type) && q.type !== 'poll' || ['fill', 'math'].includes(q.type)) && <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">{t('overrideGrade')} <GradeButtons r={r} onGrade={async (x, f) => { await grade(x, f); setPlayer(null); }} /></div>}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <SettingsDrawer key={settingsOpen ? 'open' : 'closed'} session={s} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={load} />
    </AdminLayout>
  );
}
