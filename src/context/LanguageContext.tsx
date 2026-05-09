import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

type Lang = 'en' | 'hi';

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  setLang: (lang: Lang) => void;
  t: (en: string, hi: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  toggleLang: () => {},
  setLang: () => {},
  t: (en) => en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('veyron:lang');
    if (saved === 'en' || saved === 'hi') setLangState(saved);
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    localStorage.setItem('veyron:lang', next);
  };

  const toggleLang = () => setLang(lang === 'en' ? 'hi' : 'en');

  const t = useMemo(() => {
    return (en: string, hi: string) => (lang === 'en' ? en : hi);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
