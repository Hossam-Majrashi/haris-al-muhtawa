import arMessages from '../public/_locales/ar/messages.json';
import enMessages from '../public/_locales/en/messages.json';

import type { AppLanguage } from './types';

export type SupportedLanguage = string;

export const supportedLanguages: AppLanguage[] = [
  // 1. Arabic (Always first)
  { nativeLanguageName: 'العربية (Arabic)', code: 'ar', isRtl: true },

  // Remaining languages sorted alphabetically (A-Z)
  { nativeLanguageName: 'Amharic', code: 'am', isRtl: false },
  { nativeLanguageName: 'Azerbaijani', code: 'az', isRtl: false },
  { nativeLanguageName: 'Bengali', code: 'bn', isRtl: false },
  { nativeLanguageName: 'Bosnian', code: 'bs', isRtl: false },
  { nativeLanguageName: 'Burmese', code: 'my', isRtl: false },
  { nativeLanguageName: 'Chinese (Simplified)', code: 'zh', isRtl: false },
  { nativeLanguageName: 'Chinese (Traditional)', code: 'zh-TW', isRtl: false },
  { nativeLanguageName: 'Dutch', code: 'nl', isRtl: false },
  { nativeLanguageName: 'English', code: 'en', isRtl: false },
  { nativeLanguageName: 'Filipino', code: 'fil', isRtl: false },
  { nativeLanguageName: 'French', code: 'fr', isRtl: false },
  { nativeLanguageName: 'German', code: 'de', isRtl: false },
  { nativeLanguageName: 'Greek', code: 'el', isRtl: false },
  { nativeLanguageName: 'Gujarati', code: 'gu', isRtl: false },
  { nativeLanguageName: 'Hausa', code: 'ha', isRtl: false },
  { nativeLanguageName: 'Hindi', code: 'hi', isRtl: false },
  { nativeLanguageName: 'Indonesian', code: 'id', isRtl: false },
  { nativeLanguageName: 'Italian', code: 'it', isRtl: false },
  { nativeLanguageName: 'Japanese', code: 'ja', isRtl: false },
  { nativeLanguageName: 'Kazakh', code: 'kk', isRtl: false },
  { nativeLanguageName: 'Korean', code: 'ko', isRtl: false },
  { nativeLanguageName: 'Kurdish', code: 'ku', isRtl: true },
  { nativeLanguageName: 'Kyrgyz', code: 'ky', isRtl: false },
  { nativeLanguageName: 'Malay', code: 'ms', isRtl: false },
  { nativeLanguageName: 'Malayalam', code: 'ml', isRtl: false },
  { nativeLanguageName: 'Marathi', code: 'mr', isRtl: false },
  { nativeLanguageName: 'Nepali', code: 'ne', isRtl: false },
  { nativeLanguageName: 'Pashto', code: 'ps', isRtl: true },
  { nativeLanguageName: 'Persian', code: 'fa', isRtl: true },
  { nativeLanguageName: 'Polish', code: 'pl', isRtl: false },
  { nativeLanguageName: 'Portuguese', code: 'pt', isRtl: false },
  { nativeLanguageName: 'Punjabi', code: 'pa', isRtl: false },
  { nativeLanguageName: 'Romanian', code: 'ro', isRtl: false },
  { nativeLanguageName: 'Russian', code: 'ru', isRtl: false },
  { nativeLanguageName: 'Sindhi', code: 'sd', isRtl: true },
  { nativeLanguageName: 'Somali', code: 'so', isRtl: false },
  { nativeLanguageName: 'Spanish', code: 'es', isRtl: false },
  { nativeLanguageName: 'Swahili', code: 'sw', isRtl: false },
  { nativeLanguageName: 'Tamil', code: 'ta', isRtl: false },
  { nativeLanguageName: 'Telugu', code: 'te', isRtl: false },
  { nativeLanguageName: 'Thai', code: 'th', isRtl: false },
  { nativeLanguageName: 'Turkish', code: 'tr', isRtl: false },
  { nativeLanguageName: 'Ukrainian', code: 'uk', isRtl: false },
  { nativeLanguageName: 'Urdu', code: 'ur', isRtl: true },
  { nativeLanguageName: 'Uzbek', code: 'uz', isRtl: false },
  { nativeLanguageName: 'Vietnamese', code: 'vi', isRtl: false },
  { nativeLanguageName: 'Yoruba', code: 'yo', isRtl: false },
];

/**
 * Checks if a language code uses Right-to-Left (RTL) text direction.
 */
export function isRtlLanguage(code: string): boolean {
  const found = supportedLanguages.find((l) => l.code.toLowerCase() === code.toLowerCase());
  if (found) return found.isRtl;
  const clean = code.toLowerCase().split('-')[0];
  return (
    clean === 'ar' ||
    clean === 'fa' ||
    clean === 'ur' ||
    clean === 'ps' ||
    clean === 'sd' ||
    clean === 'ku'
  );
}

/**
 * Detect default system/browser language.
 * Defaults to 'ar' if browser language starts with 'ar', otherwise checks navigator.
 */
export function getBrowserLanguage(): SupportedLanguage {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language?.toLowerCase() || '';
    const match = supportedLanguages.find(
      (l) => l.code.toLowerCase() === lang || lang.startsWith(l.code.toLowerCase())
    );
    if (match) return match.code;
  }
  return 'ar';
}

const localeCache: Record<string, Record<string, { message: string }>> = {
  ar: arMessages,
  en: enMessages,
};

/**
 * Preload translation dictionary for a specific language.
 */
export async function loadLanguageMessages(lang: SupportedLanguage): Promise<void> {
  if (localeCache[lang]) return;
  try {
    if (typeof browser !== 'undefined' && browser.runtime?.getURL) {
      const getUrl = browser.runtime.getURL as (path: string) => string;
      const res = await fetch(getUrl(`_locales/${lang}/messages.json`));
      if (res.ok) {
        localeCache[lang] = await res.json();
        return;
      }
      const alt = lang.includes('-') ? lang.replace(/-/g, '_') : lang.replace(/_/g, '-');
      const resAlt = await fetch(getUrl(`_locales/${alt}/messages.json`));
      if (resAlt.ok) {
        localeCache[lang] = await resAlt.json();
      }
    }
  } catch {
    // Ignore fallback
  }
}

/**
 * Get localized string by key with optional variable replacements.
 * Supports {key} interpolation (e.g. {count}).
 */
export function t(
  key: string,
  lang: SupportedLanguage = 'ar',
  replacements?: Record<string, string | number>
): string {
  const isRtl = isRtlLanguage(lang);
  let text = localeCache[lang]?.[key]?.message;

  if (!text) {
    const primaryDict = (lang === 'ar' || isRtl) ? arMessages : enMessages;
    const secondaryDict = primaryDict === arMessages ? enMessages : arMessages;
    text = (primaryDict as Record<string, { message: string }>)[key]?.message
      || (secondaryDict as Record<string, { message: string }>)[key]?.message;
  }

  if (!text) {
    // Fallback to browser.i18n if available
    try {
      if (typeof browser !== 'undefined' && browser.i18n?.getMessage) {
        text = (browser.i18n.getMessage as any)(key);
      }
    } catch {
      // Ignore
    }
  }

  if (!text) return key;

  if (replacements) {
    for (const [rKey, rVal] of Object.entries(replacements)) {
      text = text.replace(new RegExp(`\\{${rKey}\\}`, 'g'), String(rVal));
    }
  }

  return text;
}
