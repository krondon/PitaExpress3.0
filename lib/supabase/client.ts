"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Crea un cliente de Supabase del lado del navegador.
 * Lee las variables públicas en tiempo de ejecución para evitar fallos si no existen en build.
 */
let browserClient: SupabaseClient | null = null;

type GetClientOptions = {
  /** Forzar crear nueva instancia (evitar en producción). */
  forceNew?: boolean;
  /** Activar logs de depuración en consola. */
  debug?: boolean;
};

export function getSupabaseBrowserClient(options: GetClientOptions = {}) {
  const { forceNew = false, debug = false } = options;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
    );
  }

  if (!browserClient || forceNew) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    if (debug) console.debug('[Supabase] Nueva instancia creada');
  } else if (debug) {
    console.debug('[Supabase] Reutilizando instancia existente');
  }

  return browserClient;
}

// Utilidad para inspeccionar el estado del cliente y canales activos
export function debugSupabaseRealtime() {
  const client = browserClient;
  if (!client) {
    console.warn('[Supabase] No hay cliente inicializado aún');
    return;
  }
  // @ts-ignore - propiedades internas
  const channels = client.realtime?.channels || [];
  console.group('[Supabase Realtime Debug]');

  // @ts-ignore

  console.groupEnd();
}
