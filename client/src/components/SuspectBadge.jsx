import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** "Possible duplicate" marker; the tooltip lists the other names (hidden when names are anonymized). */
export default function SuspectBadge({ suspect, dark = false, hideNames = false }) {
  const { t } = useTranslation('report');
  if (!suspect) return null;
  const lines = hideNames ? [] : [
    suspect.sameDevice?.length && t('suspect.sameDevice', { names: suspect.sameDevice.join(', ') }),
    suspect.similarName?.length && t('suspect.similarName', { names: suspect.similarName.join(', ') }),
  ].filter(Boolean);
  return (
    <span
      title={[t('suspect.badge'), ...lines].join('\n')}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 text-[10px] font-bold uppercase ${dark ? 'bg-amber-400/20 text-amber-300' : 'bg-amber-50 text-amber-700'}`}
    ><TriangleAlert className="h-3 w-3" />{t('suspect.badge')}</span>
  );
}
