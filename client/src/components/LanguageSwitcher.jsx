import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGS } from '../i18n/index.js';

/** EN / VI toggle. `dark` for game screens with a coloured background. */
export default function LanguageSwitcher({ dark = false, className = '' }) {
  const { i18n, t } = useTranslation();
  const cur = i18n.resolvedLanguage;
  return (
    <div
      title={t('language')}
      className={`inline-flex items-center gap-0.5 rounded-lg p-0.5 text-xs font-bold ${dark ? 'bg-black/30 text-white' : 'border border-slate-200 bg-white text-slate-600'} ${className}`}
    >
      <Languages className={`mx-1 h-3.5 w-3.5 ${dark ? 'text-white/70' : 'text-slate-400'}`} />
      {LANGS.map((l) => (
        <button
          key={l.code} type="button" onClick={() => i18n.changeLanguage(l.code)} title={l.label}
          className={`rounded-md px-2 py-1 ${cur === l.code ? (dark ? 'bg-white text-slate-800' : 'bg-slate-800 text-white') : (dark ? 'hover:bg-white/10' : 'hover:bg-slate-100')}`}
        >{l.short}</button>
      ))}
    </div>
  );
}
