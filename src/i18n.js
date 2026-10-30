import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

// English ships in the main bundle (it is also the fallback); every other language is a separate
// file loaded when chosen. The last language used is remembered so it can load before the first screen.
const LAST_LANGUAGE_KEY = 'auratrack_language';
const loaders = import.meta.glob(['./locales/*.json', '!./locales/en.json'], { import: 'default' });

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

async function loadLanguage(lng) {
  if (!lng || lng === 'en' || i18n.hasResourceBundle(lng, 'translation')) return;
  const load = loaders[`./locales/${lng}.json`];
  if (load) i18n.addResourceBundle(lng, 'translation', await load(), true, true);
}

// Switch language, loading its translations first
export async function setLanguage(lng) {
  try {
    await loadLanguage(lng);
  } catch (err) {
    console.error(`Could not load language "${lng}":`, err);
    return;
  }
  try { localStorage.setItem(LAST_LANGUAGE_KEY, lng); } catch { /* private browsing */ }
  if (i18n.language !== lng) await i18n.changeLanguage(lng);
}

// Before the first render: the language used last time, so the app doesn't flash English
export function restoreLastLanguage() {
  let lng = null;
  try { lng = localStorage.getItem(LAST_LANGUAGE_KEY); } catch { /* private browsing */ }
  return lng && lng !== 'en' ? setLanguage(lng) : Promise.resolve();
}

export default i18n;
