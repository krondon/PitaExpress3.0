'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type SubmitChinaQuoteParams = {
  orderId: number;
  cantidad: number;
  precioUnitario: number;
  precioEnvio: number;
  altura: number;
  anchura: number;
  largo: number;
  peso: number;
  numericState?: number;
  pedidoDeliveryType?: string;
  pedidoShippingType?: string;
  cnyRate?: number | null;
};

export type SubmitChinaQuoteSuccess = {
  ok: true;
  totalUSDConMargen: number;
  profitMarginUsed: number;
};

export type SubmitChinaQuoteFailure =
  | { ok: false; reason: 'already_shipped' }
  | { ok: false; reason: 'update_failed'; error: unknown };

export type SubmitChinaQuoteResult = SubmitChinaQuoteSuccess | SubmitChinaQuoteFailure;

const DEFAULT_CNY_FALLBACK = 7.25;

/** Una sola llamada a /api/config (mismos fallbacks que la vista China). */
export async function fetchChinaQuoteConfig(): Promise<{
  profitMargin: number;
  airShippingRate: number;
  seaShippingRate: number;
}> {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.config) {
        const c = data.config;
        return {
          profitMargin:
            c.profit_margin !== undefined && c.profit_margin !== null
              ? Number(c.profit_margin)
              : 25,
          airShippingRate:
            c.air_shipping_rate !== undefined && c.air_shipping_rate !== null
              ? Number(c.air_shipping_rate)
              : 10,
          seaShippingRate:
            c.sea_shipping_rate !== undefined && c.sea_shipping_rate !== null
              ? Number(c.sea_shipping_rate)
              : 180,
        };
      }
    }
  } catch (e) {
    console.error('[submitChinaOrderQuote] config fetch:', e);
  }
  return { profitMargin: 25, airShippingRate: 10, seaShippingRate: 180 };
}

/**
 * Misma regla que la página China: CNY → USD, margen, extras aéreo/marítimo,
 * guarda unitQuote/shippingPrice en CNY y totalQuote en USD.
 */
export async function submitChinaOrderQuote(
  params: SubmitChinaQuoteParams
): Promise<SubmitChinaQuoteResult> {
  const {
    orderId,
    cantidad,
    precioUnitario,
    precioEnvio,
    altura,
    anchura,
    largo,
    peso,
    numericState,
    pedidoDeliveryType,
    pedidoShippingType,
    cnyRate,
  } = params;

  if (numericState != null && numericState >= 9) {
    return { ok: false, reason: 'already_shipped' };
  }

  const supabase = getSupabaseBrowserClient();

  const { data: orderData, error: orderFetchError } = await supabase
    .from('orders')
    .select('deliveryType, shippingType')
    .eq('id', orderId)
    .single();

  if (orderFetchError) {
    console.error('Error obteniendo información del pedido:', orderFetchError);
  }

  const totalProductosCNY = Number(precioUnitario) * Number(cantidad || 0);
  const totalCNY = totalProductosCNY + Number(precioEnvio);
  const rate = cnyRate && cnyRate > 0 ? cnyRate : DEFAULT_CNY_FALLBACK;
  const totalUSDBase = totalCNY / rate;

  const { profitMargin: currentProfitMargin, airShippingRate, seaShippingRate } =
    await fetchChinaQuoteConfig();

  let totalUSDConMargen = totalUSDBase * (1 + currentProfitMargin / 100);

  const del = orderData?.deliveryType ?? pedidoDeliveryType;
  const ship = orderData?.shippingType ?? pedidoShippingType;

  const isAirShipping =
    del === 'air' || ship === 'air';

  if (isAirShipping && peso > 0) {
    const costoEnvioAereo = Number(peso) * airShippingRate;
    totalUSDConMargen += costoEnvioAereo;
  }

  const isSeaShipping =
    del === 'maritime' ||
    ship === 'maritime' ||
    ship === 'sea';

  if (isSeaShipping && altura > 0 && anchura > 0 && largo > 0) {
    const alturaMetros = Number(altura) / 100;
    const anchuraMetros = Number(anchura) / 100;
    const largoMetros = Number(largo) / 100;
    const volumen = alturaMetros * anchuraMetros * largoMetros;
    const costoEnvioMaritimo = volumen * seaShippingRate;
    totalUSDConMargen += costoEnvioMaritimo;
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      totalQuote: totalUSDConMargen,
      unitQuote: precioUnitario,
      shippingPrice: precioEnvio,
      height: altura,
      width: anchura,
      long: largo,
      weight: peso,
    })
    .eq('id', orderId);

  if (updateError) {
    console.error('Error update totalQuote:', updateError);
    return { ok: false, reason: 'update_failed', error: updateError };
  }

  try {
    await fetch(`/api/orders/${orderId}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 3, changed_by: 'china', notes: 'Pedido cotizado' }),
    });
  } catch (e) {
    console.error('No se pudo notificar cambio de estado a 3', e);
  }

  return {
    ok: true,
    totalUSDConMargen,
    profitMarginUsed: currentProfitMargin,
  };
}
