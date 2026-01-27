import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ProjectManager } from '../lib/project-manager';

const ProjectionLinksModal = dynamic(() => import('./ProjectionLinksModal'), { ssr: false });

export default function MenuBar() {
    const [showFileMenu, setShowFileMenu] = useState(false);
    const [showToolsMenu, setShowToolsMenu] = useState(false);
    const [recentProjects, setRecentProjects] = useState<string[]>([]);
    const [showLinksModal, setShowLinksModal] = useState(false);

    useEffect(() => {
        setRecentProjects(ProjectManager.getRecents());

        const updateRecents = () => setRecentProjects(ProjectManager.getRecents());
        window.addEventListener('recents-updated', updateRecents);
        return () => window.removeEventListener('recents-updated', updateRecents);
    }, []);

    // Fechar menus ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.group')) {
                closeAll();
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const closeAll = () => {
        setShowFileMenu(false);
        setShowToolsMenu(false);
    };

    const handleExit = async () => {
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
            try {
                const { appWindow } = await import('@tauri-apps/api/window');
                appWindow.close();
            } catch (e) {
                console.error(e);
            }
        } else {
            // Web fallback
            window.close();
        }
    };

    return (
        <>
            <div className="fixed top-0 left-0 right-0 z-50 bg-[#2d2d2d] border-b border-[#111] select-none h-8 flex items-center shadow-sm">
                <div className="flex items-center h-full text-xs text-gray-300 font-sans px-1">



                    {/* MENU ARQUIVOS */}
                    <div className="relative group">
                        <button
                            className={`px-3 h-full hover:bg-[#3d3d3d] transition-colors flex items-center ${showFileMenu ? 'bg-[#3d3d3d] text-white' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (showFileMenu) closeAll();
                                else { closeAll(); setShowFileMenu(true); }
                            }}
                        >
                            Arquivos
                        </button>

                        {showFileMenu && (
                            <div className="absolute top-8 left-0 bg-[#2d2d2d] border border-[#111] shadow-xl min-w-[220px] py-1 flex flex-col z-50">
                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white flex justify-between group/item" onClick={() => { ProjectManager.openProject(); closeAll(); }}>
                                    <span>Abrir Projeto...</span>
                                    <span className="text-gray-500 text-[10px] group-hover:text-white/70">Ctrl+O</span>
                                </button>

                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white flex justify-between group/item" onClick={() => { ProjectManager.saveProject(); closeAll(); }}>
                                    <span>Salvar Projeto...</span>
                                    <span className="text-gray-500 text-[10px] group-hover:text-white/70">Ctrl+S</span>
                                </button>

                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white" onClick={() => { ProjectManager.openProjectsFolder(); closeAll(); }}>
                                    Pasta Projetos
                                </button>

                                <div className="h-[1px] bg-[#444] my-1"></div>

                                <div className="px-4 py-1 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Recentes</div>
                                {recentProjects.length === 0 && <div className="px-4 py-1 text-gray-500 italic">Nenhum</div>}
                                {recentProjects.map((p, i) => {
                                    const name = p.split(/[\\/]/).pop();
                                    return (
                                        <button key={i} className="text-left px-4 py-1.5 hover:bg-[#007acc] hover:text-white w-full truncate" title={p} onClick={() => { ProjectManager.loadFromFile(p); closeAll(); }}>
                                            {name}
                                        </button>
                                    );
                                })}

                                <div className="h-[1px] bg-[#444] my-1"></div>

                                <button className="text-left px-4 py-2 hover:bg-red-600 hover:text-white" onClick={handleExit}>
                                    Sair
                                </button>
                            </div>
                        )}
                    </div>

                    {/* MENU FERRAMENTAS */}
                    <div className="relative group">
                        <button
                            className={`px-3 h-full hover:bg-[#3d3d3d] transition-colors flex items-center ${showToolsMenu ? 'bg-[#3d3d3d] text-white' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (showToolsMenu) closeAll();
                                else { closeAll(); setShowToolsMenu(true); }
                            }}
                        >
                            Ferramentas
                        </button>

                        {showToolsMenu && (
                            <div className="absolute top-8 left-0 bg-[#2d2d2d] border border-[#111] shadow-xl min-w-[200px] py-1 flex flex-col z-50">
                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white" onClick={() => { setShowLinksModal(true); closeAll(); }}>
                                    Links de Projeção
                                </button>
                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white" onClick={() => { window.dispatchEvent(new Event('open-projection-editor')); closeAll(); }}>
                                    Editar Projeção
                                </button>
                            </div>
                        )}
                    </div>

                    {/* CANTO DIREITO: PROJEÇÃO LOUVOR + VERSÃO */}
                    <div className="ml-auto flex items-center gap-3 pr-3">
                        <button
                            onClick={() => window.location.href = '/music'}
                            className="bg-[#1a1a1a] hover:bg-[#333] text-gray-300 border border-[#444] text-[10px] uppercase font-bold px-3 py-1 rounded flex items-center gap-1 transition shadow-sm"
                            title="Ir para Projeção de Louvor"
                        >
                            Projeção Louvor <span className="text-blue-500 font-normal opacity-80">(Beta)</span>
                        </button>
                        <div className="w-px h-4 bg-[#444]"></div>
                        <span className="opacity-40 text-[10px] font-mono select-none">v1.0.0</span>
                    </div>





                </div>
            </div>

            {/* Espaçador para compensar o menu fixo */}
            <div className="h-8 w-full bg-[#1a1a1a] shrink-0"></div>

            {/* MODAL LINKS */}
            {showLinksModal && <ProjectionLinksModal onClose={() => setShowLinksModal(false)} />}
        </>
    );
}
