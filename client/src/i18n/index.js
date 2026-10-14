import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Every locales/<lang>/<namespace>.json file is picked up automatically.
const files = import.meta.glob('./locales/*/*.json', { eager: true });
const resources = {};
for (const [path, mod] of Object.entries(files)) {
  const [, lng, ns] = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  (resources[lng] ||= {})[ns] = mod.default;
}

export const LANGS = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: LANGS.map((l) => l.code),
    load: 'languageOnly', // vi-VN -> vi
    ns: Object.keys(resources.en || {}),
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'wg_lang', caches: ['localStorage'] },
  });

const setHtmlLang = (l) => { document.documentElement.lang = l || 'en'; };
setHtmlLang(i18n.resolvedLanguage);
i18n.on('languageChanged', () => setHtmlLang(i18n.resolvedLanguage));

/** Current UI language code ('en' | 'vi'). */
export const lang = () => i18n.resolvedLanguage || 'en';

/** Locale-aware date formatting. */
export const fmtDate = (d, opts) => new Date(d).toLocaleString(lang(), opts);
export const fmtDay = (d, opts) => new Date(d).toLocaleDateString(lang(), opts);

/** Display labels for values stored in English (subject, grade, quiz language). */
export const subjectLabel = (s) => (s ? i18n.t(`subjects.${s}`, { ns: 'common', defaultValue: s }) : s);
export const gradeLabel = (g) => (g ? i18n.t(`grades.${g}`, { ns: 'common', defaultValue: g }) : g);
export const languageLabel = (l) => (l ? i18n.t(`languages.${l}`, { ns: 'common', defaultValue: l }) : l);

/** Question type texts; keys: label, desc, graded. */
export const qtypeText = (type, key = 'label') => i18n.t(`${type}.${key}`, { ns: 'qtypes', defaultValue: '' });
export const qgroupLabel = (g) => i18n.t(`groups.${g}`, { ns: 'qtypes', defaultValue: g });

export default i18n;
