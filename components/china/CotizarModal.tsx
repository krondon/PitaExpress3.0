"use client";
import { useState, useEffect, useRef, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, User, Tag, Calendar, Truck, MapPin, FileText, XCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useCNYConversion } from '@/hooks/use-cny-conversion';
import { useTheme } from 'next-themes';

export interface CotizarPedido {
    id: number;
    cliente: string;
    producto: string;
    cantidad: number;
    especificaciones?: string;
    fecha?: string;
    numericState?: number;
    deliveryType?: string;
    shippingType?: string;
    description?: string;
    imgs?: string[];
    links?: string[];
    /** Valores guardados previamente (CNY / cm / kg) para reabrir el modal */
    unitQuote?: number | null;
    shippingPrice?: number | null;
    height?: number | null;
    width?: number | null;
    long?: number | null;
    weight?: number | null;
}

function sanitizeCnyInputFromNumber(n: number | null | undefined): { value: number; input: string } {
    if (n == null || Number.isNaN(Number(n))) return { value: 0, input: '' };
    const num = Number(n);
    const raw = String(num);
    const parts = raw.split('.');
    const intPart = (parts[0] || '').slice(0, 7);
    const decPart = (parts[1] || '').slice(0, 2);
    const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
    const value = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
    if (value < 0) return { value: 0, input: '' };
    return { value, input: cleaned };
}

function sanitizeDimInputFromNumber(n: number | null | undefined): { value: number; input: string } {
    if (n == null || Number.isNaN(Number(n))) return { value: 0, input: '' };
    const num = Number(n);
    if (num <= 0) return { value: 0, input: '' };
    const raw = String(num);
    const parts = raw.split('.');
    const intPart = (parts[0] || '').slice(0, 7);
    const decPart = (parts[1] || '').slice(0, 1);
    const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
    const value = Number(cleaned);
    return { value, input: cleaned };
}

interface CotizarModalProps {
    open: boolean;
    pedido?: CotizarPedido;
    onClose: () => void;
    onSubmit: (pedido: CotizarPedido, precioUnitario: number, precioEnvio: number, altura: number, anchura: number, largo: number, peso: number) => void | Promise<void>;
}

function getOrderBadge(t: (k: string, opts?: Record<string, unknown>) => string, stateNum: number | undefined, isDark: boolean) {
    const s = Number(stateNum ?? 0);
    const base = 'border';
    if (s === -2 || s === -1 || s === 0) return { label: t('chinese.ordersPage.badges.cancelled', { defaultValue: 'Cancelado' }), className: `${base} ${isDark ? 'bg-red-900/30 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-200'}` };
    if (s === 1 || s === 2) return { label: t('chinese.ordersPage.badges.pending'), className: `${base} ${isDark ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}` };
    if (s === 3) return { label: t('chinese.ordersPage.badges.quoted'), className: `${base} ${isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'}` };
    if (s === 4) return { label: t('chinese.ordersPage.badges.processing'), className: `${base} ${isDark ? 'bg-purple-900/30 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-200'}` };
    if (s === 5) return { label: t('chinese.ordersPage.badges.readyToPack'), className: `${base} ${isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700' : 'bg-amber-100 text-amber-800 border-amber-200'}` };
    if (s === 6) return { label: t('chinese.ordersPage.badges.inBox'), className: `${base} ${isDark ? 'bg-indigo-900/30 text-indigo-300 border-indigo-700' : 'bg-indigo-100 text-indigo-800 border-indigo-200'}` };
    if (s === 7 || s === 8) return { label: t('chinese.ordersPage.badges.inContainer'), className: `${base} ${isDark ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700' : 'bg-cyan-100 text-cyan-800 border-cyan-200'}` };
    if (s === 9) return { label: t('chinese.ordersPage.badges.shippedVzla'), className: `${base} ${isDark ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'}` };
    if (s === 10) return { label: t('chinese.ordersPage.badges.inVenezuela'), className: `${base} ${isDark ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}` };
    if (s === 11) return { label: t('chinese.ordersPage.badges.inBoxVzla'), className: `${base} ${isDark ? 'bg-orange-900/30 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-800 border-orange-200'}` };
    if (s === 12) return { label: t('chinese.ordersPage.badges.readyVzla'), className: `${base} ${isDark ? 'bg-lime-900/30 text-lime-300 border-lime-700' : 'bg-lime-100 text-lime-800 border-lime-200'}` };
    if (s === 13) return { label: t('chinese.ordersPage.badges.delivered'), className: `${base} ${isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}` };
    if (s > 13) return { label: t('chinese.ordersPage.badges.shippedVzla'), className: `${base} ${isDark ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'}` };
    return { label: t('chinese.ordersPage.badges.state', { num: s }), className: `${base} ${isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200'}` };
}

