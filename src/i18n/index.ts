import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import ja from './locales/ja';
import ko from './locales/ko';
import pt from './locales/pt';
import tr from './locales/tr';
import it from './locales/it';
import ar from './locales/ar';
import th from './locales/th';
import vi from './locales/vi';
import id from './locales/id';
import zhCN from './locales/zh-CN';
import zhTW from './locales/zh-TW';

export const languages = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  ko: '한국어',
  th: 'ไทย',
  ja: '日本語',
  pt: 'Português',
  es: 'Español',
  tr: 'Türkçe',
  id: 'Indonesia',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  it: 'Italiano',
  ar: 'العربية',
  vi: 'Tiếng Việt',
} as const;

export const defaultLang = 'en';

export const translations = {
  de,
  en,
  es,
  fr,
  ja,
  ko,
  pt,
  tr,
  it,
  ar,
  th,
  vi,
  id,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations[typeof defaultLang];
