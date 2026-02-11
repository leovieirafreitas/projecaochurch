
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { DB } from '../lib/db'

export default function App({ Component, pageProps }: AppProps) {
    useEffect(() => {
        // Inicializa Banco de Dados SQLite (apenas no App Desktop)
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
            DB.init();

            // UPDATE WINDOW TITLE WHEN PROJECT CHANGES
            const updateWindowTitle = async () => {
                try {
                    const projectPath = localStorage.getItem('current_project_path');

                    // Dynamic import to avoid SSR issues
                    const { WebviewWindow } = await import('@tauri-apps/api/window');
                    const mainWindow = WebviewWindow.getByLabel('main');

                    if (!mainWindow) {
                        return;
                    }

                    if (projectPath) {
                        // Extract project name from path
                        const parts = projectPath.split(/[\\\/]/);
                        const name = parts.pop() || 'Sem Título';
                        const parentFolder = parts.pop() || '';
                        const driveMatch = projectPath.match(/^([a-zA-Z]:)/);
                        const drive = driveMatch ? driveMatch[1] : '';

                        let display = 'Projeto';
                        if (drive) display += `/${drive}`;
                        if (parentFolder) display += `/${parentFolder}`;
                        display += `/${name}`;

                        const newTitle = `Projection Church - ${display}`;
                        await mainWindow.setTitle(newTitle);
                    } else {
                        await mainWindow.setTitle('Projection Church');
                    }
                } catch (e) {
                    // Silently fail
                }
            };

            // Update on load with delay
            setTimeout(updateWindowTitle, 1000);

            // Listen for project changes
            window.addEventListener('project-loaded', updateWindowTitle);
            window.addEventListener('recents-updated', updateWindowTitle);

            return () => {
                window.removeEventListener('project-loaded', updateWindowTitle);
                window.removeEventListener('recents-updated', updateWindowTitle);
            };
        }
    }, []);

    return <Component {...pageProps} />
}