const CotizarModal = forwardRef<HTMLDivElement, CotizarModalProps>(function CotizarModal({ open, pedido, onClose, onSubmit }, ref) {
    const { t } = useTranslation();
    const { loading: cnyLoading, cnyRate } = useCNYConversion();
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);

    const [precioUnitario, setPrecioUnitario] = useState<number>(0);
    const [precioUnitarioInput, setPrecioUnitarioInput] = useState<string>('');
    const [precioEnvio, setPrecioEnvio] = useState<number>(0);
    const [precioEnvioInput, setPrecioEnvioInput] = useState<string>('');
    const [altura, setAltura] = useState<number>(0);
    const [alturaInput, setAlturaInput] = useState<string>('');
    const [anchura, setAnchura] = useState<number>(0);
    const [anchuraInput, setAnchuraInput] = useState<string>('');
    const [largo, setLargo] = useState<number>(0);
    const [largoInput, setLargoInput] = useState<string>('');
    const [peso, setPeso] = useState<number>(0);
    const [pesoInput, setPesoInput] = useState<string>('');
    const wasOpenRef = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    function resetFormFields() {
        setPrecioUnitario(0);
        setPrecioUnitarioInput('');
        setPrecioEnvio(0);
        setPrecioEnvioInput('');
        setAltura(0);
        setAlturaInput('');
        setAnchura(0);
        setAnchuraInput('');
        setLargo(0);
        setLargoInput('');
        setPeso(0);
        setPesoInput('');
    }

    function applyPrefillFromPedido(p: CotizarPedido) {
        const u = sanitizeCnyInputFromNumber(p.unitQuote ?? undefined);
        setPrecioUnitario(u.value > 0 ? u.value : 0);
        setPrecioUnitarioInput(u.value > 0 ? u.input : '');

        const spNum = p.shippingPrice != null ? Number(p.shippingPrice) : NaN;
        if (!Number.isNaN(spNum) && spNum >= 0) {
            const sp = sanitizeCnyInputFromNumber(spNum);
            setPrecioEnvio(sp.value);
            setPrecioEnvioInput(sp.input === '' && spNum === 0 ? '0' : sp.input);
        } else {
            setPrecioEnvio(0);
            setPrecioEnvioInput('');
        }

        const h = sanitizeDimInputFromNumber(p.height ?? undefined);
        setAltura(h.value);
        setAlturaInput(h.input);
        const w = sanitizeDimInputFromNumber(p.width ?? undefined);
        setAnchura(w.value);
        setAnchuraInput(w.input);
        const l = sanitizeDimInputFromNumber(p.long ?? undefined);
        setLargo(l.value);
        setLargoInput(l.input);
        const wg = sanitizeDimInputFromNumber(p.weight ?? undefined);
        setPeso(wg.value);
        setPesoInput(wg.input);
    }

    useEffect(() => {
        if (!open) {
            if (wasOpenRef.current) {
                wasOpenRef.current = false;
                resetFormFields();
            }
            setLightboxImg(null);
            return;
        }
        if (!pedido) return;
        if (!wasOpenRef.current) {
            wasOpenRef.current = true;
            applyPrefillFromPedido(pedido);
        }
    }, [open, pedido]);

    useEffect(() => {
        if (!lightboxImg) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxImg(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxImg]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 200);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (
            precioUnitario > 0 &&
            precioEnvio >= 0 &&
            altura > 0 &&
            anchura > 0 &&
            largo > 0 &&
            peso > 0 &&
            pedido
        ) {
            await onSubmit(pedido, precioUnitario, precioEnvio, altura, anchura, largo, peso);
            handleClose();
        }
    };

    if (!open || !pedido) return null;

    const isDark = !!(mounted && theme === 'dark');
    const badge = getOrderBadge(t, pedido.numericState, isDark);
    const shippingLabel = ({ air: 'Aéreo', maritime: 'Marítimo', doorToDoor: 'Puerta a puerta' } as Record<string, string>)[pedido.shippingType || ''] || pedido.shippingType || '—';
    const deliveryLabel = ({ office: 'Oficina', warehouse: 'Almacén', pickup: 'Retiro en tienda', delivery: 'Domicilio' } as Record<string, string>)[pedido.deliveryType || ''] || pedido.deliveryType || '—';

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300 p-4">
                <div
                    ref={ref}
                    className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl max-w-lg md:max-w-5xl mx-auto w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ${isClosing
                        ? 'translate-y-full scale-95 opacity-0'
                        : 'animate-in slide-in-from-bottom-4 duration-300'
                        }`}
                >
                    <div className={`sticky top-0 z-10 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4 rounded-t-2xl`}>
                        <div className="flex items-center justify-between">
                            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.quote.title')}</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClose}
                                className={`h-8 w-8 p-0 ${isDark ? 'hover:bg-slate-700' : ''}`}
                            >
                                <XCircle className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row">
                        <div className={`md:w-2/5 shrink-0 p-5 ${isDark ? 'md:border-r md:border-slate-700' : 'md:border-r md:border-gray-200'}`}>
                            <div className="space-y-4">
                                {pedido.imgs && pedido.imgs.length > 0 && (
                                    <div
                                        className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-gray-100'} cursor-pointer group relative`}
                                        onClick={() => setLightboxImg(pedido.imgs![0])}
                                    >
                                        <img
                                            src={pedido.imgs[0]}
                                            alt={pedido.producto}
                                            className="w-full h-44 object-cover transition-transform duration-200 group-hover:scale-105"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <Search className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                )}

                                <div className={`rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'} p-3.5 space-y-2.5`}>
                                    <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>#ORD-{pedido.id}</span>{' '}{pedido.producto || '—'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                                <User className="h-3 w-3 inline mr-1" />Cliente
                                            </span>
                                            <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{pedido.cliente || '—'}</p>
                                        </div>
                                        <div>
                                            <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                                <Tag className="h-3 w-3 inline mr-1" />Cantidad
                                            </span>
                                            <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{pedido.cantidad}</p>
                                        </div>
                                        <div>
                                            <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                                <Calendar className="h-3 w-3 inline mr-1" />Fecha
                                            </span>
                                            <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                                {pedido.fecha ? new Date(pedido.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                                Estado
                                            </span>
                                            <div className="mt-0.5">
                                                <Badge className={badge.className}>{badge.label}</Badge>
                                            </div>
                                        </div>
                                        <div>
                                            <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                                <Truck className="h-3 w-3 inline mr-1" />Envío
                                            </span>
                                            <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{shippingLabel}</p>
                                        </div>
                                        <div>
                                            <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                                <MapPin className="h-3 w-3 inline mr-1" />Entrega
                                            </span>
                                            <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{deliveryLabel}</p>
                                        </div>
                                    </div>
                                </div>

                                {pedido.description && (
                                    <div className={`rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'} p-3.5`}>
                                        <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                            <FileText className="h-3 w-3 inline mr-1" />Descripción
                                        </span>
                                        <p className={`text-xs mt-1 whitespace-pre-wrap leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{pedido.description}</p>
                                    </div>
                                )}

                                {pedido.especificaciones && (
                                    <div className={`rounded-xl border ${isDark ? 'border-amber-900/40 bg-amber-900/10' : 'border-amber-200 bg-amber-50'} p-3.5`}>
                                        <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                                            ⚙️ Especificaciones
                                        </span>
                                        <p className={`text-xs mt-1 whitespace-pre-wrap leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{pedido.especificaciones}</p>
                                    </div>
                                )}

                                {pedido.links && pedido.links.length > 0 && (
                                    <div className={`rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'} p-3.5`}>
                                        <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>🔗 Links</span>
                                        <div className="mt-1 space-y-1">
                                            {pedido.links.map((link, i) => (
                                                <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-500 hover:text-blue-400 hover:underline truncate">{link}</a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 p-5">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {t('chinese.ordersPage.modals.quote.unitPriceLabel')}
                                    </label>
                                    <div className="relative">
                                        <span className={`absolute left-3 top-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>¥</span>
                                        <input
                                            type="text"
                                            name="precio"
                                            inputMode="decimal"
                                            required
                                            value={precioUnitarioInput}
                                            className={`w-full pl-8 pr-4 py-3 rounded-lg focus:outline-none transition-colors border ${isDark ? 'bg-slate-700 text-white border-slate-600' : ''
                                                } ${!precioUnitarioInput || (precioUnitario > 0)
                                                    ? isDark
                                                        ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                                        : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                                    : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                                }`}
                                            placeholder={t('chinese.ordersPage.modals.quote.unitPricePlaceholder')}
                                            onChange={(e) => {
                                                let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                                const parts = raw.split('.');
                                                const intPart = (parts[0] || '').slice(0, 7);
                                                const decPart = (parts[1] || '').slice(0, 2);
                                                const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                                const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                                setPrecioUnitario(numero);
                                                setPrecioUnitarioInput(cleaned);
                                            }}
                                        />
                                        <p className={`mt-1 text-xs ${!precioUnitarioInput || (precioUnitario > 0)
                                                ? isDark ? 'text-slate-400' : 'text-slate-500'
                                                : 'text-red-500'
                                            }`}>
                                            {!precioUnitarioInput || (precioUnitario > 0)
                                                ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                                : t('chinese.ordersPage.modals.quote.validation.enterPrice', { defaultValue: 'Ingresa un precio mayor a 0' })}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {t('chinese.ordersPage.modals.quote.shippingPriceLabel')}
                                    </label>
                                    <div className="relative">
                                        <span className={`absolute left-3 top-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>¥</span>
                                        <input
                                            type="text"
                                            name="precioEnvio"
                                            inputMode="decimal"
                                            required
                                            value={precioEnvioInput}
                                            className={`w-full pl-8 pr-4 py-3 rounded-lg focus:outline-none transition-colors border ${isDark ? 'bg-slate-700 text-white border-slate-600' : ''
                                                } ${!precioEnvioInput || (precioEnvio >= 0)
                                                    ? isDark
                                                        ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                                        : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                                    : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                                }`}
                                            placeholder={t('chinese.ordersPage.modals.quote.shippingPricePlaceholder')}
                                            onChange={(e) => {
                                                let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                                const parts = raw.split('.');
                                                const intPart = (parts[0] || '').slice(0, 7);
                                                const decPart = (parts[1] || '').slice(0, 2);
                                                const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                                const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                                setPrecioEnvio(numero);
                                                setPrecioEnvioInput(cleaned);
                                            }}
                                        />
                                        <p className={`mt-1 text-xs ${!precioEnvioInput || (precioEnvio >= 0)
                                                ? isDark ? 'text-slate-400' : 'text-slate-500'
                                                : 'text-red-500'
                                            }`}>
                                            {!precioEnvioInput || (precioEnvio >= 0)
                                                ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                                : t('chinese.ordersPage.modals.quote.validation.enterValidPrice', { defaultValue: 'Ingresa un precio válido' })}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {t('chinese.ordersPage.modals.quote.heightLabel')}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                name="altura"
                                                inputMode="decimal"
                                                required
                                                value={alturaInput}
                                                className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${isDark ? 'bg-slate-700 text-white border-slate-600' : ''
                                                    } ${!alturaInput || (altura > 0)
                                                        ? isDark
                                                            ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                                            : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                                        : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                                    }`}
                                                placeholder={t('chinese.ordersPage.modals.quote.heightPlaceholder')}
                                                onChange={(e) => {
                                                    let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                                    const parts = raw.split('.');
                                                    const intPart = (parts[0] || '').slice(0, 7);
                                                    const decPart = (parts[1] || '').slice(0, 1);
                                                    const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                                    const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                                    setAltura(numero);
                                                    setAlturaInput(cleaned);
                                                }}
                                            />
                                            <span className={`absolute right-3 top-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>cm</span>
                                            <p className={`mt-1 text-xs ${!alturaInput || (altura > 0)
                                                    ? isDark ? 'text-slate-400' : 'text-slate-500'
                                                    : 'text-red-500'
                                                }`}>
                                                {!alturaInput || (altura > 0)
                                                    ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                                    : t('chinese.ordersPage.modals.quote.validation.enterHeight', { defaultValue: 'Ingresa una altura mayor a 0' })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {t('chinese.ordersPage.modals.quote.widthLabel')}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                name="anchura"
                                                inputMode="decimal"
                                                required
                                                value={anchuraInput}
                                                className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${isDark ? 'bg-slate-700 text-white border-slate-600' : ''
                                                    } ${!anchuraInput || (anchura > 0)
                                                        ? isDark
                                                            ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                                            : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                                        : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                                    }`}
                                                placeholder={t('chinese.ordersPage.modals.quote.widthPlaceholder')}
                                                onChange={(e) => {
                                                    let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                                    const parts = raw.split('.');
                                                    const intPart = (parts[0] || '').slice(0, 7);
                                                    const decPart = (parts[1] || '').slice(0, 1);
                                                    const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                                    const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                                    setAnchura(numero);
                                                    setAnchuraInput(cleaned);
                                                }}
                                            />
                                            <span className={`absolute right-3 top-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>cm</span>
                                            <p className={`mt-1 text-xs ${!anchuraInput || (anchura > 0)
                                                    ? isDark ? 'text-slate-400' : 'text-slate-500'
                                                    : 'text-red-500'
                                                }`}>
                                                {!anchuraInput || (anchura > 0)
                                                    ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                                    : t('chinese.ordersPage.modals.quote.validation.enterWidth', { defaultValue: 'Ingresa una anchura mayor a 0' })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {t('chinese.ordersPage.modals.quote.lengthLabel')}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                name="largo"
                                                inputMode="decimal"
                                                required
                                                value={largoInput}
                                                className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${isDark ? 'bg-slate-700 text-white border-slate-600' : ''
                                                    } ${!largoInput || (largo > 0)
                                                        ? isDark
                                                            ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                                            : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                                        : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                                    }`}
                                                placeholder={t('chinese.ordersPage.modals.quote.lengthPlaceholder')}
                                                onChange={(e) => {
                                                    let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                                    const parts = raw.split('.');
                                                    const intPart = (parts[0] || '').slice(0, 7);
                                                    const decPart = (parts[1] || '').slice(0, 1);
                                                    const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                                    const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                                    setLargo(numero);
                                                    setLargoInput(cleaned);
                                                }}
                                            />
                                            <span className={`absolute right-3 top-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>cm</span>
                                            <p className={`mt-1 text-xs ${!largoInput || (largo > 0)
                                                    ? isDark ? 'text-slate-400' : 'text-slate-500'
                                                    : 'text-red-500'
                                                }`}>
                                                {!largoInput || (largo > 0)
                                                    ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                                    : t('chinese.ordersPage.modals.quote.validation.enterLength', { defaultValue: 'Ingresa un largo mayor a 0' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {t('chinese.ordersPage.modals.quote.weightLabel')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="peso"
                                            inputMode="decimal"
                                            required
                                            value={pesoInput}
                                            className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${isDark ? 'bg-slate-700 text-white border-slate-600' : ''
                                                } ${!pesoInput || (peso > 0)
                                                    ? isDark
                                                        ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                                        : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                                    : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                                }`}
                                            placeholder={t('chinese.ordersPage.modals.quote.weightPlaceholder')}
                                            onChange={(e) => {
                                                let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                                const parts = raw.split('.');
                                                const intPart = (parts[0] || '').slice(0, 7);
                                                const decPart = (parts[1] || '').slice(0, 1);
                                                const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                                const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                                setPeso(numero);
                                                setPesoInput(cleaned);
                                            }}
                                        />
                                        <span className={`absolute right-3 top-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>kg</span>
                                        <p className={`mt-1 text-xs ${!pesoInput || (peso > 0)
                                                ? isDark ? 'text-slate-400' : 'text-slate-500'
                                                : 'text-red-500'
                                            }`}>
                                            {!pesoInput || (peso > 0)
                                                ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                                : t('chinese.ordersPage.modals.quote.validation.enterWeight', { defaultValue: 'Ingresa un peso mayor a 0' })}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {t('chinese.ordersPage.modals.quote.totalToPay')}
                                    </label>
                                    <div className={`px-4 py-3 border rounded-lg ${isDark ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-700' : 'bg-gradient-to-r from-green-50 to-emerald-50 border-slate-200'}`}>
                                        {(() => {
                                            const qty = Number(pedido.cantidad || 0);
                                            const unitPrice = Number(precioUnitario || 0);
                                            const shipping = Number(precioEnvio || 0);
                                            const totalCNY = (unitPrice * qty) + shipping;
                                            const totalUSD = cnyRate && cnyRate > 0 ? totalCNY / cnyRate : 0;
                                            return (
                                                <div className="space-y-1">
                                                    <div className={`font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                                        {`¥${totalCNY.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                    </div>
                                                    <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                                        {cnyLoading ? '...' : `≈ $${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3 pt-4">
                                    <Button type="button" variant="outline" onClick={handleClose}>
                                        {t('chinese.ordersPage.modals.quote.cancel')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={!(
                                            precioUnitario > 0 && String(Math.trunc(precioUnitario)).length <= 7 &&
                                            precioEnvio >= 0 &&
                                            altura > 0 &&
                                            anchura > 0 &&
                                            largo > 0 &&
                                            peso > 0
                                        )}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t('chinese.ordersPage.modals.quote.sendQuote')}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {lightboxImg && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setLightboxImg(null)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setLightboxImg(null); }}
                    role="presentation"
                >
                    <img
                        src={lightboxImg}
                        alt=""
                        className="max-h-[90vh] max-w-full object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
});

export default CotizarModal;
