import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * PATCH: Guardar idioma preferido del cliente.
 * Solo actualiza userlevel.preferred_language si el usuario es Client (para correos/WhatsApp).
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const language = body?.language;
    if (!language || !['es', 'en', 'zh'].includes(language)) {
      return NextResponse.json({ error: 'language debe ser es, en o zh' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.id) {
      return NextResponse.json({ ok: true }); // No autenticado: no-op
    }

    const { data: level } = await supabase
      .from('userlevel')
      .select('user_level')
      .eq('id', user.id)
      .single();

    const isClient = level?.user_level != null && String(level.user_level).trim().toLowerCase() === 'client';
    if (!isClient) {
      return NextResponse.json({ ok: true }); // Solo clientes persisten idioma para correos/WhatsApp
    }

    const { error } = await supabase
      .from('userlevel')
      .update({ preferred_language: language })
      .eq('id', user.id);

    if (error) {
      console.error('[profile/preferred-language] Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[profile/preferred-language] Exception:', err?.message);
    return NextResponse.json({ error: err?.message || 'Error' }, { status: 500 });
  }
}
