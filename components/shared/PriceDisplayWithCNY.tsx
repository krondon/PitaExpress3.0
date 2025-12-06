"use client";

import React from 'react';
import { PriceDisplay } from './PriceDisplay';
import { useCNYConversion } from '@/hooks/use-cny-conversion';

interface PriceDisplayWithCNYProps {
  amount: number;
  currency?: 'USD' | 'CNY';
  variant?: 'default' | 'inline' | 'card' | 'large';
  showCNY?: boolean;
  className?: string;
}

export const PriceDisplayWithCNY: React.FC<PriceDisplayWithCNYProps> = ({
  amount,
  currency = 'USD',
  variant = 'default',
  showCNY = true,
  className = ''
}) => {
  const { formatCNYPrice, loading: cnyLoading, cnyRate, error } = useCNYConversion();

  // Debug logs


  // Si no es USD o no queremos mostrar CNY, usar el componente original SIN Bolívares
  if (currency !== 'USD' || !showCNY) {
    return (
      <PriceDisplay
        amount={amount}
        currency={currency === 'CNY' ? 'USD' : currency}
        variant={variant === 'large' ? 'card' : variant}
        className={className}
        showBoth={false} // CRÍTICO: No mostrar Bolívares en China
      />
    );
  }

  // Renderizar según la variante
  switch (variant) {
    case 'inline':
      return (
        <span className={`inline-flex items-center gap-1 ${className}`}>
          <PriceDisplay amount={amount} currency="USD" variant="inline" showBoth={false} />
          {showCNY && (
            <span className="text-xs text-red-600 font-medium">
              [{cnyLoading ? '...' : formatCNYPrice(amount)}]
            </span>
          )}
        </span>
      );

    case 'card':
      return (
        <div className={`space-y-1 ${className}`}>
          <PriceDisplay amount={amount} currency="USD" variant="card" showBoth={false} />
          {showCNY && (
            <div className="text-sm text-red-600 font-medium">
              {cnyLoading ? 'Cargando CNY...' : formatCNYPrice(amount)}
            </div>
          )}
        </div>
      );

    case 'large':
      return (
        <div className={`space-y-2 ${className}`}>
          <PriceDisplay amount={amount} currency="USD" variant="card" showBoth={false} />
          {showCNY && (
            <div className="text-lg text-red-600 font-semibold">
              {cnyLoading ? 'Cargando CNY...' : formatCNYPrice(amount)}
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className={`space-y-1 ${className}`}>
          <PriceDisplay amount={amount} currency="USD" variant="default" showBoth={false} />
          {showCNY && (
            <div className="text-sm text-red-600 font-medium">
              {cnyLoading ? 'Cargando CNY...' : formatCNYPrice(amount)}
            </div>
          )}
        </div>
      );
  }
};
