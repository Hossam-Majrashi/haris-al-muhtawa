import arMessages from '../public/_locales/ar/messages.json';
import enMessages from '../public/_locales/en/messages.json';

import type { AppLanguage } from './types';

export type SupportedLanguage = string;

export const supportedLanguages: AppLanguage[] = [
  // 1
  { nativeLanguageName: 'Arabic', code: 'ar', isRtl: true },
  // 2
  { nativeLanguageName: 'English', code: 'en', isRtl: false },
  // 3
  { nativeLanguageName: 'Urdu', code: 'ur', isRtl: true },
  // 4
  { nativeLanguageName: 'Indonesian', code: 'id', isRtl: false },
  // 5
  { nativeLanguageName: 'Bengali', code: 'bn', isRtl: false },
  // 6
  { nativeLanguageName: 'Turkish', code: 'tr', isRtl: false },
  // 7
  { nativeLanguageName: 'Persian', code: 'fa', isRtl: true },
  // 8
  { nativeLanguageName: 'Malay', code: 'ms', isRtl: false },
  // 9
  { nativeLanguageName: 'Pashto', code: 'ps', isRtl: true },
  // 10
  { nativeLanguageName: 'Punjabi', code: 'pa', isRtl: false },
  // 11
  { nativeLanguageName: 'Sindhi', code: 'sd', isRtl: true },
  // 12
  { nativeLanguageName: 'Hindi', code: 'hi', isRtl: false },
  // 13
  { nativeLanguageName: 'Malayalam', code: 'ml', isRtl: false },
  // 14
  { nativeLanguageName: 'Tamil', code: 'ta', isRtl: false },
  // 15
  { nativeLanguageName: 'Telugu', code: 'te', isRtl: false },
  // 16
  { nativeLanguageName: 'Somali', code: 'so', isRtl: false },
  // 17
  { nativeLanguageName: 'Hausa', code: 'ha', isRtl: false },
  // 18
  { nativeLanguageName: 'Swahili', code: 'sw', isRtl: false },
  // 19
  { nativeLanguageName: 'Azerbaijani', code: 'az', isRtl: false },
  // 20
  { nativeLanguageName: 'Uzbek', code: 'uz', isRtl: false },
  // 21
  { nativeLanguageName: 'Kazakh', code: 'kk', isRtl: false },
  // 22
  { nativeLanguageName: 'Kyrgyz', code: 'ky', isRtl: false },
  // 23
  { nativeLanguageName: 'Bosnian', code: 'bs', isRtl: false },
  // 24
  { nativeLanguageName: 'French', code: 'fr', isRtl: false },
  // 25
  { nativeLanguageName: 'Russian', code: 'ru', isRtl: false },
  // 26
  { nativeLanguageName: 'German', code: 'de', isRtl: false },
  // 27
  { nativeLanguageName: 'Spanish', code: 'es', isRtl: false },
  // 28
  { nativeLanguageName: 'Italian', code: 'it', isRtl: false },
  // 29
  { nativeLanguageName: 'Portuguese', code: 'pt', isRtl: false },
  // 30
  { nativeLanguageName: 'Chinese (Simplified)', code: 'zh', isRtl: false },
  // 31
  { nativeLanguageName: 'Chinese (Traditional)', code: 'zh-TW', isRtl: false },
  // 32
  { nativeLanguageName: 'Japanese', code: 'ja', isRtl: false },
  // 33
  { nativeLanguageName: 'Korean', code: 'ko', isRtl: false },
  // 34
  { nativeLanguageName: 'Kurdish', code: 'ku', isRtl: true },
  // 35
  { nativeLanguageName: 'Gujarati', code: 'gu', isRtl: false },
  // 36
  { nativeLanguageName: 'Marathi', code: 'mr', isRtl: false },
  // 37
  { nativeLanguageName: 'Dutch', code: 'nl', isRtl: false },
  // 38
  { nativeLanguageName: 'Polish', code: 'pl', isRtl: false },
  // 39
  { nativeLanguageName: 'Romanian', code: 'ro', isRtl: false },
  // 40
  { nativeLanguageName: 'Greek', code: 'el', isRtl: false },
  // 41
  { nativeLanguageName: 'Amharic', code: 'am', isRtl: false },
  // 42
  { nativeLanguageName: 'Nepali', code: 'ne', isRtl: false },
  // 43
  { nativeLanguageName: 'Yoruba', code: 'yo', isRtl: false },
  // 44
  { nativeLanguageName: 'Filipino', code: 'fil', isRtl: false },
  // 45
  { nativeLanguageName: 'Burmese', code: 'my', isRtl: false },
  // 46
  { nativeLanguageName: 'Vietnamese', code: 'vi', isRtl: false },
  // 47
  { nativeLanguageName: 'Thai', code: 'th', isRtl: false },
  // 48
  { nativeLanguageName: 'Ukrainian', code: 'uk', isRtl: false },
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
