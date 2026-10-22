import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Full-screen view of one image. Click anywhere or press Escape to close. */
export function Lightbox({ src, alt = '', onClose }) {
  const { t } = useTranslation('ui');
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  // portal: parents with transforms (animate-pop) would otherwise trap the fixed overlay
  return createPortal(
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-[90] flex cursor-zoom-out items-center justify-center bg-black/80 p-4 animate-rise">
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-xl bg-white object-contain shadow-2xl" />
      <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white hover:bg-white/30"><X className="h-5 w-5" /></button>
    </div>,
    document.body,
  );
}

/** An image that opens in a lightbox when clicked. `hint` shows a zoom badge on hover. */
export function ZoomImage({ src, alt = '', className = '', wrapClassName = '', title, hint = true }) {
  const { t } = useTranslation('ui');
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} title={title ?? t('lightbox.zoom')} className={`group relative block max-w-full cursor-zoom-in ${wrapClassName}`}>
        <img src={src} alt={alt} className={className} />
        {hint && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 p-1 text-white opacity-0 transition group-hover:opacity-100"><ZoomIn className="h-3.5 w-3.5" /></span>}
      </button>
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
