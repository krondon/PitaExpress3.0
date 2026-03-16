"use client";
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, ImageIcon, Send, Upload, Search, XCircle, User, Tag, Calendar, Truck, MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from 'next-themes';
import Image from 'next/image';

interface ProposeAlternativeModalProps {
    isOpen: boolean;
    onClose: () => void;
    pedido: {
        id: number;
        producto: string;
        cliente: string;
        imgs?: string[];
        cantidad?: number;
        fecha?: string;
        shippingType?: string;
        deliveryType?: string;
        alternativeRejectionReason?: string | null;
    } | null;
    onSuccess?: () => void;
}

const DESC_MAX = 500;

const shippingLabels: Record<string, string> = { air: 'Aéreo', maritime: 'Marítimo', doorToDoor: 'Puerta a puerta' };
const deliveryLabels: Record<string, string> = { office: 'Oficina', warehouse: 'Almacén', pickup: 'Retiro en tienda', delivery: 'Domicilio' };

export default function ProposeAlternativeModal({
    isOpen,
    onClose,
    pedido,
    onSuccess,
}: ProposeAlternativeModalProps) {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [altProductName, setAltProductName] = useState('');
    const [altDescription, setAltDescription] = useState('');
    const [altImageFile, setAltImageFile] = useState<File | null>(null);
    const [creating, setCreating] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useState(() => { setMounted(true); });

    const isDark = mounted && theme === 'dark';

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setAltProductName('');
            setAltDescription('');
            setAltImageFile(null);
            setIsClosing(false);
            onClose();
        }, 300);
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (lightboxImg) return;
        if (e.target === e.currentTarget) handleClose();
    };

    const processFile = (file: File) => {
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: 'Archivo muy grande', description: 'La imagen debe ser menor a 5MB' });
            return;
        }
        if (!file.type.startsWith('image/')) {
            toast({ title: 'Formato inválido', description: 'Solo se permiten imágenes' });
            return;
        }
        setAltImageFile(file);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleSubmit = async () => {
        if (!pedido) return;
        if (!altProductName.trim()) {
            toast({ title: 'Nombre requerido', description: 'Debes ingresar el nombre del producto alternativo' });
            return;
        }

        try {
            setCreating(true);
            const supabase = getSupabaseBrowserClient();

            let imageUrl: string | undefined;
            if (altImageFile) {
                const fileExt = altImageFile.name.split('.').pop();
                const fileName = `alternative_${pedido.id}_${Date.now()}.${fileExt}`;
                const filePath = `product-alternatives/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('orders').upload(filePath, altImageFile);
                if (uploadError) {
                    console.error('Error uploading image:', uploadError);
                } else {
                    const { data: { publicUrl } } = supabase.storage.from('orders').getPublicUrl(filePath);
                    imageUrl = publicUrl;
                }
            }

            const { data: { user } } = await supabase.auth.getUser();

            const response = await fetch('/api/product-alternatives', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: pedido.id,
                    alternative_product_name: altProductName.trim(),
                    alternative_description: altDescription.trim() || null,
                    alternative_image_url: imageUrl || null,
                    proposed_by_china_id: user?.id || null,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al crear alternativa');
            }

            toast({
                title: 'Alternativa propuesta',
                description: `Se envió "${altProductName}" como alternativa al cliente`,
            });

            handleClose();
            onSuccess?.();
        } catch (error: any) {
            console.error('Error proposing alternative:', error);
            toast({ title: 'Error', description: error.message || 'No se pudo proponer la alternativa' });
        } finally {
            setCreating(false);
        }
    };

    if (!isOpen && !isClosing) return null;

    const previewUrl = altImageFile ? URL.createObjectURL(altImageFile) : null;
    const productImg = pedido?.imgs && pedido.imgs.length > 0 ? pedido.imgs[0] : null;

    return (
        <>
            <div
                className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'animate-in fade-in'}`}
                onClick={handleBackdropClick}
            >
                <div
                    className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto transition-all duration-300 ${isClosing
                        ? 'translate-y-full scale-95 opacity-0'
                        : 'animate-in slide-in-from-bottom-4 zoom-in-95'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className={`sticky top-0 z-10 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b px-5 py-4 rounded-t-2xl`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    Proponer Alternativa
                                </h3>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleClose} className={`h-8 w-8 p-0 shrink-0 ${isDark ? 'hover:bg-slate-700' : ''}`}>
                                <XCircle className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Rejection alert (full-width, above columns) */}
                    {pedido?.alternativeRejectionReason && (
                        <div className="px-5 pt-4">
                            <div className={`flex items-start gap-3 rounded-xl p-3.5 border ${isDark ? 'bg-red-900/15 border-red-800/50' : 'bg-red-50 border-red-200'} animate-in slide-in-from-top-2`}>
                                <span className={`text-sm ${isDark ? 'text-red-400' : 'text-red-500'}`}>⚠️</span>
                                <div>
                                    <p className={`text-xs font-bold ${isDark ? 'text-red-300' : 'text-red-800'}`}>Motivo del rechazo anterior:</p>
                                    <p className={`text-xs mt-1 italic ${isDark ? 'text-red-200/80' : 'text-red-700'}`}>
                                        &quot;{pedido.alternativeRejectionReason}&quot;
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Two-column layout (same as Ver/Cotizar) */}
                    <div className="flex flex-col md:flex-row gap-5 p-5">
                        {/* LEFT: Original product image + info */}
                        <div className="md:w-2/5 shrink-0 space-y-4">
                            {/* Product image */}
                            {productImg ? (
                                <div
                                    className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-gray-200'} cursor-pointer group relative`}
                                    onClick={() => setLightboxImg(productImg)}
                                >
                                    <img
                                        src={productImg}
                                        alt={pedido?.producto}
                                        className="w-full h-52 md:h-64 object-cover transition-transform duration-200 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <Search className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                </div>
                            ) : (
                                <div className={`w-full h-52 md:h-64 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 ${isDark ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'}`}>
                                    <ImageIcon className="h-10 w-10 opacity-40" />
                                    <span className="text-xs">Sin imagen del producto</span>
                                </div>
                            )}

                            {/* Product info grid (mirrors Ver/Cotizar style) */}
                            <div className={`rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-gray-50'} p-3.5 space-y-2.5`}>
                                <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    <span className="font-mono text-xs">#ORD-{pedido?.id}</span> {pedido?.producto || '—'}
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                            <User className="h-3 w-3 inline mr-1" />Cliente
                                        </span>
                                        <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{pedido?.cliente || '—'}</p>
                                    </div>
                                    <div>
                                        <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                            <Tag className="h-3 w-3 inline mr-1" />Cantidad
                                        </span>
                                        <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{pedido?.cantidad ?? '—'}</p>
                                    </div>
                                    <div>
                                        <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                            <Calendar className="h-3 w-3 inline mr-1" />Fecha
                                        </span>
                                        <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                            {pedido?.fecha ? new Date(pedido.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                            <Truck className="h-3 w-3 inline mr-1" />Envío
                                        </span>
                                        <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                            {shippingLabels[pedido?.shippingType || ''] || pedido?.shippingType || '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Alternative form */}
                        <div className="flex-1 space-y-4">
                            {/* Product name */}
                            <div className="space-y-1.5">
                                <Label className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-300' : ''}`}>
                                    Nombre del Producto Alternativo
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={altProductName}
                                    onChange={(e) => setAltProductName(e.target.value)}
                                    placeholder="Ej: Samsung S25 Ultra"
                                    className={`h-11 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : ''}`}
                                    maxLength={200}
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : ''}`}>
                                        Descripción / Razón
                                    </Label>
                                    <span className={`text-[10px] tabular-nums ${altDescription.length > DESC_MAX * 0.9 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-slate-500' : 'text-gray-400')}`}>
                                        {altDescription.length}/{DESC_MAX}
                                    </span>
                                </div>
                                <Textarea
                                    value={altDescription}
                                    onChange={(e) => { if (e.target.value.length <= DESC_MAX) setAltDescription(e.target.value); }}
                                    placeholder="Explica por qué propones esta alternativa y las diferencias con el producto original..."
                                    rows={8}
                                    className={`resize-none ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : ''}`}
                                />
                                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                    Opcional: Ayuda al cliente a entender por qué esta es una buena alternativa
                                </p>
                            </div>

                            {/* Image upload */}
                            <div className="space-y-1.5">
                                <Label className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-300' : ''}`}>
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    Imagen de la Alternativa
                                </Label>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                                {previewUrl ? (
                                    <div className="relative group">
                                        <div
                                            className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-gray-200'} cursor-pointer`}
                                            onClick={() => setLightboxImg(previewUrl)}
                                        >
                                            <Image
                                                src={previewUrl}
                                                alt="Alternativa"
                                                width={600}
                                                height={300}
                                                className="w-full h-36 object-cover transition-transform duration-200 group-hover:scale-105"
                                                unoptimized
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center rounded-xl">
                                                <Search className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setAltImageFile(null); }}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500/90 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`w-full h-28 border-2 border-dashed rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-2 ${isDragging
                                            ? (isDark ? 'border-blue-400 bg-blue-900/20 text-blue-400' : 'border-blue-500 bg-blue-50 text-blue-600')
                                            : (isDark
                                                ? 'border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 hover:bg-slate-700/50'
                                                : 'border-slate-300 text-slate-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50')
                                            }`}
                                    >
                                        <Upload className={`h-6 w-6 transition-transform duration-200 ${isDragging ? 'scale-110' : ''}`} />
                                        <span className="text-xs font-medium">
                                            {isDragging ? 'Suelta la imagen aquí' : 'Haz clic o arrastra una imagen'}
                                        </span>
                                        <span className="text-[10px] opacity-60">Máx 5MB · JPG, PNG, WebP</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={`sticky bottom-0 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-gray-200'} border-t px-5 py-4 rounded-b-2xl flex gap-3`}>
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            disabled={creating}
                            className={`flex-1 ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}`}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={creating || !altProductName.trim()}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                        >
                            {creating ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Proponer Alternativa
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Lightbox */}
            {lightboxImg && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] animate-in fade-in duration-200 cursor-pointer p-6"
                    onClick={(e) => { e.stopPropagation(); setLightboxImg(null); }}
                >
                    <img
                        src={lightboxImg}
                        alt="Vista ampliada"
                        className="max-w-full max-h-full rounded-xl object-contain shadow-2xl animate-in zoom-in-90 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button onClick={() => setLightboxImg(null)} className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors">
                        <XCircle className="h-8 w-8" />
                    </button>
                </div>
            )}
        </>
    );
}
