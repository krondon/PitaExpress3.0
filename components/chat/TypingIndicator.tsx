"use client";

import { memo } from 'react';

interface TypingIndicatorProps {
    userName?: string;
}

export const TypingIndicator = memo(function TypingIndicator({ userName }: TypingIndicatorProps) {
    return (
        <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {userName || 'Usuario'} está escribiendo
                </span>
                <div className="flex gap-1">
                    <div
                        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms', animationDuration: '1s', animationIterationCount: 'infinite' }}
                    />
                    <div
                        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms', animationDuration: '1s', animationIterationCount: 'infinite' }}
                    />
                    <div
                        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms', animationDuration: '1s', animationIterationCount: 'infinite' }}
                    />
                </div>
            </div>
        </div>
    );
});
