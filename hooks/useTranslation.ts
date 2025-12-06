"use client";
type TranslationOptions = Record<string, any> & { fallback?: string };
export type TFunction = (key: string, options?: TranslationOptions) => string;

import { useLanguage } from '@/lib/LanguageContext';
import esTranslations from '@/lib/translations/es.json';
import enTranslations from '@/lib/translations/en.json';
import zhTranslations from '@/lib/translations/zk.json';

type TranslationKey = string;

const translations = {
  es: esTranslations,
  en: enTranslations,
  zh: zhTranslations
};

export function useTranslation() {
  const { language } = useLanguage();

  const t = (key: TranslationKey, options?: TranslationOptions): string => {
    const keys = key.split('.');
    let current: any = translations[language];
    let usedLanguage = language;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        // Fallback al español si no se encuentra la traducción
        current = translations.es;
        usedLanguage = 'es';
        for (const fallbackKey of keys) {
          if (current && typeof current === 'object' && fallbackKey in current) {
            current = current[fallbackKey];
          } else {

            return typeof options?.fallback === 'string' ? options.fallback : key;
          }
        }
        break;
      }
    }

    let result = typeof current === 'string' ? current : key;

    const fallbackText = options?.fallback;
    const interpolationEntries = options
      ? Object.entries(options).filter(([k]) => k !== 'fallback')
      : [];

    // Interpolación de variables en la cadena
    interpolationEntries.forEach(([k, v]) => {
      const pattern = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
      result = result.replace(pattern, String(v));
    });

    if (result === key && typeof fallbackText === 'string') {
      return fallbackText;
    }


    return result;
  };

  return { t, language };
}
