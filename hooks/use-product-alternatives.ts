import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface ProductAlternative {
    id: number;
    order_id: number;
    alternative_product_name: string;
    alternative_description: string | null;
    alternative_image_url: string | null;
    alternative_price: number | null;
    proposed_by_china_id: string | null;
    status: 'pending' | 'accepted' | 'rejected';
    client_response_notes: string | null;
    created_at: string;
    updated_at: string;
    orders?: {
        id: number;
        productName: string;
        description: string;
        client_id: string;
        pdfRoutes: string | null;
    };
}

interface UseProductAlternativesOptions {
    orderId?: number;
    clientId?: string;
    status?: 'pending' | 'accepted' | 'rejected';
    enabled?: boolean;
}

export function useProductAlternatives(options: UseProductAlternativesOptions = {}) {
    const { orderId, clientId, status, enabled = true } = options;
    const [alternatives, setAlternatives] = useState<ProductAlternative[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAlternatives = useCallback(async () => {
        if (!enabled) return;

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (orderId) params.append('order_id', orderId.toString());
            if (clientId) params.append('client_id', clientId);
            if (status) params.append('status', status);

            const response = await fetch(`/api/product-alternatives?${params.toString()}`, { cache: 'no-store' });

            if (!response.ok) {
                throw new Error('Error al obtener alternativas');
            }

            const data = await response.json();
            console.debug('[useProductAlternatives] Fetched alternatives:', data);
            setAlternatives(data);
        } catch (err: any) {
            console.error('Error fetching alternatives:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [orderId, clientId, status, enabled]);

    useEffect(() => {
        fetchAlternatives();
    }, [fetchAlternatives]);

    // Realtime subscription
    useEffect(() => {
        if (!enabled) return;

        const supabase = getSupabaseBrowserClient();
        const channel = supabase
            .channel('product-alternatives-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'product_alternatives',
                    filter: orderId ? `order_id=eq.${orderId}` : undefined,
                },
                () => {
                    fetchAlternatives();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [enabled, orderId, fetchAlternatives]);

    const createAlternative = async (data: {
        order_id: number;
        alternative_product_name: string;
        alternative_description?: string;
        alternative_image_url?: string;
        alternative_price?: number;
        proposed_by_china_id?: string;
    }) => {
        try {
            const response = await fetch('/api/product-alternatives', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al crear alternativa');
            }

            const newAlternative = await response.json();
            await fetchAlternatives();
            return newAlternative;
        } catch (err: any) {
            console.error('Error creating alternative:', err);
            throw err;
        }
    };

    const updateAlternative = async (
        id: number,
        data: {
            status: 'accepted' | 'rejected';
            client_response_notes?: string;
        }
    ) => {
        try {
            const response = await fetch(`/api/product-alternatives/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al actualizar alternativa');
            }

            const updated = await response.json();
            await fetchAlternatives();
            return updated;
        } catch (err: any) {
            console.error('Error updating alternative:', err);
            throw err;
        }
    };

    const deleteAlternative = async (id: number) => {
        try {
            const response = await fetch(`/api/product-alternatives/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al eliminar alternativa');
            }

            await fetchAlternatives();
        } catch (err: any) {
            console.error('Error deleting alternative:', err);
            throw err;
        }
    };

    return {
        alternatives,
        loading,
        error,
        refetch: fetchAlternatives,
        createAlternative,
        updateAlternative,
        deleteAlternative,
    };
}
