import { useTranslation } from 'react-i18next';

/** Render a student's raw answer in a human readable way, using the (full or sanitized) question. */
export function FormatAnswer({ q, answer, dark = false }) {
  const { t } = useTranslation('report');
  if (answer === null || answer === undefined || answer === '') return <span className={dark ? 'text-white/50' : 'text-slate-400'}>{t('noAnswer')}</span>;
  const opts = q.options || [];
  const optText = (id) => opts.find((o) => o.id === id)?.text ?? id;
  const media = (a) => {
    if (!a?.url) return null;
    if (a.mime?.startsWith('audio')) return <audio src={a.url} controls className="h-9 max-w-full" />;
    if (a.mime?.startsWith('video')) return <video src={a.url} controls className="max-h-48 rounded" />;
    return <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={t('drawing')} className="max-h-40 rounded border border-slate-200 bg-white" /></a>;
  };
  switch (q.type) {
    case 'mcq': case 'msq': case 'tf': case 'poll':
      return <span>{(Array.isArray(answer) ? answer : [answer]).map(optText).join(', ')}</span>;
    case 'reorder':
      return <span>{(answer || []).map(optText).join(' → ')}</span>;
    case 'match': {
      const lefts = q.lefts || opts.map((p) => ({ id: p.id, text: p.left }));
      const rights = q.rights || opts.map((p) => ({ id: p.id, text: p.right }));
      return <span>{lefts.map((l) => `${l.text} → ${rights.find((r) => r.id === answer[l.id])?.text ?? '–'}`).join('; ')}</span>;
    }
    case 'dropdown': {
      const blanks = q.blanks || opts;
      return <span>{blanks.map((b) => (b.choices || []).find((c) => c.id === answer[b.id])?.text ?? '–').join(', ')}</span>;
    }
    case 'dragdrop': case 'labeling': case 'tablefill':
      return <span>{Object.values(answer || {}).join(', ')}</span>;
    case 'categorize': {
      const cats = q.categories || q.extra?.categories || [];
      const items = q.items || opts;
      return <span>{items.map((i) => `${i.text}: ${cats.find((c) => c.id === answer[i.id])?.name ?? '–'}`).join('; ')}</span>;
    }
    case 'hottext': {
      const units = q.units || opts;
      return <span>{(answer || []).map((id) => units.find((u) => u.id === id)?.text ?? id).join(' … ')}</span>;
    }
    case 'matchgrid': {
      const rows = q.rows || opts;
      const cols = q.columns || q.extra?.columns || [];
      return <span>{rows.map((r) => `${r.text}: ${(answer[r.id] || []).map((c) => cols.find((x) => x.id === c)?.text).join('/') || '–'}`).join('; ')}</span>;
    }
    case 'hotspot':
      return <span>{t('areasSelected', { count: (answer || []).length })}</span>;
    case 'graphing':
      return <span>{(answer?.points || []).map((p) => `(${p[0]}, ${p[1]})`).join(', ')}</span>;
    case 'draw': case 'audio': case 'video':
      return media(answer);
    default:
      return <span className="whitespace-pre-wrap">{typeof answer === 'string' ? answer : JSON.stringify(answer)}</span>;
  }
}
