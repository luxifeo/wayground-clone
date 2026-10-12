import { useEffect, useState } from 'react';
import { Search, ImageIcon, ExternalLink } from 'lucide-react';
import { api } from '../lib/api.js';
import { Modal, Spinner, useToast } from './ui.jsx';

/**
 * Search free images (Wikimedia, Openverse, + Pixabay/Pexels/Unsplash when keys are configured).
 * onPick({ url, credit }) receives a local /uploads URL.
 */
export default function ImageSearchModal({ open, onClose, initialQuery = '', onPick }) {
  const toast = useToast();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState(null);
  const [providers, setProviders] = useState([]);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(null);
  const [broken, setBroken] = useState(() => new Set());

  const search = async (query = q) => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const d = await api(`/images/search?q=${encodeURIComponent(query)}&limit=24`);
      setResults(d.results); setProviders(d.providers);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  useEffect(() => {
    if (!open) return;
    setQ(initialQuery); setResults(null);
    if (initialQuery.trim()) search(initialQuery);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (r, i) => {
    setImporting(i);
    try {
      const d = await api('/images/import', { method: 'POST', body: { url: r.url, fallback: r.thumb } });
      onPick({ url: d.url, credit: { title: r.title, creator: r.creator, license: r.license, source: r.source, landing: r.landing } });
      onClose();
    } catch (e) { toast(e.message, 'error'); } finally { setImporting(null); }
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-4xl" title="Search images" icon={<ImageIcon className="h-5 w-5 text-violet-600" />}>
      <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search free images, e.g. “volcano diagram” (English works best)" className="input pl-9" />
        </div>
        <button className="btn-violet" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}Search</button>
      </form>
      <div className="mt-1 text-xs text-slate-400">Free sources: {providers.length ? providers.join(', ') : 'Wikimedia Commons, Openverse'} · Images are copied to your library with their license credit.</div>
      <div className="mt-4 min-h-[300px]">
        {busy && <div className="grid h-64 place-items-center"><Spinner className="h-8 w-8 text-slate-400" /></div>}
        {!busy && results && !results.length && <div className="grid h-64 place-items-center text-sm text-slate-500">No images found. Try other (English) keywords.</div>}
        {!busy && results && results.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {results.map((r, i) => (broken.has(r.url) ? null : (
              <button key={r.url} onClick={() => choose(r, i)} disabled={importing !== null} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
                <img
                  src={r.thumb || r.url} alt={r.title || ''} loading="lazy" className="h-32 w-full object-cover" referrerPolicy="no-referrer"
                  onError={(e) => { if (r.thumb && e.currentTarget.src !== r.url) e.currentTarget.src = r.url; else setBroken((b) => new Set(b).add(r.url)); }}
                />
                <div className="p-2">
                  <div className="truncate text-xs font-semibold text-slate-700">{r.title || 'Untitled'}</div>
                  <div className="truncate text-[10px] text-slate-400">{r.license} · {r.source}</div>
                </div>
                {importing === i && <div className="absolute inset-0 grid place-items-center bg-white/70"><Spinner className="h-6 w-6" /></div>}
                {r.landing && (
                  <a href={r.landing} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Open source page" className="absolute right-1.5 top-1.5 hidden rounded bg-black/50 p-1 text-white group-hover:block"><ExternalLink className="h-3 w-3" /></a>
                )}
              </button>
            )))}
          </div>
        )}
        {!busy && !results && <div className="grid h-64 place-items-center text-sm text-slate-400">Type keywords to find an illustration for your question.</div>}
      </div>
    </Modal>
  );
}

/** Small attribution line required by CC licences. */
export function ImageCredit({ credit, dark = false, className = '' }) {
  if (!credit) return null;
  const text = [credit.title && `“${credit.title}”`, credit.creator && `by ${credit.creator}`, credit.license].filter(Boolean).join(' · ');
  return (
    <div className={`truncate text-[10px] ${dark ? 'text-white/50' : 'text-slate-400'} ${className}`} title={text}>
      {credit.landing ? <a href={credit.landing} target="_blank" rel="noreferrer" className="hover:underline">{text}</a> : text}
    </div>
  );
}
