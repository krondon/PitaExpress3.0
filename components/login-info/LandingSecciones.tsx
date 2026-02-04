"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import {
    FileText,
    ShoppingCart,
    MapPin,
    Shield,
    Headphones,
    Eye,
    Heart,
    RefreshCw,
    Users,
    BadgeCheck,
    ShieldCheck
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function LandingSecciones() {
    const observerRef = useRef<IntersectionObserver | null>(null);
    const { t } = useTranslation();

    useEffect(() => {
        // Animación en scroll estilo login.html
        // Observamos las secciones en lugar de tarjetas individuales para mayor fiabilidad con sticky sections
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const elements = entry.target.querySelectorAll(".animate-on-scroll-pl");

                    if (entry.isIntersecting) {
                        // Al entrar en vista, añadimos la clase visible a todos los elementos internos
                        elements.forEach((el) => el.classList.add("visible"));
                    } else {
                        // Opcional: Resetear la animación al salir de vista (estilo login.html)
                        // elements.forEach((el) => el.classList.remove("visible"));
                    }
                });
            },
            { threshold: 0.2 } // Umbral del 20% de la sección
        );

        const sections = document.querySelectorAll(".stacking-section");
        sections.forEach((section) => observerRef.current?.observe(section));

        return () => {
            observerRef.current?.disconnect();
        };
    }, []);

    return (
        <>
            {/* Services Section */}
            <section id="servicios" className="section-pl section-gradient-pl stacking-section">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="section-title-pl">{t('loginInfo.portalFeatures.title')}</h2>
                        <p className="section-subtitle-pl">{t('loginInfo.portalFeatures.subtitle')}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 max-w-6xl mx-auto">
                        {/* Service 1 */}
                        <div className="feature-card-pl animate-on-scroll-pl animate-delay-1">
                            <div className="feature-icon-pl" style={{ background: 'rgba(17, 62, 159, 0.3)' }}>
                                <FileText size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{t('loginInfo.portalFeatures.features.quotes.title')}</h3>
                            <p className="text-white/70">{t('loginInfo.portalFeatures.features.quotes.description')}</p>
                        </div>

                        {/* Service 2 */}
                        <div className="feature-card-pl animate-on-scroll-pl animate-delay-2">
                            <div className="feature-icon-pl" style={{ background: 'rgba(229, 61, 39, 0.3)' }}>
                                <ShoppingCart size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{t('loginInfo.portalFeatures.features.buy.title')}</h3>
                            <p className="text-white/70">{t('loginInfo.portalFeatures.features.buy.description')}</p>
                        </div>

                        {/* Service 3 */}
                        <div className="feature-card-pl animate-on-scroll-pl animate-delay-3">
                            <div className="feature-icon-pl" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                                <MapPin size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{t('loginInfo.portalFeatures.features.tracking.title')}</h3>
                            <p className="text-white/70">{t('loginInfo.portalFeatures.features.tracking.description')}</p>
                        </div>

                        {/* Service 4 */}
                        <div className="feature-card-pl animate-on-scroll-pl animate-delay-4">
                            <div className="feature-icon-pl" style={{ background: 'rgba(17, 62, 159, 0.3)' }}>
                                <Shield size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{t('loginInfo.portalFeatures.features.payments.title')}</h3>
                            <p className="text-white/70">{t('loginInfo.portalFeatures.features.payments.description')}</p>
                        </div>

                        {/* Service 5 */}
                        <div className="feature-card-pl col-span-2 md:col-span-2 lg:col-span-2 lg:max-w-md lg:mx-auto animate-on-scroll-pl animate-delay-5">
                            <div className="feature-icon-pl" style={{ background: 'rgba(229, 61, 39, 0.3)' }}>
                                <Headphones size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">{t('loginInfo.portalFeatures.features.support.title')}</h3>
                            <p className="text-white/70">{t('loginInfo.portalFeatures.features.support.description')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Philosophy Section */}
            <section className="section-pl section-light-pl stacking-section" id="filosofia">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="section-title-pl" style={{ color: 'var(--pl-primary)' }}>{t('loginInfo.servicePhilosophy.title')}</h2>
                        <p className="section-subtitle-pl italic text-xl" style={{ color: 'var(--pl-gray-text)' }}>
                            {t('loginInfo.servicePhilosophy.slogan')}
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto mb-12">
                        <p className="text-center text-lg" style={{ color: 'var(--pl-gray-text)' }}>
                            {t('loginInfo.servicePhilosophy.intro')}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-5xl mx-auto">
                        {/* Value 1 */}
                        <div className="value-card-pl animate-on-scroll-pl animate-delay-1">
                            <div className="feature-icon-pl mb-4" style={{ background: 'rgba(17, 62, 159, 0.15)' }}>
                                <Eye size={28} color="var(--pl-secondary)" />
                            </div>
                            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--pl-primary)' }}>{t('loginInfo.servicePhilosophy.values.transparency.title')}</h3>
                            <p style={{ color: 'var(--pl-gray-text)' }}>{t('loginInfo.servicePhilosophy.values.transparency.description')}</p>
                        </div>

                        {/* Value 2 */}
                        <div className="value-card-pl animate-on-scroll-pl animate-delay-2" style={{ borderLeftColor: 'var(--pl-accent)' }}>
                            <div className="feature-icon-pl mb-4" style={{ background: 'rgba(229, 61, 39, 0.15)' }}>
                                <Heart size={28} color="var(--pl-accent)" />
                            </div>
                            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--pl-primary)' }}>{t('loginInfo.servicePhilosophy.values.commitment.title')}</h3>
                            <p style={{ color: 'var(--pl-gray-text)' }}>{t('loginInfo.servicePhilosophy.values.commitment.description')}</p>
                        </div>

                        {/* Value 3 */}
                        <div className="value-card-pl col-span-2 md:col-span-1 animate-on-scroll-pl animate-delay-3" style={{ borderLeftColor: 'var(--pl-primary)' }}>
                            <div className="feature-icon-pl mb-4" style={{ background: 'rgba(34, 40, 57, 0.15)' }}>
                                <RefreshCw size={28} color="var(--pl-primary)" />
                            </div>
                            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--pl-primary)' }}>{t('loginInfo.servicePhilosophy.values.adaptability.title')}</h3>
                            <p style={{ color: 'var(--pl-gray-text)' }}>{t('loginInfo.servicePhilosophy.values.adaptability.description')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Last Section Group (Ethics + Footer) */}
            <div className="stacking-section last-section-group-pl section-dark-pl">
                <section className="container mx-auto px-4 py-8 md:py-12 flex flex-col flex-1 justify-center">
                    <div className="text-center mb-8 md:mb-12">
                        <h2 className="section-title-pl">{t('loginInfo.ethicalCommitment.title')}</h2>
                        <p className="section-subtitle-pl">{t('loginInfo.ethicalCommitment.intro')}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-4xl mx-auto mb-12">
                        <div className="text-center animate-on-scroll-pl animate-delay-1">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users size={32} color="white" />
                            </div>
                            <h3 className="text-lg font-bold mb-2 text-white">{t('loginInfo.ethicalCommitment.guarantees.respect.title')}</h3>
                            <p className="text-white/70 text-sm">{t('loginInfo.ethicalCommitment.guarantees.respect.description')}</p>
                        </div>

                        <div className="text-center animate-on-scroll-pl animate-delay-2">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <BadgeCheck size={32} color="white" />
                            </div>
                            <h3 className="text-lg font-bold mb-2 text-white">{t('loginInfo.ethicalCommitment.guarantees.integrity.title')}</h3>
                            <p className="text-white/70 text-sm">{t('loginInfo.ethicalCommitment.guarantees.integrity.description')}</p>
                        </div>

                        <div className="text-center col-span-2 md:col-span-1 animate-on-scroll-pl animate-delay-3">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck size={32} color="white" />
                            </div>
                            <h3 className="text-lg font-bold mb-2 text-white">{t('loginInfo.ethicalCommitment.guarantees.trust.title')}</h3>
                            <p className="text-white/70 text-sm">{t('loginInfo.ethicalCommitment.guarantees.trust.description')}</p>
                        </div>
                    </div>
                </section>

                <footer className="footer-pl w-full">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-6">
                            <div className="mb-4">
                                <div style={{ background: 'rgba(255,255,255,0.92)', padding: '6px 12px 3px', borderRadius: '10px', display: 'inline-block' }}>
                                    <Image
                                        src="/images/LOGO PITA LOGISTICA.png"
                                        alt={t('loginInfo.footer.companyName')}
                                        width={160}
                                        height={53}
                                        className="logo-image-pl"
                                        style={{ maxWidth: '160px' }}
                                    />
                                </div>
                            </div>
                            <p className="text-white/70 max-w-md mx-auto text-xs md:text-sm">
                                {t('loginInfo.footer.tagline')}
                            </p>
                        </div>

                        <div className="flex flex-wrap justify-center gap-3 md:gap-6 mb-6 text-xs text-white/80">
                            <a href="#" className="flex items-center gap-1 hover:text-white transition-colors">
                                {t('loginInfo.footer.links.privacy')}
                            </a>
                            <span className="text-white/20">|</span>
                            <a href="#" className="flex items-center gap-1 hover:text-white transition-colors">
                                {t('loginInfo.footer.links.terms')}
                            </a>
                            <span className="text-white/20">|</span>
                            <a href="#" className="flex items-center gap-1 hover:text-white transition-colors">
                                {t('loginInfo.footer.links.ethics')}
                            </a>
                        </div>

                        <div className="text-center text-white/40 text-[10px] md:text-xs border-t border-white/10 pt-4">
                            {t('loginInfo.footer.copyright')}
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
