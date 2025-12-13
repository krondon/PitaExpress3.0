-- ==========================================
-- FIX: Insertar configuración inicial por defecto (CORREGIDO)
-- ==========================================
-- La tabla business_config estaba vacía. Insertamos fila por defecto.
-- Incluimos 'usd_rate' que es NOT NULL.

INSERT INTO public.business_config (
  cny_rate, 
  air_shipping_rate, 
  sea_shipping_rate, 
  profit_margin, 
  auto_update_exchange_rate_cny,
  auto_update_binance_rate,
  binance_rate,
  binance_rate_sell,
  alerts_after_days,
  usd_rate,
  auto_update_exchange_rate
) VALUES (
  20.0, -- Default CNY rate
  10.0, -- Default Air shipping
  5.0,  -- Default Sea shipping
  20.0, -- Default Profit margin
  true,
  false,
  42.0,
  300.0,
  3,
  60.0, -- Default USD rate (aprox)
  false
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.business_config IS 'Configuración del sistema. Fila inicial garantizada.';
