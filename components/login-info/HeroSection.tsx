"use client";

import React, { useState } from "react";
import Image from "next/image";
import PremiumLoginCard from "./PremiumLoginCard";
import PremiumPasswordReset from "./PremiumPasswordReset";
import { Shield, MapPin } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type AuthView = "auth" | "password-reset";

export default function HeroSection() {
    const [currentView, setCurrentView] = useState<AuthView>("auth");
    const { t } = useTranslation();

    const navigateToPasswordReset = (): void => setCurrentView("password-reset");
    const navigateToAuth = (): void => setCurrentView("auth");

    return (
        <section className="hero-section stacking-section">
            <div className="container mx-auto px-4">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">

                    {/* Left Column: Hero Text - centered vertically */}
                    <div className="w-full lg:w-1/2 text-center lg:text-left max-w-xl order-2 lg:order-1 lg:self-center mt-4 lg:mt-0">
                        <div className="mb-4 lg:mb-6">
                            <div className="p-2 lg:p-4 rounded-xl">
                                <div className="max-w-[200px] md:max-w-[320px] lg:max-w-[320px] mx-auto">
                                    <Image
                                        src="/images/LOGO PITA LOGISTICA.png"
                                        alt="Pita Logística Internacional"
                                        width={400}
                                        height={120}
                                        className="logo-image-pl"
                                        style={{ width: '100%', height: 'auto' }}
                                        priority
                                    />
                                </div>
                            </div>
                        </div>
                        <h1 className="hero-title mb-3 md:mb-6 text-xl md:text-3xl lg:text-5xl">{t('loginInfo.hero.title')}</h1>
                        <p className="hero-subtitle mb-4 md:mb-8 text-sm md:text-base opacity-95">{t('loginInfo.hero.subtitle')}</p>
                        <div className="hero-benefits-container flex-col space-y-4 mt-6 items-center lg:items-start">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white/20 backdrop-blur rounded-lg flex-shrink-0">
                                    <Shield size={24} color="white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">{t('loginInfo.hero.benefits.verifiedSuppliers.title')}</h4>
                                    <p className="text-sm text-white/70">{t('loginInfo.hero.benefits.verifiedSuppliers.description')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white/20 backdrop-blur rounded-lg flex-shrink-0">
                                    <MapPin size={24} color="white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">{t('loginInfo.hero.benefits.totalTracking.title')}</h4>
                                    <p className="text-sm text-white/70">{t('loginInfo.hero.benefits.totalTracking.description')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Auth Card - stays at top */}
                    <div className="w-full lg:w-auto flex justify-center order-1 lg:order-2 lg:self-center">
                        {currentView === "auth" ? (
                            <PremiumLoginCard onNavigateToPasswordReset={navigateToPasswordReset} />
                        ) : (
                            <PremiumPasswordReset onNavigateToAuth={navigateToAuth} />
                        )}
                    </div>

                </div>
            </div>

            {/* Scroll Indicator */}
            <div className="scroll-indicator-pl">
                <a href="#servicios">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                </a>
            </div>
        </section>
    );
}
