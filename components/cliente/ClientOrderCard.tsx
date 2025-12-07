import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import {
    Star,
    AlertTriangle,
    XCircle,
    DollarSign,
    Eye,
    MapPin,
    Package
} from 'lucide-react';

interface ClientOrderCardProps {
    order: any; // Using any for now to avoid circular dependencies, ideally should be Order interface
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
    };
}

export const ClientOrderCard: React.FC<ClientOrderCardProps> = ({
    order,
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
    return (
        <div className={`p-4 md:p-6 rounded-xl border hover:shadow-md transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-700 to-slate-600 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'}`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6 mb-4">
                <div className="flex items-center gap-4 md:gap-6">
                    <div className={`p-3 rounded-lg shrink-0 ${mounted && theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                        <Package className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`} />
                    </div>
                    <div className="flex flex-col">
                        <p className={`font-bold text-sm md:text-base ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>#ORD-{order.id}</p>
                        <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{order.product}</p>
                    </div>
                    {/* Un solo badge basado en stateNum; fallback al badge de status si no hay stateNum */}
                    {typeof order.stateNum === 'number' ? (
                        <Badge className={`text-xs md:text-sm font-semibold px-3 py-1 transition-colors hover:brightness-110 hover:ring-1 ${mounted && theme === 'dark' ? (
                            order.stateNum === -1 ? 'bg-red-900/30 text-red-300 border-red-700 hover:bg-red-900/50 hover:ring-red-500/20' :
                                order.stateNum === 13 ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700 hover:bg-emerald-900/50 hover:ring-emerald-500/20' :
                                    order.stateNum === 12 ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:ring-gray-500/20' :
                                        order.stateNum === 11 ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50 hover:ring-green-500/20' :
                                            order.stateNum === 10 ? 'bg-orange-900/30 text-orange-300 border-orange-700 hover:bg-orange-900/50 hover:ring-orange-500/20' :
                                                (order.stateNum === 7 || order.stateNum === 8 || order.stateNum === 9) ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700 hover:bg-cyan-900/50 hover:ring-cyan-500/20' :
                                                    order.stateNum === 6 ? 'bg-blue-900/30 text-blue-300 border-blue-700 hover:bg-blue-900/50 hover:ring-blue-500/20' :
                                                        order.stateNum === 5 ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-yellow-500/20' :
                                                            order.stateNum === 4 ? 'bg-blue-900/30 text-blue-300 border-blue-700 hover:bg-blue-900/50 hover:ring-blue-500/20' :
                                                                order.stateNum === 3 ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50 hover:ring-green-500/20' :
                                                                    order.stateNum === 2 ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-yellow-500/20' :
                                                                        'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-yellow-500/20'
                        ) : (
                            order.stateNum === -1 ? 'bg-red-100 text-red-800 border-red-200 hover:bg-red-50 hover:ring-red-200' :
                                order.stateNum === 13 ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:ring-emerald-200' :
                                    order.stateNum === 12 ? 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-50 hover:ring-gray-200' :
                                        order.stateNum === 11 ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:ring-green-200' :
                                            order.stateNum === 10 ? 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-50 hover:ring-orange-200' :
                                                (order.stateNum === 7 || order.stateNum === 8 || order.stateNum === 9) ? 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-50 hover:ring-cyan-200' :
                                                    order.stateNum === 6 ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:ring-blue-200' :
                                                        order.stateNum === 5 ? 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-yellow-200' :
                                                            order.stateNum === 4 ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:ring-blue-200' :
                                                                order.stateNum === 3 ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:ring-green-200' :
                                                                    order.stateNum === 2 ? 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-yellow-200' :
                                                                        'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-yellow-200'
                        )
                            }`}>
                            {order.stateNum === -1 ? t('client.recentOrders.statuses.paymentRejected') :
                                order.stateNum === 5 ? t('client.recentOrders.statuses.paymentValidated') :
                                    order.stateNum === 6 ? t('client.recentOrders.statuses.packagingBox') :
                                        // 7 y 8 etiquetados como 9
                                        (order.stateNum === 7 || order.stateNum === 8 || order.stateNum === 9) ? t('client.recentOrders.statuses.sentFromChina') :
                                            order.stateNum === 10 ? t('client.recentOrders.statuses.inCustoms') :
                                                order.stateNum === 11 ? t('client.recentOrders.statuses.arriving') :
                                                    order.stateNum === 12 ? t('client.recentOrders.statuses.inStore') :
                                                        order.stateNum === 13 ? t('client.recentOrders.statuses.delivered') :
                                                            order.stateNum === 4 ? t('client.recentOrders.statuses.processing') :
                                                                order.stateNum === 3 ? t('client.recentOrders.statuses.quoted') :
                                                                    order.stateNum === 2 ? t('client.recentOrders.statuses.pending') :
                                                                        t('client.recentOrders.statuses.pending')}
                        </Badge>
                    ) : (
                        <Badge className={`${getStatusColor(order.status)} text-xs md:text-sm font-semibold px-3 py-1`}>
                            {getStatusText(order.status)}
                        </Badge>
                    )}
                </div>
                <div className="text-right">
                    <p className={`text-[10px] md:text-[11px] uppercase tracking-wide font-medium ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {order.status === 'pending' && t('client.recentOrders.budget')}
                        {order.status === 'quoted' && t('client.recentOrders.statuses.quoted')}
                        {order.status !== 'pending' && order.status !== 'quoted' && t('client.recentOrders.table.amount')}
                    </p>
                    <div className="font-bold text-lg md:text-xl">
                        {order.status === 'pending' && typeof order.estimatedBudget !== 'undefined' && order.estimatedBudget !== null ? (
                            <PriceDisplay
                                amount={Number(order.estimatedBudget)}
                                currency="USD"
                                variant="inline"
                                size="lg"
                                emphasizeBolivars={true}
                                className={mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}
                            />
                        ) : order.status === 'quoted' ? (
                            <PriceDisplay
                                amount={Number((order.unitQuote ?? 0) + (order.shippingPrice ?? 0))}
                                currency="USD"
                                variant="inline"
                                size="lg"
                                emphasizeBolivars={true}
                                className={mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}
                            />
                        ) : (
                            <span className={mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}>{order.amount}</span>
                        )}
                    </div>
                    <p className={`text-xs font-medium ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Tracking: {order.tracking || '-'}</p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium">
                    <span className={mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{t('client.recentOrders.progress')}</span>
                    <span className={mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}>{order.progress}%</span>
                </div>
                <div className={`w-full rounded-full h-2 md:h-3 overflow-hidden ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <div
                        className={`h-2 md:h-3 rounded-full transition-all duration-500 ${getProgressColor(order.progress)}`}
                        style={{ width: `${order.progress}%` }}
                    ></div>
                </div>
                <div className="flex flex-col md:flex-row md:justify-between gap-3 md:gap-0 text-sm">
                    <div className="flex flex-col gap-2">
                        <span className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{t('client.recentOrders.estimatedDelivery')}: {order.estimatedDelivery}</span>
                        {/* Botón de calificar solo para pedidos completados al 100% */}
                        {order.stateNum === 13 && (() => {
                            const orderKey = normalizeOrderId(order.id);
                            return loadingReviews[orderKey] ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 w-fit opacity-50 ${mounted && theme === 'dark' ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}
                                >
                                    <Star className="h-3 w-3 mr-1 animate-pulse" />
                                    Verificando...
                                </Button>
                            ) : orderReviews[orderKey] ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 w-fit ${mounted && theme === 'dark' ? 'border-yellow-600 text-yellow-300 hover:bg-yellow-900/30 hover:border-yellow-500' : 'border-yellow-200 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-300'}`}
                                    onClick={() => handlers.openViewReviewModal(order)}
                                >
                                    <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                                    {t('client.recentOrders.reviews.alreadyRated', { fallback: 'Ya calificado' })}
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 w-fit ${mounted && theme === 'dark' ? 'border-purple-600 text-purple-300 hover:bg-purple-900/30 hover:border-purple-500' : 'border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300'}`}
                                    onClick={() => handlers.openReviewModal(order)}
                                >
                                    <Star className="h-3 w-3 mr-1" />
                                    {t('client.recentOrders.reviews.rate', { fallback: 'Calificar' })}
                                </Button>
                            )
                        })()}
                    </div>
                    <div className="flex gap-2 md:gap-3">
                        {/* Botón para revisar alternativa pendiente */}
                        {(() => {
                            const alternative = alternatives.find(alt => {
                                const match = String(alt.order_id) === String(order.id);
                                return match;
                            });
                            return alternative && (
                                <Button
                                    size="sm"
                                    className="h-7 md:h-8 px-3 md:px-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                                    onClick={() => handlers.openReviewAlternativeModal(order)}
                                >
                                    <AlertTriangle className="h-3 w-3 mr-1 animate-pulse" />
                                    Revisar Alternativa
                                </Button>
                            );
                        })()}

                        {/* Botón para cancelar pedido (solo en estados pendiente o cotizado) */}
                        {(order.status === 'pending' || order.status === 'quoted') && (
                            <Button
                                variant="outline"
                                size="sm"
                                className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 ${mounted && theme === 'dark' ? 'border-red-600 text-red-300 hover:bg-red-900/30 hover:border-red-500' : 'border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300'}`}
                                onClick={() => handlers.openCancelOrderModal(order)}
                            >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancelar
                            </Button>
                        )}

                        {(order.status === 'quoted' || order.stateNum === -1) && (
                            <Button
                                size="sm"
                                className="h-7 md:h-8 px-3 md:px-4 bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                                onClick={() => handlers.handlePaymentClick(order)}
                            >
                                <DollarSign className="h-3 w-3 mr-1" />
                                {order.stateNum === -1 ? t('client.recentOrders.actions.payAgain') : t('client.recentOrders.actions.pay')}
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 ${mounted && theme === 'dark' ? 'border-slate-600 text-blue-300 hover:bg-slate-700 hover:border-slate-500' : 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300'}`}
                            onClick={() => handlers.handleViewDetails(order)}
                        >
                            <Eye className="h-3 w-3 mr-1" />
                            {t('client.recentOrders.actions.view')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 ${mounted && theme === 'dark' ? 'border-slate-600 text-orange-300 hover:bg-slate-700 hover:border-slate-500' : 'border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300'}`}
                            onClick={() => handlers.openTrackingModal(order)}
                        >
                            <MapPin className="h-3 w-3 mr-1" />
                            {t('client.recentOrders.actions.track')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
