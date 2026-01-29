"use client";

import React from "react";
import Image from "next/image";
import PremiumLoginCard from "./PremiumLoginCard";
import { Shield, MapPin } from "lucide-react";

type Props = {
    onNavigateToPasswordReset: () => void;
};

export default function HeroSection({ onNavigateToPasswordReset }: Props) {
    return (
        <section className="hero-section stacking-section">
            <div className="container mx-auto px-4">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">

                    {/* Left Column: Hero Text */}
                    <div className="w-full lg:w-1/2 text-center lg:text-left max-w-xl order-2 lg:order-1">
                        <div className="mb-6">
                            <div style={{ padding: '10px 16px 6px', borderRadius: '12px' }}>
                                <Image
                                    src="/images/LOGO PITA LOGISTICA.png"
                                    alt="Pita Logística Internacional"
                                    width={300}
                                    height={100}
                                    className="logo-image-pl"
                                    style={{ maxWidth: '300px', height: 'auto', margin: 'auto' }}
                                    priority
                                />
                            </div>
                        </div>
                        <h1 className="hero-title mb-6">El puente que conecta tus ideas con soluciones reales.</h1>
                        <p className="hero-subtitle mb-8">Importaciones desde China a Venezuela con transparencia, compromiso y adaptabilidad.</p>

                        <div className="space-y-4">
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

                    {/* Right Column: Login Card */}
                    <div className="w-full lg:w-auto flex justify-center order-1 lg:order-2">
                        <PremiumLoginCard onNavigateToPasswordReset={onNavigateToPasswordReset} />
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
