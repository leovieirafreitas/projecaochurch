
import React, { useState, useEffect } from 'react';

interface ShortcutConfig {
    action: string;
    label: string;
    key: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
    { action: 'nextVerse', label: 'Próximo Versículo', key: 'F2' },
    { action: 'prevVerse', label: 'Versículo Anterior', key: 'F1' },
    { action: 'clearScreen', label: 'Parar Projeção', key: 'F3' }, // Extra util
];

interface ShortcutsModalProps {
    onClose: () => void;
}

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
    const [shortcuts, setShortcuts] = useState<ShortcutConfig[]>(DEFAULT_SHORTCUTS);
    const [listening, setListening] = useState<string | null>(null); // Action ID being listened to

    useEffect(() => {
        const saved = localStorage.getItem('bible_custom_shortcuts');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge com defaults para garantir compatibilidade futura
                setShortcuts(prev => prev.map(def => {
                    const found = parsed.find((p: any) => p.action === def.action);
                    return found ? found : def;
                }));
            } catch (e) { }
        }
    }, []);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!listening) return;

        e.preventDefault();
        e.stopPropagation();

        // Ignorar teclas modificadoras sozinhas
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

        let keyLabel = e.key;
        if (keyLabel === ' ') keyLabel = 'Space';

        // Formatar combo se necessário (ex: Ctrl+A) - Por enquanto simplificado para Single Key como pedido
        // O usuário disse "tecla de atalho", geralmente F1, F2, ou Setas. 
        // Vamos permitir qualquer tecla.

        const newShortcuts = shortcuts.map(s => {
            if (s.action === listening) {
                return { ...s, key: keyLabel };
            }
            return s;
        });

        setShortcuts(newShortcuts);
        setListening(null);
    };

    useEffect(() => {
        if (listening) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [listening, shortcuts]);

    const save = () => {
        localStorage.setItem('bible_custom_shortcuts', JSON.stringify(shortcuts));
        // Disparar evento para atualizar BibleSearch instantaneamente
        window.dispatchEvent(new CustomEvent('bible-shortcuts-updated', { detail: shortcuts }));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#1e1e1e] border border-[#333] shadow-2xl rounded-lg w-[500px] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-[#252525] px-6 py-4 border-b border-[#333] flex justify-between items-center">
                    <h2 className="text-white font-bold text-lg">Configurar Atalhos</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-gray-400 text-sm mb-4">Clique no botão para definir uma nova tecla de atalho para cada ação.</p>

                    {shortcuts.map(s => (
                        <div key={s.action} className="flex items-center justify-between bg-[#2a2a2a] p-3 rounded border border-[#333]">
                            <span className="text-gray-200 font-medium">{s.label}</span>

                            <button
                                onClick={() => setListening(s.action)}
                                className={`px-4 py-2 rounded text-sm font-mono min-w-[100px] text-center transition-colors ${listening === s.action
                                    ? 'bg-blue-600 text-white animate-pulse border border-blue-400'
                                    : 'bg-[#151515] text-yellow-400 border border-[#444] hover:border-gray-300'
                                    }`}
                            >
                                {listening === s.action ? 'Pressione...' : s.key.toUpperCase()}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="bg-[#252525] px-6 py-4 border-t border-[#333] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                    <button onClick={save} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm">
                        Salvar e Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
