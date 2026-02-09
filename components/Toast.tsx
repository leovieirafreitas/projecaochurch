import React, { useEffect, useState } from 'react';

interface ToastProps {
    message: string;
    type?: 'success' | 'loading' | 'error';
    duration?: number;
}

export default function Toast({ message, type = 'loading', duration = 2000 }: ToastProps) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (type !== 'loading') {
            const timer = setTimeout(() => setVisible(false), duration);
            return () => clearTimeout(timer);
        }
    }, [type, duration]);

    if (!visible) return null;

    const icons = {
        loading: (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        ),
        success: (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        ),
        error: (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        )
    };

    const colors = {
        loading: 'bg-blue-600 border-blue-500',
        success: 'bg-green-600 border-green-500',
        error: 'bg-red-600 border-red-500'
    };

    return (
        <div className="fixed top-20 right-4 z-[9999] animate-slide-in-right">
            <div className={`${colors[type]} text-white px-6 py-3 rounded-lg shadow-2xl border-l-4 flex items-center gap-3 min-w-[280px]`}>
                {icons[type]}
                <span className="font-medium text-sm">{message}</span>
            </div>
        </div>
    );
}
