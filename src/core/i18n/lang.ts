/** The two languages the explorer ships with. */
export type Lang = 'en' | 'fa';

/** A string that exists in every supported language. */
export interface Term {
  en: string;
  fa: string;
}

/** Pick the text for one language. */
export function term(value: Term, lang: Lang): string {
  return value[lang];
}

export function isRtl(lang: Lang): boolean {
  return lang === 'fa';
}

/**
 * Replace `{name}` placeholders in a translated template.
 * Unknown placeholders are left untouched so a typo is visible instead of
 * silently producing an empty string.
 */
export function fill(
  template: string,
  params?: Record<string, string | number | undefined>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
