import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronDown, ChevronUp, DollarSign, Layers } from 'lucide-react';
import { ClientOrderCard } from './ClientOrderCard';
import { PriceDisplay } from '@/components/shared/PriceDisplay';

export interface ClientOrderGroupData {
    groupId: string;
    date: string;
    orders: any[]; // Should be Order[]
    minId: string | number;
    maxId: string | number;
    totalAmount: number;
    canPayAll: boolean;
}

interface ClientOrderGroupProps {
    group: ClientOrderGroupData;
    mounted: boolean;
    theme: string | undefined;
    t: (key: string, options?: any) => string;
    getStatusColor: (status: string) => string;
    getStatusText: (status: string) => string;
    getProgressColor: (progress: number) => string;
    loadingReviews: Record<string, boolean>;
    orderReviews: Record<string, any>;
    alternatives: any[];
    normalizeOrderId: (id: string | number) => string;
    handlers: {
        openViewReviewModal: (order: any) => void;
        openReviewModal: (order: any) => void;
        openReviewAlternativeModal: (order: any) => void;
        openCancelOrderModal: (order: any) => void;
        handlePaymentClick: (order: any) => void;
        handleViewDetails: (order: any) => void;
        openTrackingModal: (order: any) => void;
        handleBulkPayment: (group: ClientOrderGroupData) => void;
    };
}

export const ClientOrderGroup: React.FC<ClientOrderGroupProps> = ({
    group,
    mounted,
    theme,
    t,
    getStatusColor,
    getStatusText,
    getProgressColor,
    loadingReviews,
    orderReviews,
    alternatives,
    normalizeOrderId,
    handlers
}) => {
    const [expanded, setExpanded] = useState(true);

    const getTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Hace un momento';
        if (mins < 60) return `Hace ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Hace ${hours} h`;
        return new Date(dateStr).toLocaleDateString();
    };

    return (
        <div className={`mb-6 border rounded-xl shadow-sm overflow-hidden transition-all duration-300 ${mounted && theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Header del Grupo */}
            <div
                className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-colors ${mounted && theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}
                onClick={(e) => {
                    // Evitar colapsar si se hace clic en el botón de pagar
                    if ((e.target as HTMLElement).closest('button')) return;
                    setExpanded(!expanded);
                }}
            >
                <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold shrink-0 ${mounted && theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                        <Layers className="h-5 w-5" />
                    </div>

                    <div>
                        <h3 className={`text-lg font-bold flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                            <span className="font-mono text-blue-600 dark:text-blue-400">
                                {group.orders.length > 1
                                    ? `#ORD-${group.minId} - ${group.maxId}`
                                    : `#ORD-${group.minId}`
                                }
                            </span>
                            {group.orders.length > 1 && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                    {group.orders.length} pedidos
                                </Badge>
                            )}
                        </h3>

                        <div className={`text-sm flex items-center gap-2 mt-1 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            <Calendar className="h-3 w-3" />
                            <span>{getTimeAgo(group.date)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {group.canPayAll && (
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                            onClick={(e) => {
                                e.stopPropagation();
                                handlers.handleBulkPayment(group);
                            }}
                        >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pagar
                            <span className="ml-1 opacity-90 text-xs bg-black/10 px-1.5 py-0.5 rounded">
                                ${group.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </Button>
                    )}

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Lista de Pedidos (Acordeón con animación) */}
            <div className={`grid transition-all duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className={`p-4 pl-4 sm:pl-8 space-y-3 border-t ${mounted && theme === 'dark' ? 'bg-slate-900/30 border-slate-700' : 'bg-slate-50/50 border-slate-200'}`}>
                        {group.orders.map((order) => (
                            <ClientOrderCard
                                key={order.id}
                                order={order}
                                mounted={mounted}
                                theme={theme}
                                t={t}
                                getStatusColor={getStatusColor}
                                getStatusText={getStatusText}
                                getProgressColor={getProgressColor}
                                loadingReviews={loadingReviews}
                                orderReviews={orderReviews}
                                alternatives={alternatives}
                                normalizeOrderId={normalizeOrderId}
                                handlers={handlers}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
