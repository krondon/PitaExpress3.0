import { NextResponse } from 'next/server';
// @ts-ignore
import { translate } from 'google-translate-api-x';

export async function POST(request: Request) {
    try {
        const { text, targetLang } = await request.json();

        if (!text || !targetLang) {
            return NextResponse.json(
                { error: 'Text and targetLang are required' },
                { status: 400 }
            );
        }

        // Mapear códigos de idioma si es necesario
        // Google Translate suele preferir zh-CN o zh-TW en lugar de solo zh
        const finalTargetLang = targetLang === 'zh' ? 'zh-CN' : targetLang;

        // Realizar la traducción
        const res = await translate(text, {
            to: finalTargetLang,
            forceTo: true // Forzar traducción incluso si el ISO no es estándar estricto
        });

        // Manejar diferentes tipos de respuesta
        const translatedText = Array.isArray(res)
            ? res[0]?.text || text
            : (res as any).text || text;

        const fromLang = Array.isArray(res)
            ? res[0]?.from?.language?.iso || 'unknown'
            : (res as any).from?.language?.iso || 'unknown';

        return NextResponse.json({
            original: text,
            translated: translatedText,
            from: fromLang,
            to: targetLang
        });

    } catch (error: any) {
        console.error('Translation error:', error);
        return NextResponse.json(
            { error: 'Translation failed', details: error.message },
            { status: 500 }
        );
    }
}
