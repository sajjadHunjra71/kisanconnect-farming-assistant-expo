export type LanguageCode = 'en' | 'ur';

export type LanguageMeta = {
  code: LanguageCode;
  /** Name written in the language itself. */
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
};

/**
 * Add a language here + a locale file in ./locales and it appears in Settings.
 * Punjabi (Shahmukhi, 'pa-PK', rtl) is planned after the core app is complete.
 */
export const LANGUAGES: readonly LanguageMeta[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', dir: 'rtl' },
] as const;

export const getLanguage = (code: LanguageCode): LanguageMeta =>
  LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
