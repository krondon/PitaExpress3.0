"use client";

import React, { useState } from "react";
import Image from "next/image";
import PremiumLoginCard from "./PremiumLoginCard";
import PremiumPasswordReset from "./PremiumPasswordReset";
import { Shield, MapPin } from "lucide-react";

type AuthView = "auth" | "password-reset";

export default function HeroSection() {
    const [currentView, setCurrentView] = useState<AuthView>("auth");

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
                                <Image
                                    src="/images/LOGO PITA LOGISTICA.png"
                                    alt="Pita Logística Internacional"
                                    width={240}
                                    height={80}
                                    className="logo-image-pl"
                                    style={{ maxWidth: '240px', height: 'auto', margin: 'auto' }}
                                    priority
                                />
                            </div>
                        </div>
                        <h1 className="hero-title mb-3 md:mb-6 text-xl md:text-3xl lg:text-5xl">El puente que conecta tus ideas con soluciones reales.</h1>
                        <p className="hero-subtitle mb-4 md:mb-8 text-sm md:text-base opacity-90">Importaciones desde China a Venezuela con transparencia, compromiso y adaptabilidad.</p>

                        <div className="hidden md:block space-y-4">
                            <div className="feature-benefit-pl justify-center lg:justify-start">
                                <div className="feature-benefit-icon-pl">
                                    <Shield size={24} color="white" />
                                </div>
                                <div>
                                    <h4>Proveedores Verificados</h4>
                                    <p>Red de proveedores confiables en China.</p>
                                </div>
                            </div>
                            <div className="feature-benefit-pl justify-center lg:justify-start">
                                <div className="feature-benefit-icon-pl">
                                    <MapPin size={24} color="white" />
                                </div>
                                <div>
                                    <h4>Seguimiento Total</h4>
                                    <p>Monitorea tu carga en tiempo real.</p>
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
