import { defaultLang, type Language, type TranslationKey, type TranslationData, loadTranslations } from './index';

export function getLangFromUrl(url: URL): Language {
  const [, lang] = url.pathname.split('/');
  // Check if lang is a valid language key
  const validLangs: Language[] = ['de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'tr', 'it', 'ar', 'th', 'vi', 'id', 'zh-CN', 'zh-TW'];
  if (validLangs.includes(lang as Language)) {
    return lang as Language;
  }
  return defaultLang;
}

/**
 * Create a translation function from translation data
 * @param translationData - The loaded translation data for a specific language
 * @returns A translation function
 */
export function useTranslations(translationData: TranslationData) {
  return function t(key: TranslationKey, params?: Record<string, string>): string {
    let text = translationData[key] || key;

    // Replace placeholders with params
    if (params) {
      Object.keys(params).forEach(paramKey => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), params[paramKey]);
      });
    }

    return text;
  }
}

/**
 * Async helper to load translations and create a translation function
 * @param lang - The language to load
 * @returns A translation function
 */
export async function useTranslationsAsync(lang: Language) {
  const translationData = await loadTranslations(lang);
  return useTranslations(translationData);
}

/**
 * Get the localized URL path
 * English (default lang) has no prefix, other languages have /{lang}/ prefix
 * @param path - The path without language prefix (e.g., '/tools/building')
 * @param lang - The language code
 * @returns The localized path
 */
export function getLocalizedPath(path: string, lang: Language): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // English (default) has no prefix
  if (lang === defaultLang) {
    return `/${cleanPath}`;
  }

  // Other languages have /{lang}/ prefix
  return `/${lang}/${cleanPath}`;
}

/**
 * Get the current month name in the specified language
 * @param lang - The language code
 * @returns The localized month name
 */
export function getCurrentMonth(lang: Language): string {
  const date = new Date();
  const monthNames: Record<Language, string[]> = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
    es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    pt: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
    ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    'zh-CN': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    'zh-TW': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
    tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    vi: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
  };
  return monthNames[lang][date.getMonth()];
}

/**
 * Get the current year
 * @returns The current year as a string
 */
export function getCurrentYear(): string {
  return new Date().getFullYear().toString();
}
