"use client";

import { useEffect, useState } from "react";
import PremiumPasswordReset from "@/components/login-info/PremiumPasswordReset";
import VideoBackground from "@/components/login-info/VideoBackground";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function PasswordResetRedirectPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      } else {
        // Si ya hay sesión, se puede actualizar directamente
        supabase.auth.getSession().then(({ data }) => {
          if (data?.session) setReady(true);
          else setReady(true); // default a ready para mostrar formulario
        });
      }
    });

    // Fallback: si ya existe sesión temporal.
    supabase.auth.getSession().then(({ data }) => {
      if (!ready && data) setReady(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [ready]);

  if (!ready) {
    return (
      <main className="flex items-center justify-center h-[60vh]">
        <p className="text-sm text-muted-foreground">Preparando restablecimiento…</p>
      </main>
    );
  }

  return (
    <main>
      <div className="hero-section">
        <VideoBackground />
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <PremiumPasswordReset
            onNavigateToAuth={() => {
              window.location.replace("/login-register");
            }}
            initialStep={2}
          />
        </div>
      </div>
      <LanguageSwitcher />
    </main>
  );
}
