import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM || 'info@pitacompra.com';

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
}

/**
 * Enviar un email usando Resend.
 * No lanza excepciones — retorna { success, error? } para manejo no-bloqueante.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await resend.emails.send({
            from: EMAIL_FROM,
            to,
            subject,
            html,
        });

        if (error) {
            console.error('[Email] Error enviando email:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        console.error('[Email] Excepción enviando email:', err);
        return { success: false, error: err?.message || 'Error desconocido' };
    }
}
