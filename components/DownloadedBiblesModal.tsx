import React, { useEffect, useState } from 'react';
import { LocalBibleManager } from '../lib/local-bible-manager';

interface Props {
    onClose: () => void;
}

interface BibleVersion {
    id: string;
    source: 'user' | 'system';
    name?: string;
    installedName?: string;
}

export default function DownloadedBiblesModal({ onClose }: Props) {
    const [list, setList] = useState<BibleVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [docPath, setDocPath] = useState('');
    const [sysPath, setSysPath] = useState('');

    const load = () => {
        // @ts-ignore
        LocalBibleManager.listDownloadedVersions().then(setList);
    };

    useEffect(() => {
        load();
        LocalBibleManager.getBiblesPath().then(setDocPath);
        // We can't ask for system path easily publically on LocalBibleManager properly yet without tweak, 
        // but we can assume it's where resources are.
        // Let's just say "Pasta do Instalador" for system source.
    }, []);

    const handleDelete = async (v: BibleVersion) => {
        if (v.source === 'system') {
            alert('Versões pré-instaladas (do sistema) não podem ser excluídas.');
            return;
        }
        if (!confirm(`Tem certeza que deseja apagar a versão ${v.id} do disco local?`)) return;
        setLoading(true);
        try {
            await LocalBibleManager.deleteVersion(v.id);
            load();
            window.dispatchEvent(new Event('offline-bibles-changed'));
        } catch (e) {
            alert('Erro ao excluir.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#1e1e1e] rounded-lg shadow-2xl w-[600px] max-w-full overflow-hidden flex flex-col max-h-[90vh] border border-[#333] text-gray-200">
                <div className="p-4 border-b border-[#333] bg-[#252525] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-900/30 p-1.5 rounded text-blue-400 border border-blue-500/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <h3 className="font-bold text-gray-100 text-lg tracking-tight">Gerenciar Bíblias Instaladas</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-[#1e1e1e] scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent" style={{ maxHeight: '60vh' }}>
                    {list.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            <p className="text-center font-medium">Nenhuma versão localizada.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between items-end px-1 border-b border-[#333] pb-2 mb-2">
                                <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Versões Disponíveis ({list.length})</p>
                                <span className="text-[10px] text-gray-600">Role para ver mais ▼</span>
                            </div>

                            {list.filter(v => !!v && !!v.id).map(v => (
                                <div key={v.id} className="flex justify-between items-center bg-[#252525] p-3 rounded-lg border border-[#333] group hover:border-gray-500 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded flex items-center justify-center font-black text-sm border ${v.source === 'system' ? 'bg-purple-900/20 text-purple-400 border-purple-500/20' : 'bg-green-900/20 text-green-400 border-green-500/20'}`}>
                                            {v.id.substring(0, 3)}
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-bold text-gray-200 text-sm leading-none">{v.installedName || v.name || v.id}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                {v.source === 'system' ? (
                                                    <span className="text-[10px] text-purple-400 bg-purple-900/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium flex items-center gap-1">
                                                        <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                        Pré-instalada
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-green-400 bg-green-900/10 px-1.5 py-0.5 rounded border border-green-500/20 font-medium flex items-center gap-1">
                                                        <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                        Baixada
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-gray-600 font-mono">{v.id}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center">
                                        {v.source === 'user' && (
                                            <button
                                                onClick={() => handleDelete(v)}
                                                disabled={loading}
                                                className="text-gray-500 hover:text-red-400 p-2 rounded hover:bg-white/5 disabled:opacity-30 transition-all border border-transparent hover:border-red-500/20"
                                                title="Excluir do disco"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                        {v.source === 'system' && (
                                            <div className="text-gray-700 p-2 cursor-not-allowed opacity-50" title="Não é possível apagar versões do sistema">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* PATH DISPLAYS */}
                <div className="mt-auto border-t border-[#333] p-4 bg-[#252525] space-y-3">
                    <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1 tracking-wider">
                            <svg className="w-3 h-3 text-green-500 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Bíblias Baixadas (Salvas em)
                        </p>
                        <div
                            className="bg-[#111] p-2 text-[10px] text-gray-400 font-mono break-all rounded border border-[#333] select-all cursor-text hover:border-gray-600 transition-colors"
                            title="Local para onde as bíblias são baixadas"
                        >
                            {docPath || 'Carregando...'}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1 tracking-wider">
                            <svg className="w-3 h-3 text-purple-500 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Bíblias Pré-instaladas (Diretório do App)
                        </p>
                        <div className="bg-[#1a1a1a] p-2 text-[10px] text-gray-600 font-mono break-all rounded border border-[#333] opacity-70">
                            (Interno) resources/bibles
                        </div>
                        <p className="text-[9px] text-gray-600 mt-1 ml-1">
                            * Bíblias do sistema não podem ser movidas ou excluídas pois fazem parte do instalador.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
