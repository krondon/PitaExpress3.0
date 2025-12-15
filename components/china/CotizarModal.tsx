"use client";
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useCNYConversion } from '@/hooks/use-cny-conversion';
import { useTheme } from 'next-themes';

interface Pedido {
    id: number;
    cliente: string;
    producto: string;
    cantidad: number;
    especificaciones?: string;
}

interface CotizarModalProps {
    open: boolean;
    pedido?: Pedido;
    onClose: () => void;
    onSubmit: (pedido: Pedido, precioUnitario: number, precioEnvio: number, altura: number, anchura: number, largo: number, peso: number) => void | Promise<void>;
}

export default function CotizarModal({ open, pedido, onClose, onSubmit }: CotizarModalProps) {
    const { t } = useTranslation();
    const { cnyRate } = useCNYConversion();
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const [isClosing, setIsClosing] = useState(false);

    // Estado del formulario
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

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) {
            // Reset form when modal closes
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
    }, [open]);

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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
                ref={modalRef}
                className={`${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-2xl mx-4 w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ${isClosing
                        ? 'translate-y-full scale-95 opacity-0'
                        : 'animate-in slide-in-from-bottom-4 duration-300'
                    }`}
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className={`text-xl font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {t('chinese.ordersPage.modals.quote.title')}
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClose}
                        className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : ''}`}
                    >
                        <span className={`text-2xl ${mounted && theme === 'dark' ? 'text-white' : ''}`}>×</span>
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Resumen del pedido */}
                    <div className={`p-4 rounded-lg border ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-700' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}>
                        <h4 className={`font-semibold mb-3 flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            <Package className="h-4 w-4" />
                            {t('chinese.ordersPage.modals.quote.summaryTitle')}
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {t('chinese.ordersPage.modals.quote.client')}
                                </p>
                                <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{pedido.cliente}</p>
                            </div>
                            <div>
                                <p className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {t('chinese.ordersPage.modals.quote.product')}
                                </p>
                                <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{pedido.producto}</p>
                            </div>
                            <div>
                                <p className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {t('chinese.ordersPage.modals.quote.quantity')}
                                </p>
                                <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{pedido.cantidad}</p>
                            </div>
                            <div>
                                <p className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {t('chinese.ordersPage.modals.quote.specifications')}
                                </p>
                                <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                                    {pedido.especificaciones || t('chinese.ordersPage.modals.quote.specificationsNA')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Precio unitario */}
                    <div className="space-y-2">
                        <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            {t('chinese.ordersPage.modals.quote.unitPriceLabel')}
                        </label>
                        <div className="relative">
                            <span className={`absolute left-3 top-3 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>¥</span>
                            <input
                                type="text"
                                name="precio"
                                inputMode="decimal"
                                required
                                value={precioUnitarioInput}
                                className={`w-full pl-8 pr-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''
                                    } ${!precioUnitarioInput || (precioUnitario > 0)
                                        ? mounted && theme === 'dark'
                                            ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                            : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                        : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                    }`}
                                placeholder={t('chinese.ordersPage.modals.quote.unitPricePlaceholder')}
                                onChange={(e) => {
                                    let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                    const parts = raw.split('.');
                                    let intPart = (parts[0] || '').slice(0, 7);
                                    let decPart = (parts[1] || '').slice(0, 2);
                                    const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                    const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                    setPrecioUnitario(numero);
                                    setPrecioUnitarioInput(cleaned);
                                }}
                            />
                            <p className={`mt-1 text-xs ${!precioUnitarioInput || (precioUnitario > 0)
                                    ? mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                    : 'text-red-500'
                                }`}>
                                {!precioUnitarioInput || (precioUnitario > 0)
                                    ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                    : t('chinese.ordersPage.modals.quote.validation.enterPrice', { defaultValue: 'Ingresa un precio mayor a 0' })}
                            </p>
                        </div>
                    </div>

                    {/* Precio de envío */}
                    <div className="space-y-2">
                        <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            {t('chinese.ordersPage.modals.quote.shippingPriceLabel')}
                        </label>
                        <div className="relative">
                            <span className={`absolute left-3 top-3 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>¥</span>
                            <input
                                type="text"
                                name="precioEnvio"
                                inputMode="decimal"
                                required
                                value={precioEnvioInput}
                                className={`w-full pl-8 pr-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''
                                    } ${!precioEnvioInput || (precioEnvio >= 0)
                                        ? mounted && theme === 'dark'
                                            ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                            : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                        : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                    }`}
                                placeholder={t('chinese.ordersPage.modals.quote.shippingPricePlaceholder')}
                                onChange={(e) => {
                                    let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                    const parts = raw.split('.');
                                    let intPart = (parts[0] || '').slice(0, 7);
                                    let decPart = (parts[1] || '').slice(0, 2);
                                    const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                    const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                    setPrecioEnvio(numero);
                                    setPrecioEnvioInput(cleaned);
                                }}
                            />
                            <p className={`mt-1 text-xs ${!precioEnvioInput || (precioEnvio >= 0)
                                    ? mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                    : 'text-red-500'
                                }`}>
                                {!precioEnvioInput || (precioEnvio >= 0)
                                    ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                    : t('chinese.ordersPage.modals.quote.validation.enterValidPrice', { defaultValue: 'Ingresa un precio válido' })}
                            </p>
                        </div>
                    </div>

                    {/* Dimensiones */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                {t('chinese.ordersPage.modals.quote.heightLabel')}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="altura"
                                    inputMode="decimal"
                                    required
                                    value={alturaInput}
                                    className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''
                                        } ${!alturaInput || (altura > 0)
                                            ? mounted && theme === 'dark'
                                                ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                            : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                        }`}
                                    placeholder={t('chinese.ordersPage.modals.quote.heightPlaceholder')}
                                    onChange={(e) => {
                                        let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                        const parts = raw.split('.');
                                        let intPart = (parts[0] || '').slice(0, 7);
                                        let decPart = (parts[1] || '').slice(0, 1);
                                        const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                        const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                        setAltura(numero);
                                        setAlturaInput(cleaned);
                                    }}
                                />
                                <span className={`absolute right-3 top-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>cm</span>
                                <p className={`mt-1 text-xs ${!alturaInput || (altura > 0)
                                        ? mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                        : 'text-red-500'
                                    }`}>
                                    {!alturaInput || (altura > 0)
                                        ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                        : t('chinese.ordersPage.modals.quote.validation.enterHeight', { defaultValue: 'Ingresa una altura mayor a 0' })}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                {t('chinese.ordersPage.modals.quote.widthLabel')}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="anchura"
                                    inputMode="decimal"
                                    required
                                    value={anchuraInput}
                                    className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''
                                        } ${!anchuraInput || (anchura > 0)
                                            ? mounted && theme === 'dark'
                                                ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                            : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                        }`}
                                    placeholder={t('chinese.ordersPage.modals.quote.widthPlaceholder')}
                                    onChange={(e) => {
                                        let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                        const parts = raw.split('.');
                                        let intPart = (parts[0] || '').slice(0, 7);
                                        let decPart = (parts[1] || '').slice(0, 1);
                                        const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                        const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                        setAnchura(numero);
                                        setAnchuraInput(cleaned);
                                    }}
                                />
                                <span className={`absolute right-3 top-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>cm</span>
                                <p className={`mt-1 text-xs ${!anchuraInput || (anchura > 0)
                                        ? mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                        : 'text-red-500'
                                    }`}>
                                    {!anchuraInput || (anchura > 0)
                                        ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                        : t('chinese.ordersPage.modals.quote.validation.enterWidth', { defaultValue: 'Ingresa una anchura mayor a 0' })}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                {t('chinese.ordersPage.modals.quote.lengthLabel')}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="largo"
                                    inputMode="decimal"
                                    required
                                    value={largoInput}
                                    className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''
                                        } ${!largoInput || (largo > 0)
                                            ? mounted && theme === 'dark'
                                                ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                            : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                        }`}
                                    placeholder={t('chinese.ordersPage.modals.quote.lengthPlaceholder')}
                                    onChange={(e) => {
                                        let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                        const parts = raw.split('.');
                                        let intPart = (parts[0] || '').slice(0, 7);
                                        let decPart = (parts[1] || '').slice(0, 1);
                                        const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                        const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                        setLargo(numero);
                                        setLargoInput(cleaned);
                                    }}
                                />
                                <span className={`absolute right-3 top-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>cm</span>
                                <p className={`mt-1 text-xs ${!largoInput || (largo > 0)
                                        ? mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                        : 'text-red-500'
                                    }`}>
                                    {!largoInput || (largo > 0)
                                        ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                        : t('chinese.ordersPage.modals.quote.validation.enterLength', { defaultValue: 'Ingresa un largo mayor a 0' })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Peso */}
                    <div className="space-y-2">
                        <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            {t('chinese.ordersPage.modals.quote.weightLabel')}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                name="peso"
                                inputMode="decimal"
                                required
                                value={pesoInput}
                                className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''
                                    } ${!pesoInput || (peso > 0)
                                        ? mounted && theme === 'dark'
                                            ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600'
                                            : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                        : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                                    }`}
                                placeholder={t('chinese.ordersPage.modals.quote.weightPlaceholder')}
                                onChange={(e) => {
                                    let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                                    const parts = raw.split('.');
                                    let intPart = (parts[0] || '').slice(0, 7);
                                    let decPart = (parts[1] || '').slice(0, 1);
                                    const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                                    const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                                    setPeso(numero);
                                    setPesoInput(cleaned);
                                }}
                            />
                            <span className={`absolute right-3 top-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>kg</span>
                            <p className={`mt-1 text-xs ${!pesoInput || (peso > 0)
                                    ? mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                    : 'text-red-500'
                                }`}>
                                {!pesoInput || (peso > 0)
                                    ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' })
                                    : t('chinese.ordersPage.modals.quote.validation.enterWeight', { defaultValue: 'Ingresa un peso mayor a 0' })}
                            </p>
                        </div>
                    </div>

                    {/* Total a pagar */}
                    <div className="space-y-2">
                        <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            {t('chinese.ordersPage.modals.quote.totalToPay')}
                        </label>
                        <div className={`px-4 py-3 border rounded-lg ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-700' : 'bg-gradient-to-r from-green-50 to-emerald-50 border-slate-200'}`}>
                            {(() => {
                                const qty = Number(pedido.cantidad || 0);
                                const unitPrice = Number(precioUnitario || 0);
                                const shipping = Number(precioEnvio || 0);
                                const totalCNY = (unitPrice * qty) + shipping;
                                const totalUSD = cnyRate && cnyRate > 0 ? totalCNY / cnyRate : 0;
                                return (
                                    <div className="space-y-1">
                                        <div className={`font-bold ${mounted && theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                                            {`¥${totalCNY.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                        </div>
                                        <div className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                            ≈ ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                        >
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
    );
}
