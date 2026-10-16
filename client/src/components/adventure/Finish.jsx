import { useEffect, useState } from 'react';
import { Download, Printer, RotateCcw, Home, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api.js';
import { fmtDate, lang } from '../../i18n/index.js';
import { useToast } from '../ui.jsx';
import Scene from './Scene.jsx';
import { Confetti, HeroSprite } from './fx.jsx';

const fmtTime = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Short code the teacher can match with the certificate. */
export const completionCode = (token) => String(token || '').replace(/[^a-f0-9]/gi, '').slice(0, 8).toUpperCase().replace(/(.{4})(.{4})/, '$1-$2');

/** Draws the certificate on a canvas and returns a PNG data URL. */
async function drawCertificate({ t, name, hero, worldName, title, score, stars, coins, code, gameCode, rank, accent }) {
  if (document.fonts?.ready) await document.fonts.ready;
  const W = 1600; const H = 1130;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fffbeb'); bg.addColorStop(1, '#f5f3ff');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = accent; g.lineWidth = 18; g.strokeRect(40, 40, W - 80, H - 80);
  g.strokeStyle = '#facc15'; g.lineWidth = 6; g.strokeRect(78, 78, W - 156, H - 156);
  g.textAlign = 'center'; g.fillStyle = '#1e1b4b';
  g.font = '700 74px Fredoka, Quicksand, sans-serif';
  g.fillText(t('finish.certTitle'), W / 2, 220);
  g.font = '500 36px Fredoka, Quicksand, sans-serif'; g.fillStyle = '#475569';
  g.fillText(t('finish.certFor'), W / 2, 310);
  g.font = '700 96px Fredoka, Quicksand, sans-serif'; g.fillStyle = accent;
  g.fillText(name, W / 2, 425);
  g.font = '120px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.fillText(hero, W / 2, 575);
  g.font = '500 38px Fredoka, Quicksand, sans-serif'; g.fillStyle = '#334155';
  g.fillText(`${t('finish.certFinished')} “${title}”`, W / 2, 665);
  g.fillText(t('finish.certIn', { world: worldName }), W / 2, 720);
  g.font = '700 44px Fredoka, Quicksand, sans-serif'; g.fillStyle = '#16a34a';
  g.fillText(`🏅 ${rank}`, W / 2, 810);
  g.font = '600 34px Fredoka, Quicksand, sans-serif'; g.fillStyle = '#1e293b';
  g.fillText(t('finish.certScore', { score, stars, coins }), W / 2, 875);
  g.font = '500 28px Inter, sans-serif'; g.fillStyle = '#64748b';
  g.fillText(`${t('finish.code')}: ${gameCode}   ·   ${t('finish.completion')}: ${code}   ·   ${t('finish.certDate', { date: fmtDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' }) })}`, W / 2, 985);
  return c.toDataURL('image/png');
}

/** End screen with stats, completion code and the certificate. */
export default function Finish({ token, session, world, worldName, hero, hat, name, st, stats, onAgain }) {
  const { t } = useTranslation('adventure');
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  useEffect(() => { api(`/play/${token}/summary`).then(setSummary).catch(() => {}); }, [token]);

  const total = stats.total;
  const right = summary?.stats?.correct ?? stats.firstTry;
  const score = `${right}/${total}`;
  const rankKey = right === total ? 'perfect' : right >= total * 0.6 ? 'brave' : 'rising';
  const rank = t(`finish.titles.${rankKey}`);
  const code = completionCode(token);
  const cert = () => drawCertificate({ t, name, hero, worldName, title: session.title, score, stars: st.stars, coins: st.coins, code, gameCode: session.code, rank, accent: world.accent });

  const download = async () => {
    const url = await cert();
    const a = document.createElement('a');
    a.href = url; a.download = `${name}-${session.title}.png`.replace(/[\\/:*?"<>|]+/g, '_');
    a.click();
  };
  const print = async () => {
    const url = await cert();
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html lang="${lang()}"><head><title>${t('finish.certTitle')}</title></head><body style="margin:0"><img src="${url}" style="width:100%" onload="window.print()"></body></html>`);
    w.document.close();
  };
  const send = async () => {
    await api(`/play/${token}/finish`, { method: 'POST', body: {} }).catch(() => {});
    toast(t('finish.sent'), 'success');
  };
  const cards = [
    ['score', score, 'bg-emerald-50 text-emerald-900'], ['time', fmtTime(stats.elapsed), 'bg-sky-50 text-sky-900'],
    ['coins', st.coins, 'bg-amber-50 text-amber-900'], ['stars', st.stars, 'bg-yellow-50 text-yellow-900'],
    ['monsters', st.monsters, 'bg-rose-50 text-rose-900'], ['chestsRuns', `${st.chests} · ${st.runs}`, 'bg-violet-50 text-violet-900'],
  ];

  return (
    <div className="fixed inset-0 z-30 overflow-auto bg-gradient-to-br from-sky-50 via-white to-amber-50">
      <Confetti n={90} />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-12 pt-6">
        <div className="relative h-56 w-full max-w-md overflow-hidden rounded-[2.5rem] shadow-xl ring-4 ring-white">
          <Scene world={world} width={1200} />
          <span className="absolute left-1/2 top-4 -translate-x-1/2 text-[110px] leading-none drop-shadow-lg">🏰</span>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2"><HeroSprite emoji={hero} hat={hat} size={70} pose="cheer" /></span>
        </div>
        <h1 className="mt-5 text-center font-adv text-4xl font-bold text-slate-900">{t('finish.congrats', { name })}</h1>
        <p className="text-slate-600">{t('finish.completed')}</p>
        <div className="mt-5 w-full rounded-3xl bg-white p-5 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid flex-1 grid-cols-3 gap-2">
              {cards.map(([k, v, cls]) => (
                <div key={k} className={`rounded-2xl p-3 ${cls}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">{t(`finish.${k}`)}</div>
                  <div className="font-adv text-2xl font-bold">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-6xl">🎖️</span>
              <span className="font-adv font-bold text-indigo-700">{rank}</span>
              <span className="text-[11px] text-slate-500">{t('finish.titleNote')}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-600">
            <span>{t('finish.code')} <b className="rounded bg-violet-50 px-1.5 font-mono text-violet-700">{session.code}</b></span>
            <span>{t('finish.completion')} <b className="rounded bg-violet-50 px-1.5 font-mono text-violet-700">{code}</b></span>
            <span>{t('finish.teacherCheck')}</span>
          </div>
          <div className="mt-3 flex justify-center"><button type="button" onClick={send} className="adv-btn-violet flex items-center gap-2 px-6 py-2.5"><Send className="h-4 w-4" />{t('finish.send')}</button></div>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={download} className="adv-btn-violet flex items-center gap-2 px-5 py-2.5"><Download className="h-4 w-4" />{t('finish.certificate')}</button>
          <button type="button" onClick={print} className="adv-btn-white flex items-center gap-2 px-5 py-2.5"><Printer className="h-4 w-4" />{t('finish.print')}</button>
          {summary?.canPlayAgain && <button type="button" onClick={onAgain} className="adv-btn-white flex items-center gap-2 px-5 py-2.5"><RotateCcw className="h-4 w-4" />{t('finish.again')}</button>}
          <a href="/join" className="adv-btn-white flex items-center gap-2 px-5 py-2.5"><Home className="h-4 w-4" />{t('finish.home')}</a>
        </div>
      </div>
    </div>
  );
}
