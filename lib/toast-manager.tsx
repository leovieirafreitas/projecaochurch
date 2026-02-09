// Sistema global de notificações Toast
import { createRoot } from 'react-dom/client';
import Toast from '../components/Toast';

let toastContainer: HTMLDivElement | null = null;
let currentToastRoot: any = null;

export const showToast = (message: string, type: 'success' | 'loading' | 'error' = 'loading', duration = 2000) => {
    // Remove toast anterior se existir
    if (toastContainer) {
        document.body.removeChild(toastContainer);
        toastContainer = null;
        currentToastRoot = null;
    }

    // Cria novo container
    toastContainer = document.createElement('div');
    document.body.appendChild(toastContainer);

    // Renderiza o Toast
    currentToastRoot = createRoot(toastContainer);
    currentToastRoot.render(<Toast message={message} type={type} duration={duration} />);

    // Auto-remove após duração (se não for loading)
    if (type !== 'loading') {
        setTimeout(() => {
            if (toastContainer && document.body.contains(toastContainer)) {
                document.body.removeChild(toastContainer);
                toastContainer = null;
                currentToastRoot = null;
            }
        }, duration + 300); // +300ms para animação de saída
    }
};

export const hideToast = () => {
    if (toastContainer && document.body.contains(toastContainer)) {
        document.body.removeChild(toastContainer);
        toastContainer = null;
        currentToastRoot = null;
    }
};
