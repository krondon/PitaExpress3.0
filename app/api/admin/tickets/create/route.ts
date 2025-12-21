import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabaseServiceRoleClient();

        // Parse request body
        const body = await request.json();
        const { user_name } = body;

        // Validate input
        if (!user_name || typeof user_name !== 'string' || user_name.trim().length < 3) {
            return NextResponse.json(
                { error: 'El nombre del usuario debe tener al menos 3 caracteres' },
                { status: 400 }
            );
        }

        // Generate base code
        const { data: baseCodeData, error: baseCodeError } = await supabase
            .rpc('generate_next_base_code');

        if (baseCodeError) {
            console.error('Error generating base code:', baseCodeError);
            return NextResponse.json(
                { error: 'Error al generar código base' },
                { status: 500 }
            );
        }

        const base_code = baseCodeData;
        const created_at = new Date();

        // Generate full code
        const { data: fullCodeData, error: fullCodeError } = await supabase
            .rpc('generate_full_code', {
                base_code,
                created_date: created_at.toISOString()
            });

        if (fullCodeError) {
            console.error('Error generating full code:', fullCodeError);
            return NextResponse.json(
                { error: 'Error al generar código completo' },
                { status: 500 }
            );
        }

        const full_code = fullCodeData;

        // Insert ticket
        const { data: ticket, error: insertError } = await supabase
            .from('tickets')
            .insert({
                user_name: user_name.trim(),
                base_code,
                full_code
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error inserting ticket:', insertError);

            // Check for unique constraint violation
            if (insertError.code === '23505') {
                return NextResponse.json(
                    { error: 'Ya existe un ticket con este código' },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                { error: 'Error al crear ticket' },
                { status: 500 }
            );
        }

        return NextResponse.json({ ticket }, { status: 201 });

    } catch (error) {
        console.error('Unexpected error in POST /api/admin/tickets/create:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
