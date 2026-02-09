
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { DB } from '../lib/db'

export default function App({ Component, pageProps }: AppProps) {
    useEffect(() => {
        // Inicializa Banco de Dados SQLite (apenas no App Desktop)
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
            DB.init();
        }
    }, []);

    return <Component {...pageProps} />
}
