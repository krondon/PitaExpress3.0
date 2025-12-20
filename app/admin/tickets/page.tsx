"use client";

import { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import Header from '@/components/layout/Header';
import { useAdminLayoutContext } from '@/lib/AdminLayoutContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Search,
    Filter,
    Plus,
    Calendar,
    Hash,
    Barcode as BarcodeIcon,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

// Interfaz para los tickets
interface Ticket {
    id: string;
    userName: string;
    date: string;
    baseCode: string;
    code: string;
    barcode: string;
}

// Datos de prueba (5 registros hardcodeados)
const MOCK_TICKETS: Ticket[] = [
    {
        id: '1',
        userName: 'Alfredo Ochoa',
        date: '10/12/2025',
        baseCode: 'PL0002',
        code: 'PL0002101225',
        barcode: 'PL0002101225'
    },
    {
        id: '2',
        userName: 'Alfredo Ochoa',
        date: '11/12/2025',
        baseCode: 'PL0002',
        code: 'PL0002111225',
        barcode: 'PL0002111225'
    },
    {
        id: '3',
        userName: 'Yariana Olivares',
        date: '10/12/2025',
        baseCode: 'PL0003',
        code: 'PL0003101225',
        barcode: 'PL0003101225'
    },
    {
        id: '4',
        userName: 'Gyorel Ramos',
        date: '11/12/2025',
        baseCode: 'PL0005',
        code: 'PL0005111225',
        barcode: 'PL0005111225'
    },
    {
        id: '5',
        userName: 'Usuario Demo',
        date: '12/12/2025',
        baseCode: 'PL0001',
        code: 'PL0001121225',
        barcode: 'PL0001121225'
    }
];

// Componente simple de código de barras usando fuente monoespaciada y estilo visual
const BarcodeDisplay = ({ code }: { code: string }) => {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-[1px] bg-white px-2 py-1 rounded">
                {code.split('').map((char, idx) => (
                    <div
                        key={idx}
                        className="h-12 bg-black"
                        style={{
                            width: char === '*' ? '3px' : ['0', '1'].includes(char) ? '2px' : '2.5px'
                        }}
                    />
                ))}
            </div>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">*{code}*</span>
        </div>
    );
};

