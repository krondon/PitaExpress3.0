"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import type { Ticket } from '@/lib/tickets/types';
import Barcode from 'react-barcode';

interface PrintLabelModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ticket: Ticket | null;
    onSuccess: () => void;
}

export default function PrintLabelModal({ open, onOpenChange, ticket, onSuccess }: PrintLabelModalProps) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    const [currentFullCode, setCurrentFullCode] = useState('');

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Update code when ticket changes or modal opens
    useEffect(() => {
        if (ticket && open) {
            const date = new Date();
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            const dateSuffix = `${day}${month}${year}`;

            // Assuming base_code matches PLXXXX format, just append date
            // or if full_code is passed, maybe we should reconstruct from base_code
            // Ideally use ticket.base_code + dateSuffix
            const newCode = `${ticket.base_code}${dateSuffix}`;
            setCurrentFullCode(newCode);
        }
    }, [ticket, open]);

    const handlePrint = async () => {
        if (!ticket) return;

        setIsLoading(true);

        try {
            // Record print in history AND update full_code
            const response = await fetch('/api/admin/tickets/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_id: ticket.id,
                    new_full_code: currentFullCode
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || t('admin.tickets.modals.print.registerError'));
            }

            // Open print dialog
            window.print();

            toast.success(t('admin.tickets.modals.print.printSuccess'));
            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            console.error('Error printing label:', error);
            toast.error(error.message || t('admin.tickets.modals.print.printError'));
        } finally {
            setIsLoading(false);
        }
    };

    if (!ticket) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[800px]">
                    <DialogHeader>
                        <DialogTitle>{t('admin.tickets.modals.print.title')}</DialogTitle>
                        <DialogDescription>
                            {t('admin.tickets.modals.print.description')} {ticket.user_name}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Label Preview */}
                    <div className="flex justify-center items-center py-4 overflow-hidden" style={{ height: '300px' }}>
                        <div className="border border-slate-300 shadow-sm bg-white" style={{
                            transform: 'scale(0.5)',
                            transformOrigin: 'center center',
                            minWidth: '11.69in',
                            minHeight: '6in',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div style={{ width: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                {/* Logo */}
                                <div style={{ alignSelf: 'flex-start', marginBottom: '10px', marginLeft: '4.5em' }}>
                                    <img src="/images/logos/tickets.jpg" alt="Logo" style={{ height: '120px' }} />
                                </div>

                                {/* Static Code QX304YW */}
                                <div style={{
                                    fontFamily: "'CustomArial', sans-serif",
                                    fontSize: '150px',
                                    lineHeight: 1,
                                    fontWeight: 'normal',
                                    color: 'black'
                                }}>
                                    QX304YW
                                </div>

                                {/* Separator */}
                                <div style={{ width: '55%', height: '8px', backgroundColor: 'black', margin: '8px 0' }}></div>

                                {/* Real Barcode */}
                                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ transform: 'scaleX(2.5)', transformOrigin: 'center' }}>
                                        <Barcode
                                            value={currentFullCode || ticket.full_code}
                                            format="CODE128"
                                            width={1.5}
                                            height={221}
                                            displayValue={false}
                                            margin={0}
                                        />
                                    </div>
                                    <div style={{
                                        fontFamily: "'CustomArial', sans-serif",
                                        fontSize: '40px',
                                        fontWeight: 700,
                                        color: '#000000',
                                        letterSpacing: '0.12em',
                                        marginTop: '14px',
                                        marginLeft: '0.12em'
                                    }}>
                                        {currentFullCode || ticket.full_code}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            {t('admin.tickets.modals.print.cancel')}
                        </Button>
                        <Button onClick={handlePrint} disabled={isLoading}>
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Printer className="mr-2 h-4 w-4" />
                            )}
                            {t('admin.tickets.modals.print.confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    /* Hoja estándar apaisada: toda la página en blanco (evita franja gris en la vista previa) */
                    @page {
                        size: A4 landscape;
                        margin: 0;
                    }

                    html {
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background: white !important;
                    }

                    /* Hide EVERYTHING except print-label */
                    body > *:not(#print-label) {
                        display: none !important;
                        visibility: hidden !important;
                        height: 0 !important;
                        overflow: hidden !important;
                    }

                    #print-label {
                        display: flex !important;
                        visibility: visible !important;
                        position: fixed !important;
                        inset: 0 !important;
                        left: 0 !important;
                        top: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        min-height: 100% !important;
                        align-items: center !important;
                        justify-content: center !important;
                        background: white !important;
                        z-index: 2147483647 !important;
                    }

                    #print-label,
                    #print-label * {
                        visibility: visible !important;
                        display: flex !important;
                    }

                    #print-label > div {
                        display: flex !important;
                    }
                }
            `}</style>

            {/* Print Content - Rendered via Portal to be direct child of body */}
            {mounted && createPortal(
                <div id="print-label" style={{ display: 'none' }}>
                    <div style={{
                        width: '80%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                        maxHeight: '100%',
                        backgroundColor: '#ffffff'
                    }}>
                        {/* Logo - más grande al imprimir */}
                        <div style={{ alignSelf: 'flex-start', marginBottom: '12px', marginLeft: '7.5em' }}>
                            <img src="/images/logos/tickets.jpg" alt="Logo" style={{ height: '120px' }} />
                        </div>

                        {/* Static Code QX304YW - más grande */}
                        <div style={{
                            fontFamily: "'CustomArial', sans-serif",
                            fontSize: '150px',
                            lineHeight: 1,
                            fontWeight: 'normal',
                            color: 'black'
                        }}>
                            QX304YW
                        </div>

                        {/* Separator - más grueso */}
                        <div style={{ width: '55%', height: '8px', backgroundColor: 'black', margin: '8px 0' }}></div>

                        {/* Real Barcode - más alto y ancho */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ transform: 'scaleX(2.5)', transformOrigin: 'center' }}>
                                <Barcode
                                    value={currentFullCode || ticket.full_code}
                                    format="CODE128"
                                    width={1.5}
                                    height={364}
                                    displayValue={false}
                                    margin={0}
                                    background="#ffffff"
                                />
                            </div>
                            <div style={{
                                fontFamily: "'CustomArial', sans-serif",
                                fontSize: '52px',
                                fontWeight: 700,
                                color: '#000000',
                                letterSpacing: '0.1em',
                                marginTop: '16px',
                                marginLeft: '0.1em'
                            }}>
                                {currentFullCode || ticket.full_code}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
