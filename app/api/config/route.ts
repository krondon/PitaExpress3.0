import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { NotificationsFactory } from '@/lib/notifications';

// Forzar que esta ruta sea dinámica (no se cachee en build)
export const dynamic = 'force-dynamic';
export const revalidate = 0; // No cachear nunca


export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceRoleClient();
    // Configuración global: solo traer el primer registro
    const { data, error } = await supabase
      .from('business_config')
      .select('*')
      .limit(1)
      .single();

    console.log('[API/Config] GET config from DB:', data);

    if (error) throw error;
    return NextResponse.json({
      success: true,
      config: data,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching business config:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch configuration'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const updates = await request.json();
    console.log('[API/Config] POST updates received:', updates);
    const supabase = getSupabaseServiceRoleClient();
    // Buscar si ya existe un registro global
    const { data: existing, error: fetchError } = await supabase
      .from('business_config')
      .select('id')
      .limit(1)
      .single();
    let upsertResult;
    if (existing && existing.id) {
      // Actualizar registro existente
      upsertResult = await supabase
        .from('business_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insertar nuevo registro
      upsertResult = await supabase
        .from('business_config')
        .insert([{ ...updates, updated_at: new Date().toISOString() }])
        .select()
        .single();
    }
    if (upsertResult.error) throw upsertResult.error;

    console.log('[API/Config] UPSERT success. Result:', upsertResult.data);

    // Notificar a administradores (no bloqueante)
    try {
      const notif = NotificationsFactory.admin.managementChanged({
        userName: 'Configuración actualizada',
        configSection: Object.keys(updates || {}).slice(0, 3).join(', ') || 'configuración',
      });
      await supabase
        .from('notifications')
        .insert([
          {
            audience_type: 'role',
            audience_value: 'admin',
            title: notif.title,
            description: notif.description,
            href: notif.href,
            severity: notif.severity,
          },
        ]);
    } catch (notifyErr) {
      console.error('Config update notification error:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      config: upsertResult.data,
      message: 'Configuration updated successfully in Supabase'
    });
  } catch (error: any) {
    console.error('Error updating business config:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update configuration'
      },
      { status: 500 }
    );
  }
}