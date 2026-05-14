import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import uz from './locales/uz/translation.json'
import ru from './locales/ru/translation.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      uz: { translation: uz },
      ru: { translation: ru },
    },
    // Detect from localStorage key 'bf_lang', then browser
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'bf_lang',
      caches: ['localStorage'],
    },
    fallbackLng: 'uz',
    supportedLngs: ['uz', 'ru'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
  })

export default i18n
