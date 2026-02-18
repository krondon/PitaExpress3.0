"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = 'es' | 'en' | 'zh';

export type LanguageContextType = {
  language: Language;
  committedLanguage: Language;
  /** Mientras sea false, usar 'es' para evitar hydration mismatch (servidor y primer paint en cliente iguales). */
  mounted: boolean;
  previewLanguage: (lang: Language) => void;
  commitLanguage: (lang: Language) => void;
  revertLanguage: () => void;
  setLanguage: (lang: Language) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('es');
  const [committedLanguage, setCommittedLanguage] = useState<Language>('es');
  const [mounted, setMounted] = useState(false);

  // 1) Marcar como montado después del primer paint para que la hidratación vea siempre mounted=false.
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2) Solo después de montar, leer localStorage y actualizar idioma (evita mismatch en Strict Mode).
  useEffect(() => {
    if (!mounted) return;
    const savedLanguage = localStorage.getItem('pita-language') as Language;
    if (savedLanguage && ['es', 'en', 'zh'].includes(savedLanguage)) {
      setLanguageState(savedLanguage);
      setCommittedLanguage(savedLanguage);
    }
  }, [mounted]);
  // Preview (no persistir)
  const previewLanguage = (lang: Language) => {

    setLanguageState(lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  };

  // Commit (persistir en localStorage)
  const commitLanguage = (lang: Language) => {

    setLanguageState(lang);
    setCommittedLanguage(lang);
    localStorage.setItem('pita-language', lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }

  };

  const revertLanguage = () => {

    setLanguageState(committedLanguage);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = committedLanguage;
    }
  };

  // No renderizar hasta que se monte para evitar hidration mismatch
  // Mantener el Provider en el árbol desde el primer render para que los
  // consumidores (hooks) no fallen si acceden al contexto antes de que
  // hayamos leído localStorage. No devolvemos null aquí; en su lugar
  // sincronizamos `document.documentElement.lang` una vez montado.

  useEffect(() => {
    if (mounted && typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [mounted, language]);

  return (
    <LanguageContext.Provider value={{ language, committedLanguage, mounted, previewLanguage, commitLanguage, revertLanguage, setLanguage: commitLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
