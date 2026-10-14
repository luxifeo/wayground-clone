import { useEffect, useLayoutEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { avatarBg } from '../lib/constants.js';

export function Logo({ dark = false, small = false }) {
  const { t } = useTranslation('ui');
  return (
    <div className="flex flex-col leading-none">
      <div className={`flex items-center gap-1 font-black italic tracking-tight ${small ? 'text-lg' : 'text-2xl'} ${dark ? 'text-white' : 'text-brand-500'}`}>
        <LogoMark className={small ? 'h-5 w-5' : 'h-6 w-6'} color={dark ? '#fff' : '#e8237d'} />
        WAYGROUND
      </div>
      <span className={`self-end text-[10px] font-semibold ${dark ? 'text-white/80' : 'text-slate-600'}`}>{t('logoTagline')}</span>
    </div>
  );
}

export function LogoMark({ className = 'h-6 w-6', color = '#e8237d' }) {
  return (
    <svg viewBox="0 0 40 32" className={className} fill={color}>
      <path d="M2 6h6l3 22H6zM13 2h6l2 26h-6zM24 8l12-4-5 24h-6z" />
    </svg>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function Modal({ open, onClose, title, icon, children, footer, width = 'max-w-lg', dark = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  const { t } = useTranslation('ui');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-rise" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`w-full ${width} max-h-[92vh] overflow-auto rounded-2xl ${dark ? 'bg-game-800 text-white' : 'bg-white'} shadow-2xl scrollbar-thin`}>
        {(title || onClose) && (
          <div className="flex items-center justify-between px-5 pt-4">
            <div className="flex items-center gap-2 text-lg font-bold">{icon}{title}</div>
            {onClose && <button onClick={onClose} className="rounded-full p-1 hover:bg-black/10" aria-label={t('common:actions.close')}><X className="h-5 w-5" /></button>}
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)} type="button" onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${value === o.value ? 'border-slate-800 bg-white text-slate-900 ring-1 ring-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
        >{o.label}</button>
      ))}
    </div>
  );
}

/** Dropdown menu anchored to its trigger. */
/** Dropdown rendered in a portal so overflow-hidden / scrolling parents never clip it. */
export function Menu({ trigger, children, align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  // place under the trigger, or above it when there is no room below
  useLayoutEffect(() => {
    if (!open || !ref.current || !menuRef.current) { setPos(null); return; }
    const t = ref.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const below = t.bottom + 4 + m.height <= window.innerHeight - 8;
    const top = below ? t.bottom + 4 : Math.max(8, t.top - 4 - m.height);
    const left = align === 'right' ? Math.max(8, t.right - m.width) : Math.min(t.left, window.innerWidth - m.width - 8);
    setPos({ top, left, up: !below });
  }, [open, align]);
  return (
    <div className={`relative ${className}`} ref={ref} onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          className={`z-[60] min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-700 shadow-xl ${pos?.up ? '' : 'animate-rise'}`}
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        >{children}</div>,
        document.body,
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, danger, sub }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-slate-50 ${danger ? 'text-red-600' : ''}`}>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="flex flex-col"><span className="font-medium">{children}</span>{sub && <span className="text-xs text-slate-400">{sub}</span>}</span>
    </button>
  );
}

/** Simple select styled like Wayground's dropdowns. */
export function Select({ value, onChange, options, placeholder, icon: Icon, className = '', error }) {
  const { t } = useTranslation('ui');
  return (
    <div className={`relative ${className}`}>
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />}
      <select
        value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
        className={`input appearance-none pr-8 ${Icon ? 'pl-9' : ''} ${error ? 'border-red-400' : ''} ${!value ? 'text-slate-500' : ''}`}
      >
        <option value="">{placeholder ?? t('select.placeholder')}</option>
        {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

export function Avatar({ avatar, name, size = 36 }) {
  const a = avatar || '🙂';
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: avatarBg(a + (name || '')), fontSize: size * 0.58 }}
      title={name}
    >{a}</span>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-500">
      {Icon && <Icon className="h-10 w-10 text-slate-300" />}
      <div className="font-semibold text-slate-700">{title}</div>
      <div className="max-w-sm text-sm">{children}</div>
    </div>
  );
}

// ---------- toasts
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'info') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-xl animate-rise ${t.kind === 'error' ? 'bg-red-600' : t.kind === 'success' ? 'bg-emerald-600' : 'bg-slate-800'}`}>
            {t.kind === 'success' && <Check className="h-4 w-4" />}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function QuizThumb({ quiz, size = 48 }) {
  const img = quiz?.cover_image || quiz?.first_image;
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50" style={{ width: size, height: size }}>
      {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <LogoMark className="h-1/2 w-1/2" color="#334155" />}
    </div>
  );
}
