import type { Language } from "@pepo/types/model";
import { createContext,useContext,useMemo,type ReactNode } from "react";
import { translate,type TranslationKey } from "./catalog";
import { translateCopy } from "./copy";
type Value = {
  language: Language;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  text: (source: string) => string;
};
const make = (language: Language): Value => ({
  language,
  t: (key, params) => translate(language, key, params),
  text: (source) => translateCopy(language, source),
});
const Context = createContext<Value>(make("fr"));
export const useI18n = () => useContext(Context);
export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const value = useMemo(() => make(language), [language]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
