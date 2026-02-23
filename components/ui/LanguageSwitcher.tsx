"use client";

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from 'next-themes';

interface LanguageSwitcherProps {
  position?: 'fixed-bottom-right' | 'inline';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ position = 'fixed-bottom-right', className }) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const containerClasses = position === 'fixed-bottom-right' 
    ? `fixed bottom-4 right-4 z-50 flex gap-2 items-center px-3 py-2 rounded-lg text-sm backdrop-blur-md shadow-lg transition-colors ${
        mounted && theme === 'dark' 
          ? 'bg-slate-800/80 border border-slate-700 text-slate-200' 
          : 'bg-white/85 border border-slate-200 text-slate-700'
      }`
    : 'flex gap-2 items-center';

  const selectClasses = `px-2 py-1 rounded border cursor-pointer transition-colors ${
    mounted && theme === 'dark'
      ? 'bg-slate-700 border-slate-600 text-slate-200'
      : 'bg-white border-slate-300 text-slate-700'
  }`;

  const labelClasses = `font-medium flex items-center gap-1 ${
    mounted && theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
  }`;

  return (
    <div className={`${containerClasses} ${className || ''}`}>
      <label htmlFor="lang-switch" className={labelClasses} suppressHydrationWarning>
        {t('auth.common.languageLabel')}
      </label>
      <select
        id="lang-switch"
        value={language}
        onChange={(e) => {
          const value = e.target.value as 'es' | 'en' | 'zh';
          setLanguage(value);
          fetch('/api/profile/preferred-language', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: value }),
          }).catch(() => {});
        }}
        className={selectClasses}
      >
        <option value="es">🇪🇸 Español</option>
        <option value="en">🇬🇧 English</option>
        <option value="zh">🇨🇳 中文</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;
