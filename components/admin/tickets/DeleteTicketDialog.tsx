"use client";

import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import type { Ticket } from '@/lib/tickets/types';

interface DeleteTicketDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ticket: Ticket | null;
    onSuccess: () => void;
}

export default function DeleteTicketDialog({ open, onOpenChange, ticket, onSuccess }: DeleteTicketDialogProps) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);

    const handleDelete = async () => {
        if (!ticket) return;

        setIsLoading(true);

        try {
            const response = await fetch('/api/admin/tickets/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ticket.id })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t('admin.tickets.modals.delete.deleteError'));
            }

            toast.success(t('admin.tickets.modals.delete.deleteSuccess'));
            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            console.error('Error deleting ticket:', error);
            toast.error(error.message || t('admin.tickets.modals.delete.deleteError'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('admin.tickets.modals.delete.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('admin.tickets.modals.delete.description')} <strong>{ticket?.user_name}</strong>.
                        <br /><br />
                        {t('admin.tickets.modals.delete.irreversible')}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>{t('admin.tickets.modals.delete.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('admin.tickets.modals.delete.delete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
