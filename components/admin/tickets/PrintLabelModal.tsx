"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import type { Ticket } from '@/lib/tickets/types';
import Barcode from 'react-barcode';

interface PrintLabelModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ticket: Ticket | null;
    onSuccess: () => void;
}

export default function PrintLabelModal({ open, onOpenChange, ticket, onSuccess }: PrintLabelModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const handlePrint = async () => {
        if (!ticket) return;

        setIsLoading(true);

        try {
            // Record print in history
            const response = await fetch('/api/admin/tickets/print', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_id: ticket.id })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al registrar impresión');
            }

            // Open print dialog
            window.print();

            toast.success('Etiqueta enviada a impresión');
            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            console.error('Error printing label:', error);
            toast.error(error.message || 'Error al imprimir etiqueta');
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
                        <DialogTitle>Imprimir Etiqueta</DialogTitle>
                        <DialogDescription>
                            Vista previa de la etiqueta para {ticket.user_name}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Label Preview */}
                    <div className="flex justify-center py-6">
                        <div className="border border-slate-300 rounded-lg p-8 bg-white" style={{ transform: 'scale(0.5)', transformOrigin: 'top' }}>
                            <div style={{ width: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                {/* Logo */}
                                <div style={{ alignSelf: 'flex-start', marginBottom: '10px' }}>
                                    <img src="/images/logos/tickets.jpg" alt="Logo" style={{ height: '80px' }} />
                                </div>

                                {/* Static Code QX304YW */}
                                <div style={{
                                    fontFamily: "'CustomArial', sans-serif",
                                    fontSize: '100px',
                                    lineHeight: 1,
                                    fontWeight: 'normal',
                                    color: 'black'
                                }}>
                                    QX304YW
                                </div>

                                {/* Separator */}
                                <div style={{ width: '50%', height: '5px', backgroundColor: 'black', margin: '5px 0' }}></div>

                                {/* Real Barcode */}
                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ transform: 'scaleX(2.5)', transformOrigin: 'center' }}>
                                        <Barcode
                                            value={ticket.full_code}
                                            format="CODE128"
                                            width={1}
                                            height={80}
                                            displayValue={false}
                                            margin={0}
                                        />
                                    </div>
                                    <div style={{
                                        fontFamily: "'CustomArial', sans-serif",
                                        fontSize: '16px',
                                        color: '#4b5563',
                                        letterSpacing: '1.2em',
                                        marginTop: '8px',
                                        marginLeft: '1.2em'
                                    }}>
                                        {ticket.full_code}
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
                            Cancelar
                        </Button>
                        <Button onClick={handlePrint} disabled={isLoading}>
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Printer className="mr-2 h-4 w-4" />
                            )}
                            Confirmar Impresión
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: 11.69in 4.26in;
                        margin: 0;
                    }

                    html {
                        height: 4.26in !important;
                        overflow: hidden !important;
                    }

                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 11.69in !important;
                        height: 4.26in !important;
                        overflow: hidden !important;
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

                    /* Show only print label */
                    #print-label {
                        display: flex !important;
                        visibility: visible !important;
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 11.69in !important;
                        height: 4.26in !important;
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
                        gap: '8px',
                        maxHeight: '100%'
                    }}>
                        {/* Logo */}
                        <div style={{ alignSelf: 'flex-start', marginBottom: '10px' }}>
                            <img src="/images/logos/tickets.jpg" alt="Logo" style={{ height: '80px' }} />
                        </div>

                        {/* Static Code QX304YW */}
                        <div style={{
                            fontFamily: "'CustomArial', sans-serif",
                            fontSize: '100px',
                            lineHeight: 1,
                            fontWeight: 'normal',
                            color: 'black'
                        }}>
                            QX304YW
                        </div>

                        {/* Separator */}
                        <div style={{ width: '50%', height: '5px', backgroundColor: 'black', margin: '5px 0' }}></div>

                        {/* Real Barcode */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ transform: 'scaleX(1.8)', transformOrigin: 'center' }}>
                                <Barcode
                                    value={ticket.full_code}
                                    format="CODE128"
                                    width={1}
                                    height={140}
                                    displayValue={false}
                                    margin={0}
                                    background="#ffffff"
                                />
                            </div>
                            <div style={{
                                fontFamily: "'CustomArial', sans-serif",
                                fontSize: '20px',
                                color: '#4b5563',
                                letterSpacing: '0.8em',
                                marginTop: '10px'
                            }}>
                                {ticket.full_code}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
