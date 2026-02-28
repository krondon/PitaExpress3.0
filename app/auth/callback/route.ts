import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * OAuth Callback Route
 * 
 * Supabase redirige aquí después de que el usuario se autentica con Google/Facebook.
 * Esta ruta:
 * 1. Intercambia el `code` por una sesión
 * 2. Asigna rol "Client" si es usuario nuevo
 * 3. Setea la cookie `role` para el middleware
 * 4. Redirige al dashboard correspondiente
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const origin = request.nextUrl.origin;

    if (!code) {
        // Sin código, redirigir al login
        return NextResponse.redirect(new URL("/login-register", origin));
    }

    // Crear un cliente de Supabase con cookies del request
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Intercambiar el code por una sesión
    const { data: sessionData, error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);

    if (sessionError || !sessionData?.user) {
        console.error("OAuth callback error:", sessionError?.message);
        return NextResponse.redirect(new URL("/login-register", origin));
    }

    const userId = sessionData.user.id;
    const userEmail = sessionData.user.email;
    const userFullName =
        sessionData.user.user_metadata?.full_name ||
        sessionData.user.user_metadata?.name ||
        "";

    // Usar service role para operaciones de base de datos
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        console.error("SUPABASE_SERVICE_ROLE_KEY no está definida");
        return NextResponse.redirect(new URL("/login-register", origin));
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verificar si ya tiene un userlevel
    const { data: existingLevel, error: levelError } = await supabaseAdmin
        .from("userlevel")
        .select("user_level")
        .eq("id", userId)
        .maybeSingle();

    if (levelError) {
        console.warn("Error consultando userlevel:", levelError.message);
    }

    const alreadyHasLevel = !!(
        existingLevel?.user_level && existingLevel.user_level.trim() !== ""
    );

    // Si es usuario nuevo (sin nivel), asignar "Client" y crear registro en clients
    if (!alreadyHasLevel) {
        // Insertar en userlevel
        const { error: insertLevelError } = await supabaseAdmin
            .from("userlevel")
            .upsert({ id: userId, user_level: "Client" });

        if (insertLevelError) {
            console.warn("Error insertando userlevel:", insertLevelError.message);
        }

        // Insertar en tabla clients
        const { error: clientError } = await supabaseAdmin
            .from("clients")
            .insert([{ user_id: userId, name: userFullName || userEmail || "" }]);

        if (clientError) {
            console.warn("Error insertando en clients:", clientError.message);
        }
    }

    // Obtener el nivel actual para determinar el redirect
    const { data: ul } = await supabaseAdmin
        .from("userlevel")
        .select("user_level")
        .eq("id", userId)
        .maybeSingle();

    const normalized = (ul?.user_level ?? "").toString().trim().toLowerCase();

    // Determinar rol y ruta de destino
    let role = "";
    let redirectPath = "/gestion";

    if (["cliente", "client"].includes(normalized)) {
        role = "client";
        redirectPath = "/cliente";
    } else if (["vzla", "venezuela"].includes(normalized)) {
        role = "venezuela";
        redirectPath = "/venezuela";
    } else if (["china"].includes(normalized)) {
        role = "china";
        redirectPath = "/china";
    } else if (
        ["pagos", "payments", "payment", "validador", "validator"].includes(
            normalized
        )
    ) {
        role = "pagos";
        redirectPath = "/pagos";
    } else if (
        ["admin", "administrador", "administrator"].includes(normalized)
    ) {
        role = "admin";
        redirectPath = "/admin";
    }

    // Crear la respuesta con redirect
    const response = NextResponse.redirect(new URL(redirectPath, origin));

    // Setear cookies de sesión y rol
    if (role) {
        response.cookies.set("role", role, {
            path: "/",
            maxAge: 60 * 60 * 12, // 12 horas
            sameSite: "lax",
        });
    }

    // Guardar tokens de sesión en cookies para que el cliente pueda recuperarlos
    if (sessionData.session) {
        response.cookies.set(
            "sb-access-token",
            sessionData.session.access_token,
            {
                path: "/",
                maxAge: 60 * 60, // 1 hora
                sameSite: "lax",
                httpOnly: false, // El cliente necesita leerlo
            }
        );
        response.cookies.set(
            "sb-refresh-token",
            sessionData.session.refresh_token,
            {
                path: "/",
                maxAge: 60 * 60 * 24 * 30, // 30 días
                sameSite: "lax",
                httpOnly: false,
            }
        );
    }

    return response;
}
