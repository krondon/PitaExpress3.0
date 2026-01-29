"use client";

import React, { useState } from "react";
import HeroSection from "@/components/login-info/HeroSection";
import LandingSecciones from "@/components/login-info/LandingSecciones";
import PasswordReset from "./PasswordReset/PasswordReset";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

export default function LoginRegisterPage() {
  const [currentPage, setCurrentPage] = useState<"auth" | "password-reset">(
    "auth"
  );

  const navigateToPasswordReset = (): void => setCurrentPage("password-reset");
  const navigateToAuth = (): void => setCurrentPage("auth");

  return (
    <main>
      {currentPage === "auth" && (
        <div className="stacking-container">
          <HeroSection onNavigateToPasswordReset={navigateToPasswordReset} />
          <LandingSecciones />
        </div>
      )}
      {currentPage === "password-reset" && (
        <div className="password-reset-container">
          <PasswordReset onNavigateToAuth={navigateToAuth} />
        </div>
      )}

      <LanguageSwitcher />
    </main>
  );
}
