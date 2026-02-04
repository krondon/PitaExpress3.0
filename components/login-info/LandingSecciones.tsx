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

export default function LandingSecciones() {
    const observerRef = useRef<IntersectionObserver | null>(null);

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
                        <h2 className="section-title-pl">¿Qué puedes hacer en nuestro portal?</h2>
                        <p className="section-subtitle-pl">Todo lo que necesitas para tus importaciones en un solo lugar</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 max-w-6xl mx-auto">
                        {/* Service 1 */}
                        <div className="feature-card-pl animate-on-scroll-pl animate-delay-1">
                            <div className="feature-icon-pl" style={{ background: 'rgba(17, 62, 159, 0.3)' }}>
                                <FileText size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Solicitar Cotizaciones</h3>
                            <p className="text-white/70">Obtén precios competitivos para tus importaciones de forma rápida y sencilla.</p>
                        </div>

                        {/* Service 2 */}
                        <div className="feature-card-pl animate-on-scroll-pl animate-delay-2">
                            <div className="feature-icon-pl" style={{ background: 'rgba(229, 61, 39, 0.3)' }}>
                                <ShoppingCart size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Comprar Directamente</h3>
                            <p className="text-white/70">Selecciona productos de proveedores verificados con total confianza.</p>
                        </div>

                        {/* Service 3 */}
                        <div className="feature-card-pl animate-on-scroll-pl animate-delay-3">
                            <div className="feature-icon-pl" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                                <MapPin size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Seguimiento en Tiempo Real</h3>
                            <p className="text-white/70">Monitorea tu mercancía desde China hasta Venezuela paso a paso.</p>
                        </div>

                        {/* Service 4 */}
                        <div className="feature-card-pl animate-on-scroll-pl animate-delay-4">
                            <div className="feature-icon-pl" style={{ background: 'rgba(17, 62, 159, 0.3)' }}>
                                <Shield size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Pagos Seguros</h3>
                            <p className="text-white/70">Múltiples métodos de pago adaptados a Venezuela para tu comodidad.</p>
                        </div>

                        {/* Service 5 */}
                        <div className="feature-card-pl col-span-2 md:col-span-2 lg:col-span-2 lg:max-w-md lg:mx-auto animate-on-scroll-pl animate-delay-5">
                            <div className="feature-icon-pl" style={{ background: 'rgba(229, 61, 39, 0.3)' }}>
                                <Headphones size={28} color="white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Soporte Personalizado</h3>
                            <p className="text-white/70">Asesoría experta en cada paso del proceso de importación.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Philosophy Section */}
            <section className="section-pl section-light-pl stacking-section" id="filosofia">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="section-title-pl" style={{ color: 'var(--pl-primary)' }}>Nuestra Filosofía de Servicio</h2>
                        <p className="section-subtitle-pl italic text-xl" style={{ color: 'var(--pl-gray-text)' }}>
                            &quot;Analizamos Posibilidades. Generamos Soluciones. Construimos Oportunidades.&quot;
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto mb-12">
                        <p className="text-center text-lg" style={{ color: 'var(--pl-gray-text)' }}>
                            En Pita Logística conectamos personas y organizaciones con soluciones claras, guiados por nuestros valores fundamentales:
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-5xl mx-auto">
                        {/* Value 1 */}
                        <div className="value-card-pl animate-on-scroll-pl animate-delay-1">
                            <div className="feature-icon-pl mb-4" style={{ background: 'rgba(17, 62, 159, 0.15)' }}>
                                <Eye size={28} color="var(--pl-secondary)" />
                            </div>
                            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--pl-primary)' }}>Transparencia</h3>
                            <p style={{ color: 'var(--pl-gray-text)' }}>Comunicación clara en cada etapa del proceso.</p>
                        </div>

                        {/* Value 2 */}
                        <div className="value-card-pl animate-on-scroll-pl animate-delay-2" style={{ borderLeftColor: 'var(--pl-accent)' }}>
                            <div className="feature-icon-pl mb-4" style={{ background: 'rgba(229, 61, 39, 0.15)' }}>
                                <Heart size={28} color="var(--pl-accent)" />
                            </div>
                            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--pl-primary)' }}>Compromiso</h3>
                            <p style={{ color: 'var(--pl-gray-text)' }}>Contigo, tus pedidos y tus objetivos comerciales.</p>
                        </div>

                        {/* Value 3 */}
                        <div className="value-card-pl col-span-2 md:col-span-1 animate-on-scroll-pl animate-delay-3" style={{ borderLeftColor: 'var(--pl-primary)' }}>
                            <div className="feature-icon-pl mb-4" style={{ background: 'rgba(34, 40, 57, 0.15)' }}>
                                <RefreshCw size={28} color="var(--pl-primary)" />
                            </div>
                            <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--pl-primary)' }}>Adaptabilidad</h3>
                            <p style={{ color: 'var(--pl-gray-text)' }}>Soluciones flexibles a tus necesidades específicas.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Ethics Section */}
            <section className="section-pl section-dark-pl stacking-section">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="section-title-pl">Nuestro Compromiso Ético</h2>
                        <p className="section-subtitle-pl">Como parte de nuestro Código de Ética, garantizamos:</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-4xl mx-auto">
                        <div className="text-center animate-on-scroll-pl animate-delay-1">
                            <div className="ethics-circle-pl">
                                <Users size={32} color="white" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Respeto</h3>
                            <p className="text-white/70 text-sm">Por tu negocio y tus necesidades</p>
                        </div>

                        <div className="text-center animate-on-scroll-pl animate-delay-2">
                            <div className="ethics-circle-pl">
                                <BadgeCheck size={32} color="white" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Integridad</h3>
                            <p className="text-white/70 text-sm">En cada transacción y comunicación</p>
                        </div>

                        <div className="text-center col-span-2 md:col-span-1 animate-on-scroll-pl animate-delay-3">
                            <div className="ethics-circle-pl">
                                <ShieldCheck size={32} color="white" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">Confianza</h3>
                            <p className="text-white/70 text-sm">A través del cumplimiento de compromisos</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer-pl">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-8">
                        <div className="mb-4">
                            <div style={{ background: 'rgba(255,255,255,0.92)', padding: '8px 14px 4px', borderRadius: '10px', display: 'inline-block' }}>
                                <Image
                                    src="/images/LOGO PITA LOGISTICA.png"
                                    alt="Pita Logística Internacional"
                                    width={200}
                                    height={67}
                                    className="logo-image-pl"
                                    style={{ maxWidth: '200px' }}
                                />
                            </div>
                        </div>
                        <p className="text-white/70 max-w-xl mx-auto">
                            El puente que conecta personas y organizaciones con soluciones claras e innovadoras.
                        </p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8 text-sm">
                        <a href="#" className="flex items-center gap-2">
                            <span>🔗</span> Política de Privacidad
                        </a>
                        <span className="text-white/30 hidden md:inline">|</span>
                        <a href="#" className="flex items-center gap-2">
                            <span>🔗</span> Términos de Servicio
                        </a>
                        <span className="text-white/30 hidden md:inline">|</span>
                        <a href="#" className="flex items-center gap-2">
                            <span>🔗</span> Código de Ética Completo
                        </a>
                    </div>

                    <div className="text-center text-white/50 text-sm border-t border-white/10 pt-6">
                        © 2024 Pita Logística, C.A. - Todos los derechos reservados
                    </div>
                </div>
            </footer>
        </>
    );
}