export default function TicketsPage() {
    const { t } = useTranslation();
    const { toggleMobileMenu } = useAdminLayoutContext();
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Estados para filtros (no funcionales por ahora)
    const [searchTerm, setSearchTerm] = useState('');
    const [filterValue, setFilterValue] = useState('all');

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    useEffect(() => {
        setMounted(true);
    }, []);

    // Por ahora mostramos todos los tickets sin filtrar
    const displayedTickets = MOCK_TICKETS;

    const totalPages = Math.ceil(displayedTickets.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedTickets = displayedTickets.slice(startIndex, startIndex + itemsPerPage);

    if (!mounted) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
                <div className="text-center">
                    <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${theme === 'dark' ? 'border-blue-400' : 'border-blue-600'} mx-auto`}></div>
                    <p className={`mt-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>Cargando...</p>
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
                                {/* Buscador (no funcional) */}
                                <div className="relative w-full sm:w-auto">
                                    <Input
                                        placeholder={t('admin.tickets.search') || 'Buscar por nombre, código...'}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={`px-3 h-10 w-full sm:w-56 md:w-64 ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : 'bg-white/80 border-slate-300'} backdrop-blur-sm focus:border-blue-500 focus:ring-blue-500 text-sm`}
                                    />
                                </div>

                                {/* Filtro (no funcional) */}
                                <div className="w-full sm:w-auto">
                                    <Select value={filterValue} onValueChange={setFilterValue}>
                                        <SelectTrigger className={`h-10 w-full sm:w-48 md:w-56 px-3 whitespace-nowrap ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : 'bg-white/80 border-slate-300'} backdrop-blur-sm focus:border-blue-500 text-sm`}>
                                            <div className="flex items-center gap-2 truncate">
                                                <Filter className={`w-4 h-4 mr-2 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`} />
                                                <span>Todos los códigos</span>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los códigos</SelectItem>
                                            <SelectItem value="pl0001">PL0001</SelectItem>
                                            <SelectItem value="pl0002">PL0002</SelectItem>
                                            <SelectItem value="pl0003">PL0003</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Botón Generar Código (no funcional) */}
                                <div className="w-full sm:w-auto">
                                    <Button
                                        onClick={() => { }}
                                        className="h-10 w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg text-sm"
                                    >
                                        <Plus className="w-3 h-3 mr-2" /> {t('admin.tickets.generateCode') || 'Generar Código'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="overflow-x-hidden">
                        {/* Vista Desktop - Tabla */}
                        <div className={`hidden lg:block rounded-xl border ${mounted && theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white/50'} backdrop-blur-sm overflow-x-auto`}>
                            <div className="min-h-[400px] transition-all duration-700 ease-in-out">
                                <table className="w-full table-fixed min-w-full">
                                    <thead className={`bg-gradient-to-r ${mounted && theme === 'dark' ? 'from-slate-800 to-slate-700 border-slate-600' : 'from-slate-50 to-blue-50 border-slate-200'} border-b`}>
                                        <tr>
                                            <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '25%' }}>
                                                <div className="flex items-center gap-2">
                                                    <span>{t('admin.tickets.table.userName') || 'Nombre del Usuario'}</span>
                                                </div>
                                            </th>
                                            <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '15%' }}>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" />
                                                    {t('admin.tickets.table.date') || 'Fecha'}
                                                </div>
                                            </th>
                                            <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '15%' }}>
                                                <div className="flex items-center gap-2">
                                                    <Hash className="w-4 h-4" />
                                                    {t('admin.tickets.table.baseCode') || 'Código Base'}
                                                </div>
                                            </th>
                                            <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '20%' }}>
                                                <div className="flex items-center gap-2">
                                                    <Hash className="w-4 h-4" />
                                                    {t('admin.tickets.table.code') || 'Código'}
                                                </div>
                                            </th>
                                            <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '25%' }}>
                                                <div className="flex items-center gap-2">
                                                    <BarcodeIcon className="w-4 h-4" />
                                                    {t('admin.tickets.table.barcode') || 'Código de Barras'}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${mounted && theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                        {paginatedTickets.map((ticket, index) => (
                                            <tr
                                                key={ticket.id}
                                                className={`${mounted && theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-slate-50/50'} transition-all duration-300 ease-out group`}
                                            >
                                                <td className="py-4 px-6" style={{ width: '25%' }}>
                                                    <div className="flex items-center gap-4">
                                                        <Avatar className={`h-12 w-12 ring-2 ${mounted && theme === 'dark' ? 'ring-slate-700 group-hover:ring-blue-600' : 'ring-slate-100 group-hover:ring-blue-200'} transition-all duration-200 flex-shrink-0`}>
                                                            <AvatarFallback className={`bg-gradient-to-br ${mounted && theme === 'dark' ? 'from-blue-900/50 to-blue-800/50 text-blue-300' : 'from-blue-100 to-blue-200 text-blue-800'} font-semibold`}>
                                                                {ticket.userName
                                                                    .split(' ')
                                                                    .map((n) => n[0])
                                                                    .slice(0, 2)
                                                                    .join('')}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <div className={`font-semibold ${mounted && theme === 'dark' ? 'text-white group-hover:text-blue-300' : 'text-slate-900 group-hover:text-blue-900'} transition-colors truncate`}>
                                                                {ticket.userName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6" style={{ width: '15%' }}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`truncate ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                                            {ticket.date}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6" style={{ width: '15%' }}>
                                                    <Badge className={`${mounted && theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'} border font-medium px-3 py-1`}>
                                                        {ticket.baseCode}
                                                    </Badge>
                                                </td>
                                                <td className="py-4 px-6" style={{ width: '20%' }}>
                                                    <code className={`font-mono text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                                        {ticket.code}
                                                    </code>
                                                </td>
                                                <td className="py-4 px-6" style={{ width: '25%' }}>
                                                    <BarcodeDisplay code={ticket.barcode} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Vista Mobile/Tablet - Cards */}
                        <div className="lg:hidden space-y-3 md:space-y-4">
                            {paginatedTickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className={`${mounted && theme === 'dark' ? 'bg-slate-800/80 dark:border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-sm rounded-xl border p-4 hover:shadow-lg transition-all duration-300`}
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <Avatar className={`h-12 w-12 ring-2 ${mounted && theme === 'dark' ? 'ring-slate-700' : 'ring-slate-100'} flex-shrink-0`}>
                                            <AvatarFallback className={`bg-gradient-to-br ${mounted && theme === 'dark' ? 'from-blue-900/50 to-blue-800/50 text-blue-300' : 'from-blue-100 to-blue-200 text-blue-800'} font-semibold`}>
                                                {ticket.userName
                                                    .split(' ')
                                                    .map((n) => n[0])
                                                    .slice(0, 2)
                                                    .join('')}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-semibold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'} truncate`}>
                                                {ticket.userName}
                                            </div>
                                            <div className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} flex items-center gap-1`}>
                                                <Calendar className="w-3 h-3" />
                                                {ticket.date}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center justify-between">
                                            <span className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                Código Base:
                                            </span>
                                            <Badge className={`${mounted && theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'} border`}>
                                                {ticket.baseCode}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                                Código:
                                            </span>
                                            <code className={`font-mono text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                                {ticket.code}
                                            </code>
                                        </div>
                                    </div>

                                    <div className="flex justify-center pt-3 border-t border-slate-200 dark:border-slate-700">
                                        <BarcodeDisplay code={ticket.barcode} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Paginación */}
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, displayedTickets.length)} de {displayedTickets.length} tickets
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
                                    Página {currentPage} de {totalPages}
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
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
