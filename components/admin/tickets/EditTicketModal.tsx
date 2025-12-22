"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Ticket } from '@/lib/tickets/types';

interface EditTicketModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ticket: Ticket | null;
    onSuccess: () => void;
}

export default function EditTicketModal({ open, onOpenChange, ticket, onSuccess }: EditTicketModalProps) {
    const { t } = useTranslation();
    const [userName, setUserName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (ticket) {
            setUserName(ticket.user_name);
        }
    }, [ticket]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ticket) return;

        if (userName.trim().length < 3) {
            toast.error(t('admin.tickets.modals.edit.nameMinLength'));
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/admin/tickets/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ticket.id, user_name: userName.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t('admin.tickets.modals.edit.updateError'));
            }

            toast.success(t('admin.tickets.modals.edit.updateSuccess'));
            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            console.error('Error updating ticket:', error);
            toast.error(error.message || t('admin.tickets.modals.edit.updateError'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('admin.tickets.modals.edit.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin.tickets.modals.edit.description')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="userName">{t('admin.tickets.modals.edit.userNameLabel')}</Label>
                            <Input
                                id="userName"
                                placeholder={t('admin.tickets.modals.edit.userNamePlaceholder')}
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                disabled={isLoading}
                                autoFocus
                                required
                                minLength={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            {t('admin.tickets.modals.edit.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('admin.tickets.modals.edit.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
