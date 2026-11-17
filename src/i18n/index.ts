import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { setAppLocale } from '@/lib/locale';

import { deviceLanguage, languageInfo, type Language } from './languages';
import { strings } from './strings';
import { createTranslator, fill } from './translate';

export { LANGUAGES, type Language } from './languages';

type LanguageState = {
  /** Null until the person picks one: then the phone's language decides. */
  choice: Language | null;
  setLanguage: (language: Language) => void;
};

/** The app's language. Kept on the device, like Appearance, so it's per phone. */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      choice: null,
      setLanguage: (choice) => {
        setAppLocale(languageInfo(choice).locale);
        set({ choice });
      },
    }),
    {
      name: 'corefit-language',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        setAppLocale(languageInfo(state?.choice ?? deviceLanguage()).locale);
      },
    },
  ),
);

const fallback = deviceLanguage();
setAppLocale(languageInfo(fallback).locale);

export function currentLanguage(): Language {
  return useLanguageStore.getState().choice ?? fallback;
}

/** The language on screen; re-renders when it changes. */
export function useLanguage(): Language {
  return useLanguageStore((s) => s.choice) ?? fallback;
}

const translators = new Map<Language, (text: string) => string>();

/** Translates text into a given language. English, and text with no translation, stay as is. */
export function translateTo(language: Language, text: string): string {
  const column = languageInfo(language).column;
  if (column === null) return text;
  let tr = translators.get(language);
  if (!tr) {
    tr = createTranslator(strings, column);
    translators.set(language, tr);
  }
  return tr(text);
}

export type Values = Record<string, string | number | null | undefined>;

/**
 * Translates English text into the app's language, filling `{name}` slots from `values`.
 * `ThemedText` already translates what it shows, so call this only for text that doesn't go
 * through it: header titles, tab names, alerts, placeholders.
 */
export function t(text: string, values?: Values): string {
  const out = translateTo(currentLanguage(), text);
  return values ? fill(out, values) : out;
}

/** `t`, re-rendering the component when the language changes. */
export function useT() {
  const language = useLanguage();
  return useCallback(
    (text: string, values?: Values) => {
      const out = translateTo(language, text);
      return values ? fill(out, values) : out;
    },
    [language],
  );
}
