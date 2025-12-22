"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/useTranslation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateTicketModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export default function CreateTicketModal({ open, onOpenChange, onSuccess }: CreateTicketModalProps) {
    const { t } = useTranslation();
    const [userName, setUserName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (userName.trim().length < 3) {
            toast.error(t('admin.tickets.modals.create.nameMinLength'));
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/admin/tickets/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_name: userName.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t('admin.tickets.modals.create.createError'));
            }

            toast.success(t('admin.tickets.modals.create.createSuccess'));
            setUserName('');
            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            console.error('Error creating ticket:', error);
            toast.error(error.message || t('admin.tickets.modals.create.createError'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('admin.tickets.modals.create.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin.tickets.modals.create.description')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="userName">{t('admin.tickets.modals.create.userNameLabel')}</Label>
                            <Input
                                id="userName"
                                placeholder={t('admin.tickets.modals.create.userNamePlaceholder')}
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
                            {t('admin.tickets.modals.create.cancel')}
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('admin.tickets.modals.create.create')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
