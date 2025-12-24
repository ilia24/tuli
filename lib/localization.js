import enTranslations from '../locales/en.json';
import roTranslations from '../locales/ro.json';
import ptTranslations from '../locales/pt.json';
import esTranslations from '../locales/es.json';
import plTranslations from '../locales/pl.json';

const translations = {
  en: enTranslations,
  ro: roTranslations,
  pt: ptTranslations,
  es: esTranslations,
  pl: plTranslations,
};

export const getTranslations = (locale = 'en') => {
  return translations[locale] || translations.en;
};

export const getNestedTranslation = (translations, key) => {
  return key.split('.').reduce((obj, k) => obj?.[k], translations);
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ro', name: 'Romanian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'es', name: 'Spanish' },
  { code: 'pl', name: 'Polish' },
];

