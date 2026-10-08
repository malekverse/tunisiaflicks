// A feature's own strings, in its own file under ./features, so several features can be built side
// by side without editing the same dictionary. English is the source of truth and Arabic must
// cover every key (tsc says so); Derja and French may leave keys out: Derja falls back to Arabic,
// French to English.
export type FeatureStrings<E extends Record<string, string>> = {
  en: E
  ar: { [K in keyof E]: string }
  tn?: { [K in keyof E]?: string }
  fr?: { [K in keyof E]?: string }
}

export function defineStrings<E extends Record<string, string>>(strings: FeatureStrings<E>): FeatureStrings<E> {
  return strings
}
