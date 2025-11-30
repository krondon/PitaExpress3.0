"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { X, CheckCircle, XCircle, Package, DollarSign, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useProductAlternatives } from '@/hooks/use-product-alternatives';

interface ProductAlternative {
    id: number;
    order_id: number;
    alternative_product_name: string;
    alternative_description: string | null;
    alternative_image_url: string | null;
    alternative_price: number | null;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}

interface ReviewAlternativeModalProps {
    isOpen: boolean;
    onClose: () => void;
    alternative: ProductAlternative | null;
    originalProduct: {
        name: string;
        description?: string;
        imageUrl?: string;
    };
    onSuccess?: () => void;
}

export default function ReviewAlternativeModal({
    isOpen,
    onClose,
    alternative,
    originalProduct,
    onSuccess,
}: ReviewAlternativeModalProps) {
    const [clientNotes, setClientNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const { updateAlternative } = useProductAlternatives({ enabled: false });

    const handleClose = () => {
        setClientNotes('');
        onClose();
    };

    const handleAccept = async () => {
        if (!alternative) return;

        try {
            setProcessing(true);
            await updateAlternative(alternative.id, {
                status: 'accepted',
                client_response_notes: clientNotes.trim() || undefined,
            });

            toast({
                title: 'Alternativa aceptada',
                description: `Has aceptado "${alternative.alternative_product_name}" como alternativa.`
            });

            handleClose();
            onSuccess?.();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'No se pudo aceptar la alternativa'
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!alternative) return;

        try {
            setProcessing(true);
            await updateAlternative(alternative.id, {
                status: 'rejected',
                client_response_notes: clientNotes.trim() || undefined,
            });

            toast({
                title: 'Alternativa rechazada',
                description: 'Se notificará a China sobre tu decisión.'
            });

            handleClose();
            onSuccess?.();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'No se pudo rechazar la alternativa'
            });
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen || !alternative) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Alternativa de Producto</h2>
                            <p className="text-blue-100 text-sm mt-1">Revisa la alternativa propuesta por China</p>
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
                    {/* Comparison Grid */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Original Product */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                <h3 className="font-semibold text-lg">Producto Original</h3>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
                                {originalProduct.imageUrl && (
                                    <img
                                        src={originalProduct.imageUrl}
                                        alt={originalProduct.name}
                                        className="w-full h-48 object-cover rounded-lg"
                                    />
                                )}
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">{originalProduct.name}</p>
                                    {originalProduct.description && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{originalProduct.description}</p>
                                    )}
                                </div>
                                <Badge className="bg-slate-200 text-slate-800 border-slate-300">Solicitado</Badge>
                            </div>
                        </div>

                        {/* Alternative Product */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                <h3 className="font-semibold text-lg">Producto Alternativo</h3>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 space-y-3">
                                {alternative.alternative_image_url && (
                                    <img
                                        src={alternative.alternative_image_url}
                                        alt={alternative.alternative_product_name}
                                        className="w-full h-48 object-cover rounded-lg"
                                    />
                                )}
                                <div>
                                    <p className="font-semibold text-blue-900 dark:text-blue-200">{alternative.alternative_product_name}</p>
                                    {alternative.alternative_description && (
                                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{alternative.alternative_description}</p>
                                    )}
                                </div>
                                {alternative.alternative_price && (
                                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                        <DollarSign className="h-4 w-4" />
                                        <span className="font-semibold">${alternative.alternative_price.toLocaleString()} USD</span>
                                    </div>
                                )}
                                <Badge className="bg-blue-600 text-white border-blue-700">Propuesto</Badge>
                            </div>
                        </div>
                    </div>

                    {/* Client Notes */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                            <label className="font-semibold">Tus comentarios (opcional)</label>
                        </div>
                        <Textarea
                            value={clientNotes}
                            onChange={(e) => setClientNotes(e.target.value)}
                            placeholder="Agrega cualquier comentario o pregunta sobre la alternativa..."
                            rows={3}
                            className="resize-none"
                        />
                    </div>

                    {/* Info Box */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            <strong>Nota:</strong> Si aceptas esta alternativa, tu pedido se actualizará con el nuevo producto. Si la rechazas, China podrá proponer otra alternativa o buscar el producto original.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-6 rounded-b-2xl flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={processing}
                        className="flex-1"
                    >
                        Cerrar
                    </Button>
                    <Button
                        onClick={handleReject}
                        disabled={processing}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                        {processing ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Rechazar
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleAccept}
                        disabled={processing}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                        {processing ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Aceptar Alternativa
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
