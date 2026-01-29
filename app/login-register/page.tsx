"use client";

import React from "react";
import HeroSection from "@/components/login-info/HeroSection";
import LandingSecciones from "@/components/login-info/LandingSecciones";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

export default function LoginRegisterPage() {
  return (
    <main>
      <div className="stacking-container">
        <HeroSection />
        <LandingSecciones />
      </div>
      <LanguageSwitcher />
    </main>
  );
}
