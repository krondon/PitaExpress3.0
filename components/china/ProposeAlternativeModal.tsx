"use client";
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, ImageIcon, Send, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';
import Image from 'next/image';

interface ProposeAlternativeModalProps {
    isOpen: boolean;
    onClose: () => void;
    pedido: {
        id: number;
        producto: string;
        cliente: string;
        alternativeRejectionReason?: string | null;
    } | null;
    onSuccess?: () => void;
}

export default function ProposeAlternativeModal({
    isOpen,
    onClose,
    pedido,
    onSuccess,
}: ProposeAlternativeModalProps) {
    const { t } = useTranslation();
    const [altProductName, setAltProductName] = useState('');
    const [altDescription, setAltDescription] = useState('');

    const [altImageFile, setAltImageFile] = useState<File | null>(null);
    const [creating, setCreating] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setAltProductName('');
            setAltDescription('');
            setAltDescription('');
            setAltImageFile(null);
            setAltImageFile(null);
            setIsClosing(false);
            onClose();
        }, 300);
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast({
                    title: t('chinese.ordersPage.modals.proposeAlternative.toasts.fileTooBigTitle', { defaultValue: 'Archivo muy grande' }),
                    description: t('chinese.ordersPage.modals.proposeAlternative.toasts.fileTooBigDesc', { defaultValue: 'La imagen debe ser menor a 5MB' })
                });
                return;
            }
            setAltImageFile(file);
        }
    };

    const handleSubmit = async () => {
        if (!pedido) return;
        if (!altProductName.trim()) {
            toast({
                title: t('chinese.ordersPage.modals.proposeAlternative.toasts.nameRequiredTitle', { defaultValue: 'Nombre requerido' }),
                description: t('chinese.ordersPage.modals.proposeAlternative.toasts.nameRequiredDesc', { defaultValue: 'Debes ingresar el nombre del producto alternativo' })
            });
            return;
        }

        try {
            setCreating(true);
            const supabase = getSupabaseBrowserClient();

            // Subir imagen si existe
            let imageUrl: string | undefined;
            if (altImageFile) {
                const fileExt = altImageFile.name.split('.').pop();
                const fileName = `alternative_${pedido.id}_${Date.now()}.${fileExt}`;
                const filePath = `product-alternatives/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('orders')
                    .upload(filePath, altImageFile);

                if (uploadError) {
                    console.error('Error uploading image:', uploadError);
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('orders')
                        .getPublicUrl(filePath);
                    imageUrl = publicUrl;
                }
            }

            // Obtener ID del usuario China actual
            const { data: { user } } = await supabase.auth.getUser();

            // Crear alternativa vía API
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
                title: t('chinese.ordersPage.modals.proposeAlternative.toasts.successTitle', { defaultValue: 'Alternativa propuesta' }),
                description: t('chinese.ordersPage.modals.proposeAlternative.toasts.successDesc', { name: altProductName, defaultValue: `Se envió "${altProductName}" como alternativa al cliente` })
            });

            handleClose();
            onSuccess?.();
        } catch (error: any) {
            console.error('Error proposing alternative:', error);
            toast({
                title: t('chinese.ordersPage.modals.proposeAlternative.toasts.errorTitle', { defaultValue: 'Error' }),
                description: error.message || t('chinese.ordersPage.modals.proposeAlternative.toasts.errorDesc', { defaultValue: 'No se pudo proponer la alternativa' })
            });
        } finally {
            setCreating(false);
        }
    };

    if (!isOpen && !isClosing) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'animate-in fade-in'}`}
            onClick={handleBackdropClick}
        >
            <div
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ${isClosing
                    ? 'translate-y-full scale-95 opacity-0'
                    : 'animate-in slide-in-from-bottom-4 zoom-in-95'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">{t('chinese.ordersPage.modals.proposeAlternative.title', { defaultValue: 'Proponer Alternativa' })}</h2>
                            <p className="text-blue-100 text-sm mt-1">{t('chinese.ordersPage.modals.proposeAlternative.subtitle', { id: pedido?.id, client: pedido?.cliente, defaultValue: `Pedido #${pedido?.id} - ${pedido?.cliente}` })}</p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Alerta de Rechazo Previo */}
                    {pedido?.alternativeRejectionReason && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 animate-in slide-in-from-top-2">
                            <p className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">
                                {t('chinese.ordersPage.modals.proposeAlternative.rejectionReasonTitle', { defaultValue: 'Motivo del rechazo anterior:' })}
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-200 italic">
                                &quot;{pedido.alternativeRejectionReason}&quot;
                            </p>
                        </div>
                    )}

                    {/* Producto Original */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{t('chinese.ordersPage.modals.proposeAlternative.originalProductTitle', { defaultValue: 'Producto original solicitado:' })}</p>
                        <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mt-1">{pedido?.producto}</p>
                    </div>

                    {/* Nombre del Producto Alternativo */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <span>{t('chinese.ordersPage.modals.proposeAlternative.productNameLabel', { defaultValue: 'Nombre del Producto Alternativo' })}</span>
                            <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={altProductName}
                            onChange={(e) => setAltProductName(e.target.value)}
                            placeholder={t('chinese.ordersPage.modals.proposeAlternative.productNamePlaceholder', { defaultValue: 'Ej: Samsung S25 Ultra' })}
                            className="h-12"
                        />
                    </div>

                    {/* Descripción */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">{t('chinese.ordersPage.modals.proposeAlternative.descriptionLabel', { defaultValue: 'Descripción / Razón' })}</Label>
                        <Textarea
                            value={altDescription}
                            onChange={(e) => setAltDescription(e.target.value)}
                            placeholder={t('chinese.ordersPage.modals.proposeAlternative.descriptionPlaceholder', { defaultValue: 'Explica por qué propones esta alternativa y las diferencias con el producto original...' })}
                            rows={4}
                            className="resize-none"
                        />
                        <p className="text-xs text-slate-500">{t('chinese.ordersPage.modals.proposeAlternative.descriptionHelp', { defaultValue: 'Opcional: Ayuda al cliente a entender por qué esta es una buena alternativa' })}</p>
                    </div>



                    {/* Imagen */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            {t('chinese.ordersPage.modals.proposeAlternative.imageLabel', { defaultValue: 'Imagen del Producto' })}
                        </Label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                        />
                        {altImageFile ? (
                            <div className="relative">
                                <Image
                                    src={URL.createObjectURL(altImageFile)}
                                    alt="Alternativa"
                                    width={600}
                                    height={400}
                                    className="w-full h-48 object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700"
                                    unoptimized
                                />
                                <button
                                    onClick={() => setAltImageFile(null)}
                                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                                <Upload className="h-8 w-8" />
                                <span className="text-sm font-medium">{t('chinese.ordersPage.modals.proposeAlternative.uploadImage', { defaultValue: 'Haz clic para subir imagen' })}</span>
                                <span className="text-xs">{t('chinese.ordersPage.modals.proposeAlternative.maxSize', { defaultValue: 'Máximo 5MB' })}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-6 rounded-b-2xl flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={creating}
                        className="flex-1"
                    >
                        {t('chinese.ordersPage.modals.proposeAlternative.cancel', { defaultValue: 'Cancelar' })}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={creating || !altProductName.trim()}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                        {creating ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                {t('chinese.ordersPage.modals.proposeAlternative.submitting', { defaultValue: 'Enviando...' })}
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                {t('chinese.ordersPage.modals.proposeAlternative.submit', { defaultValue: 'Proponer Alternativa' })}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
