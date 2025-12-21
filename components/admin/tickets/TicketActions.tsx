"use client";

import { Button } from '@/components/ui/button';
import { Printer, Edit, Trash2, History } from 'lucide-react';
import type { Ticket } from '@/lib/tickets/types';

interface TicketActionsProps {
    ticket: Ticket;
    onPrint: (ticket: Ticket) => void;
    onEdit: (ticket: Ticket) => void;
    onDelete: (ticket: Ticket) => void;
    onHistory: (ticket: Ticket) => void;
}

export default function TicketActions({ ticket, onPrint, onEdit, onDelete, onHistory }: TicketActionsProps) {
    return (
        <div className="flex items-center gap-2">
            {/* Print Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPrint(ticket)}
                className="h-8"
                title="Imprimir etiqueta"
            >
                <Printer className="h-4 w-4" />
            </Button>

            {/* Edit Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(ticket)}
                className="h-8"
                title="Editar usuario"
            >
                <Edit className="h-4 w-4" />
            </Button>

            {/* Delete Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(ticket)}
                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Eliminar usuario"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}
