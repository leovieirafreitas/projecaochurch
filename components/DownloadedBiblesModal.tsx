import React, { useEffect, useState } from 'react';
import { LocalBibleManager } from '../lib/local-bible-manager';

interface Props {
    onClose: () => void;
}

export default function DownloadedBiblesModal({ onClose }: Props) {
    const [list, setList] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [path, setPath] = useState('');

    const load = () => {
        LocalBibleManager.listDownloadedVersions().then(setList);
    };

    useEffect(() => {
        load();
        LocalBibleManager.getBiblesPath().then(setPath);
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm(`Tem certeza que deseja apagar a versão ${id} do disco local?`)) return;
        setLoading(true);
        try {
            await LocalBibleManager.deleteVersion(id);
            load();
            window.dispatchEvent(new Event('offline-bibles-changed'));
        } catch (e) {
            alert('Erro ao excluir.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-lg shadow-2xl w-[500px] max-w-full overflow-hidden flex flex-col max-h-[80vh] border border-gray-200">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-100 p-1.5 rounded text-blue-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">Gerenciar Bíblias Offline</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-white">
                    {list.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            <p className="text-center font-medium">Nenhuma versão baixada.</p>
                            <p className="text-xs text-center mt-1 max-w-[200px]">Use o botão "Baixar" na tela principal para salvar versões offline.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide px-1">Versões Instaladas ({list.length})</p>
                            {list.map(id => (
                                <div key={id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 group hover:border-blue-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center text-green-700">
                                            <span className="font-bold text-xs">{id.substring(0, 3)}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 text-sm">{id}</span>
                                            <span className="text-[10px] text-green-600 font-medium">✓ Disponível Offline</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleDelete(id)}
                                        disabled={loading}
                                        className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 disabled:opacity-50 transition"
                                        title="Excluir do disco"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* PATH DISPLAY */}
                    <div className="mt-6 border-t pt-4">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                            Local de Armazenamento
                        </p>
                        <div
                            className="bg-gray-100 p-2 text-[10px] text-gray-600 font-mono break-all rounded border border-gray-200 select-all cursor-text hover:bg-white transition-colors"
                            title="Clique para selecionar e copiar"
                        >
                            {path || 'Carregando...'}
                        </div>
                    </div>
                </div>

                <div className="p-3 bg-gray-50 border-t text-right">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 text-sm font-medium hover:bg-gray-50">Fechar</button>
                </div>
            </div>
        </div>
    );
}
