"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type FontSize = 'small' | 'medium' | 'large';

export type FontSizeContextType = {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
};

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export const useFontSize = () => {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error("useFontSize must be used within a FontSizeProvider");
  }
  return context;
};

export const FontSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');
  const [mounted, setMounted] = useState(false);

  // Cargar tamaño de fuente desde localStorage al montar
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedFontSize = localStorage.getItem('pita-font-size') as FontSize;
    if (savedFontSize && ['small', 'medium', 'large'].includes(savedFontSize)) {
      setFontSizeState(savedFontSize);
      // Aplicar inmediatamente
      setTimeout(() => applyFontSizeClass(savedFontSize), 0);
    } else {
      // Aplicar medium por defecto
      setTimeout(() => applyFontSizeClass('medium'), 0);
    }
    setMounted(true);
  }, []);

  // Función para aplicar la clase CSS al elemento html
  const applyFontSizeClass = (size: FontSize) => {
    if (typeof document === 'undefined') return;

    const htmlElement = document.documentElement;

    // Remover todas las clases de escala anteriores
    htmlElement.classList.remove(
      'text-scale-80',
      'text-scale-100',
      'text-scale-150'
    );

    // Aplicar nueva clase según el tamaño
    switch (size) {
      case 'small':
        htmlElement.classList.add('text-scale-80'); // 80% = 12.8px
        break;
      case 'medium':
        htmlElement.classList.add('text-scale-100'); // 100% = 16px
        break;
      case 'large':
        htmlElement.classList.add('text-scale-150'); // 150% = 24px
        break;
    }

    // Debug: verificar que se aplicó

  };

  // Función para cambiar el tamaño de fuente
  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem('pita-font-size', size);
    applyFontSizeClass(size);
  };

  // Aplicar clase cuando cambia el fontSize
  useEffect(() => {
    if (mounted) {
      applyFontSizeClass(fontSize);
    }
  }, [fontSize, mounted]);

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
};

