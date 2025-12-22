"use client";

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Header from '@/components/layout/Header';
import { useAdminLayoutContext } from '@/lib/AdminLayoutContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Search,
    Plus,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Barcode as BarcodeIcon,
    History,
    Loader2
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import type { Ticket } from '@/lib/tickets/types';

// Import modals
import CreateTicketModal from '@/components/admin/tickets/CreateTicketModal';
import EditTicketModal from '@/components/admin/tickets/EditTicketModal';
import DeleteTicketDialog from '@/components/admin/tickets/DeleteTicketDialog';
import PrintLabelModal from '@/components/admin/tickets/PrintLabelModal';
import TicketActions from '@/components/admin/tickets/TicketActions';

export default function TicketsPage() {
    const { t, language } = useTranslation();
    const { toggleMobileMenu } = useAdminLayoutContext();
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Data state
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Search state
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Modal states
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    useEffect(() => {
        setMounted(true);
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/tickets');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t('admin.tickets.messages.loadError'));
            }

            setTickets(data.tickets || []);
        } catch (error: any) {
            console.error('Error fetching tickets:', error);
            toast.error(error.message || t('admin.tickets.messages.loadError'));
        } finally {
            setIsLoading(false);
        }
    };

    // Format date for display
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const localeMap: Record<string, string> = {
            'es': 'es-ES',
            'en': 'en-US',
            'zh': 'zh-CN'
        };
        return date.toLocaleDateString(localeMap[language] || 'es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Handlers
    const handlePrint = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setPrintModalOpen(true);
    };

    const handleEdit = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setEditModalOpen(true);
    };

    const handleDelete = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setDeleteDialogOpen(true);
    };

    const handleHistory = (ticket: Ticket) => {
        // TODO: Implement history modal
        toast.info(`${t('admin.tickets.messages.historyOf')} ${ticket.user_name}: ${ticket.print_count || 0} ${t('admin.tickets.table.prints')}`);
    };

    // Search and Filter
    const filteredTickets = tickets.filter(ticket => {
        if (!searchTerm.trim()) return true;
        const search = searchTerm.toLowerCase();
        return (
            ticket.user_name.toLowerCase().includes(search) ||
            ticket.base_code.toLowerCase().includes(search) ||
            ticket.full_code.toLowerCase().includes(search)
        );
    });

    // Pagination
    const displayedTickets = filteredTickets;
    const totalPages = Math.ceil(displayedTickets.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTickets = displayedTickets.slice(startIndex, startIndex + itemsPerPage);

    if (!mounted) {
        return (
                <div suppressHydrationWarning className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
                <div className="text-center">
                    <div suppressHydrationWarning className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme === 'dark' ? 'border-blue-400' : 'border-blue-600'} mx-auto`}></div>
                    <p suppressHydrationWarning className={`mt-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>{t('admin.tickets.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Header
                notifications={0}
                onMenuToggle={toggleMobileMenu}
                title={t('admin.tickets.title') || 'Tickets'}
                subtitle={t('admin.tickets.subtitle') || 'Gestión de códigos de barras'}
            />

            <div className="p-4 md:p-5 lg:p-6 space-y-4 md:space-y-5 lg:space-y-6">
                <Card className={`shadow-lg border-0 ${mounted && theme === 'dark' ? 'bg-slate-800/70 dark:border-slate-700' : 'bg-white/70'} backdrop-blur-sm hover:shadow-xl transition-shadow duration-300`}>
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <CardTitle className={`text-lg md:text-xl flex items-center ${mounted && theme === 'dark' ? 'text-white' : 'text-black'} w-full sm:w-auto`}>
                                <BarcodeIcon className={`w-4 h-4 md:w-5 md:h-5 mr-2 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                                {t('admin.tickets.listTitle') || 'Lista de Tickets'}
                            </CardTitle>

                            {/* Toolbar */}
                            <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2 sm:gap-3">
                                {/* Search */}
                                <div className="relative w-full sm:w-auto">
                                    <Input
                                        placeholder={t('admin.tickets.search') || 'Buscar por nombre, código...'}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={`px-3 h-10 w-full sm:w-56 md:w-64 ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : 'bg-white/80 border-slate-300'} backdrop-blur-sm focus:border-blue-500 focus:ring-blue-500 text-sm`}
                                    />
                                </div>



                                {/* Create User Button */}
                                <div className="w-full sm:w-auto">
                                    <Button
                                        onClick={() => setCreateModalOpen(true)}
                                        className="h-10 w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg text-sm"
                                    >
                                        <Plus className="w-3 h-3 mr-2" /> {t('admin.tickets.createUser')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="overflow-x-hidden">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="text-center py-12">
                                <BarcodeIcon className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                                <p className="text-slate-600 dark:text-slate-400">{t('admin.tickets.noTicketsRegistered')}</p>
                                <Button
                                    onClick={() => setCreateModalOpen(true)}
                                    className="mt-4"
                                    variant="outline"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('admin.tickets.createFirstUser')}
                                </Button>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className={`hidden lg:block rounded-xl border ${mounted && theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white/50'} backdrop-blur-sm overflow-x-auto`}>
                                    <div className="min-h-[400px] transition-all duration-700 ease-in-out">
                                        <table className="w-full table-fixed min-w-full">
                                            <thead className={`bg-gradient-to-r ${mounted && theme === 'dark' ? 'from-slate-800 to-slate-700 border-slate-600' : 'from-slate-50 to-blue-50 border-slate-200'} border-b`}>
                                                <tr>
                                                    <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '25%' }}>
                                                        {t('admin.tickets.table.userName')}
                                                    </th>
                                                    <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '15%' }}>
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4" />
                                                            {t('admin.tickets.table.date')}
                                                        </div>
                                                    </th>
                                                    <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '15%' }}>
                                                        {t('admin.tickets.table.baseCode')}
                                                    </th>
                                                    <th className={`text-center py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '15%' }}>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <History className="w-4 h-4" />
                                                            {t('admin.tickets.table.history')}
                                                        </div>
                                                    </th>
                                                    <th className={`text-center py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '30%' }}>
                                                        {t('admin.tickets.table.actions')}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className={`divide-y ${mounted && theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                                {paginatedTickets.map((ticket) => (
                                                    <tr
                                                        key={ticket.id}
                                                        className={`${mounted && theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-slate-50/50'} transition-all duration-300 ease-out group`}
                                                    >
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center gap-4">
                                                                <Avatar className={`h-12 w-12 ring-2 ${mounted && theme === 'dark' ? 'ring-slate-700 group-hover:ring-blue-600' : 'ring-slate-100 group-hover:ring-blue-200'} transition-all duration-200 flex-shrink-0`}>
                                                                    <AvatarFallback className={`bg-gradient-to-br ${mounted && theme === 'dark' ? 'from-blue-900/50 to-blue-800/50 text-blue-300' : 'from-blue-100 to-blue-200 text-blue-800'} font-semibold`}>
                                                                        {ticket.user_name
                                                                            .split(' ')
                                                                            .map((n) => n[0])
                                                                            .slice(0, 2)
                                                                            .join('')}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className={`font-semibold ${mounted && theme === 'dark' ? 'text-white group-hover:text-blue-300' : 'text-slate-900 group-hover:text-blue-900'} transition-colors truncate`}>
                                                                        {ticket.user_name}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <span className={`truncate ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                                                {formatDate(ticket.created_at)}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <Badge className={`${mounted && theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'} border font-medium px-3 py-1`}>
                                                                {ticket.base_code}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-4 px-6 text-center">
                                                            <div className="flex items-center justify-center h-8 text-sm text-slate-600 dark:text-slate-400">
                                                                <History className="h-4 w-4 mr-2" />
                                                                {ticket.print_count || 0}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6">
                                                            <div className="flex items-center justify-center">
                                                                <TicketActions
                                                                    ticket={ticket}
                                                                    onPrint={handlePrint}
                                                                    onEdit={handleEdit}
                                                                    onDelete={handleDelete}
                                                                    onHistory={handleHistory}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Mobile Cards */}
                                <div className="lg:hidden space-y-3 md:space-y-4">
                                    {paginatedTickets.map((ticket) => (
                                        <div
                                            key={ticket.id}
                                            className={`${mounted && theme === 'dark' ? 'bg-slate-800/80 dark:border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-sm rounded-xl border p-4 hover:shadow-lg transition-all duration-300`}
                                        >
                                            <div className="flex items-center gap-4 mb-4">
                                                <Avatar className={`h-12 w-12 ring-2 ${mounted && theme === 'dark' ? 'ring-slate-700' : 'ring-slate-100'} flex-shrink-0`}>
                                                    <AvatarFallback className={`bg-gradient-to-br ${mounted && theme === 'dark' ? 'from-blue-900/50 to-blue-800/50 text-blue-300' : 'from-blue-100 to-blue-200 text-blue-800'} font-semibold`}>
                                                        {ticket.user_name
                                                            .split(' ')
                                                            .map((n) => n[0])
                                                            .slice(0, 2)
                                                            .join('')}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`font-semibold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'} truncate`}>
                                                        {ticket.user_name}
                                                    </div>
                                                    <div className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} flex items-center gap-1`}>
                                                        <Calendar className="w-3 h-3" />
                                                        {formatDate(ticket.created_at)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                        {t('admin.tickets.table.baseCodeLabel')}
                                                    </span>
                                                    <Badge className={`${mounted && theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'} border`}>
                                                        {ticket.base_code}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                        {t('admin.tickets.table.historyLabel')}
                                                    </span>
                                                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                                                        <History className="h-4 w-4 mr-2" />
                                                        {ticket.print_count || 0} {t('admin.tickets.table.prints')}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                <TicketActions
                                                    ticket={ticket}
                                                    onPrint={handlePrint}
                                                    onEdit={handleEdit}
                                                    onDelete={handleDelete}
                                                    onHistory={handleHistory}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                        {t('admin.tickets.pagination.showing')} {startIndex + 1} {t('admin.tickets.pagination.to')} {Math.min(startIndex + itemsPerPage, displayedTickets.length)} {t('admin.tickets.pagination.of')} {displayedTickets.length} {t('admin.tickets.pagination.tickets')}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className={mounted && theme === 'dark' ? 'dark:border-slate-700' : ''}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {t('admin.tickets.pagination.page')} {currentPage} {t('admin.tickets.pagination.ofPages')} {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className={mounted && theme === 'dark' ? 'dark:border-slate-700' : ''}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Modals */}
            <CreateTicketModal
                open={createModalOpen}
                onOpenChange={setCreateModalOpen}
                onSuccess={fetchTickets}
            />

            <EditTicketModal
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                ticket={selectedTicket}
                onSuccess={fetchTickets}
            />

            <DeleteTicketDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                ticket={selectedTicket}
                onSuccess={fetchTickets}
            />

            <PrintLabelModal
                open={printModalOpen}
                onOpenChange={setPrintModalOpen}
                ticket={selectedTicket}
                onSuccess={fetchTickets}
            />
        </>
    );
}
