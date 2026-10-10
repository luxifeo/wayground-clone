import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, X, Volume2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { AVATARS } from '../../lib/constants.js';
import { Avatar, Logo, Spinner, Toggle } from '../../components/ui.jsx';

const ADJ = ['Happy', 'Brave', 'Clever', 'Swift', 'Sunny', 'Cosmic', 'Lucky', 'Mighty', 'Jolly', 'Witty'];
const NOUN = ['Panda', 'Fox', 'Otter', 'Comet', 'Tiger', 'Koala', 'Falcon', 'Dolphin', 'Rocket', 'Wizard'];
const randomName = () => `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`;

export default function Join() {
  const { code: urlCode } = useParams();
  const nav = useNavigate();
  const [code, setCode] = useState(urlCode || '');
  const [session, setSession] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(localStorage.getItem('wg_name') || '');
  const [avatar, setAvatar] = useState(localStorage.getItem('wg_avatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [sound, setSound] = useState(localStorage.getItem('wg_sound') !== '0');
  const saved = session && localStorage.getItem(`wg_play_${session.code}`);

  const lookup = async (c) => {
    setErr(''); setBusy(true);
    try {
      const d = await api(`/join/${c.replace(/\s/g, '')}`);
      setSession(d.session);
    } catch (e) { setErr(e.message); setSession(null); } finally { setBusy(false); }
  };
  useEffect(() => { if (urlCode) lookup(urlCode); }, [urlCode]);

  const join = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Please enter your name');
    setBusy(true); setErr('');
    try {
      const d = await api(`/join/${session.code}`, { method: 'POST', body: { name: name.trim(), avatar } });
      localStorage.setItem('wg_name', name.trim());
      localStorage.setItem('wg_avatar', avatar);
      localStorage.setItem('wg_sound', sound ? '1' : '0');
      localStorage.setItem(`wg_play_${session.code}`, JSON.stringify({ token: d.token, name: d.participant.name }));
      nav(`/play/${d.token}`);
    } catch (ex) { setErr(ex.message); setBusy(false); }
  };

  return (
    <div className="flex min-h-full flex-col game-bg">
      <header className="flex items-center justify-between p-4">
        <Link to="/"><Logo dark small /></Link>
        {session && <span className="rounded-lg bg-black/30 px-3 py-1.5 font-game font-bold tracking-widest text-white">{session.code.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>}
      </header>
      <div className="flex flex-1 items-start justify-center px-4 pt-[8vh]">
        {!session ? (
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) lookup(code); }} className="w-full max-w-md rounded-2xl bg-white p-3 shadow-2xl">
            <input
              value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))} autoFocus inputMode="numeric" maxLength={7}
              placeholder="Enter a join code" className="w-full rounded-xl border-2 border-slate-200 px-4 py-4 text-center font-game text-3xl font-bold tracking-widest outline-none focus:border-violet-400"
            />
            <button disabled={busy || code.replace(/\s/g, '').length < 6} className="mt-3 w-full rounded-xl bg-violet-450 py-4 font-game text-xl font-bold text-white shadow-[0_4px_0_#5b3191] disabled:opacity-50">{busy ? <Spinner className="mx-auto h-6 w-6" /> : 'Join'}</button>
            {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">{err}</div>}
          </form>
        ) : (
          <div className="w-full max-w-md space-y-3">
            <div className="text-center font-game text-xl font-bold text-white">{session.title}</div>
            <form onSubmit={join} className="game-panel p-4">
              <div className="mb-3 flex flex-col items-center gap-2">
                <Avatar avatar={avatar} name={name} size={84} />
                <div className="flex max-w-xs flex-wrap justify-center gap-1">
                  {AVATARS.slice(0, 12).map((a) => <button type="button" key={a} onClick={() => setAvatar(a)} className={`rounded-full p-0.5 ${a === avatar ? 'ring-2 ring-white' : 'opacity-70 hover:opacity-100'}`}><Avatar avatar={a} size={30} /></button>)}
                </div>
              </div>
              <label className="mb-1 block text-sm font-semibold text-white/90">Your Wayground name is…</label>
              <div className="flex overflow-hidden rounded-xl bg-white">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus placeholder="Enter your name" className="flex-1 px-4 py-3 font-game text-lg font-bold outline-none" />
                <button type="button" title="Random name" onClick={() => setName(randomName())} className="border-l border-slate-200 px-3 text-slate-500 hover:bg-slate-50"><RefreshCw className="h-5 w-5" /></button>
              </div>
              <button disabled={busy} className="mt-3 w-full rounded-xl bg-emerald-500 py-3 font-game text-xl font-bold text-white shadow-[0_4px_0_#047857] disabled:opacity-60">{busy ? <Spinner className="mx-auto h-6 w-6" /> : 'Start'}</button>
              {err && <div className="mt-3 rounded-lg bg-red-500/90 px-3 py-2 text-center text-sm font-semibold text-white">{err}</div>}
              {saved && (
                <button type="button" onClick={() => nav(`/play/${JSON.parse(saved).token}`)} className="mt-3 w-full rounded-xl bg-white/10 py-2 text-sm font-semibold text-white">Continue as {JSON.parse(saved).name}</button>
              )}
            </form>
            <div className="game-panel p-4">
              <div className="mb-2 text-sm font-semibold text-white/80">Settings</div>
              <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-white"><span className="flex items-center gap-2"><Volume2 className="h-4 w-4" />Sound effects</span><Toggle checked={sound} onChange={setSound} /></div>
            </div>
            <button onClick={() => { setSession(null); nav('/join'); }} className="mx-auto flex items-center gap-1 text-sm text-white/60 hover:text-white"><X className="h-4 w-4" />Use a different code</button>
          </div>
        )}
      </div>
    </div>
  );
}
