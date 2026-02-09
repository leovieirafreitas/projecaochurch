import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ProjectManager } from '../lib/project-manager';
import { useProjectionSync } from '../hooks/useProjectionSync';

const ProjectionLinksModal = dynamic(() => import('./ProjectionLinksModal'), { ssr: false });
const NewProjectModal = dynamic(() => import('./NewProjectModal'), { ssr: false });
const DownloadedBiblesModal = dynamic(() => import('./DownloadedBiblesModal'), { ssr: false });
const MobileRemoteModal = dynamic(() => import('./MobileRemoteModal'), { ssr: false });


export default function MenuBar() {
    const { sendState } = useProjectionSync('sender');
    const [showFileMenu, setShowFileMenu] = useState(false);
    const [showToolsMenu, setShowToolsMenu] = useState(false);
    const [showLinksMenu, setShowLinksMenu] = useState(false); // NOVO
    const [shortcutsEnabled, setShortcutsEnabled] = useState(false); // NOVO
    const [recentProjects, setRecentProjects] = useState<{ path: string, label: string }[]>([]);
    const [currentProjectDisplay, setCurrentProjectDisplay] = useState<string | null>(null);
    const [showLinksModal, setShowLinksModal] = useState(false);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [showOfflineBiblesModal, setShowOfflineBiblesModal] = useState(false);
    const [showRemoteModal, setShowRemoteModal] = useState(false);


    useEffect(() => {
        const load = async () => {
            const recents = await ProjectManager.getRecentsWithLabels();
            setRecentProjects(recents);

            const projectInfo = await ProjectManager.getCurrentProjectInfo();
            if (projectInfo) {
                setCurrentProjectDisplay(projectInfo.display);
            } else {
                setCurrentProjectDisplay(null);
            }

            // LOAD SHORTCUTS PREF
            const shortcutsPref = localStorage.getItem('bible_shortcuts_enabled');
            setShortcutsEnabled(shortcutsPref === 'true');
        };

        load();

        const updateRecents = () => load();
        window.addEventListener('recents-updated', updateRecents);
        window.addEventListener('project-loaded', updateRecents);
        return () => {
            window.removeEventListener('recents-updated', updateRecents);
            window.removeEventListener('project-loaded', updateRecents);
        };
    }, []);

    // Atalho CTRL + S e CTRL + N
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // CTRL + S: Salvar
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (e.shiftKey) {
                    // Salvar Como
                    ProjectManager.saveProject(null, true);
                } else {
                    // Salvar
                    ProjectManager.saveProject();
                }
            }
            // CTRL + N: Novo Projeto
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                setShowNewProjectModal(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
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
        setShowLinksMenu(false);
    };

    const handleExit = async () => {
        if ((window as any).electronAPI) {
            window.close();
            return;
        }

        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
            try {
                const windowModule = await import('@tauri-apps/api/window');
                // @ts-ignore
                const appWindow = windowModule.appWindow || (windowModule.getCurrentWindow ? windowModule.getCurrentWindow() : null);
                if (appWindow) appWindow.close();
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
                <div className="w-full flex items-center h-full text-xs text-gray-300 font-sans px-1">

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

                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white flex justify-between group/item" onClick={() => { setShowNewProjectModal(true); closeAll(); }}>
                                    <span>Novo Projeto...</span>
                                    <span className="text-gray-500 text-[10px] group-hover:text-white/70">Ctrl+N</span>
                                </button>

                                <div className="h-[1px] bg-[#444] my-1"></div>

                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white flex justify-between group/item" onClick={() => { ProjectManager.openProject(); closeAll(); }}>
                                    <span>Abrir Projeto...</span>
                                    <span className="text-gray-500 text-[10px] group-hover:text-white/70">Ctrl+O</span>
                                </button>

                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white flex justify-between group/item" onClick={() => { ProjectManager.saveProject(null, true); closeAll(); }}>
                                    <span>Salvar Como...</span>
                                    <span className="text-gray-500 text-[10px] group-hover:text-white/70">Ctrl+Shift+S</span>
                                </button>

                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white flex justify-between group/item" onClick={() => { ProjectManager.saveProject(); closeAll(); }}>
                                    <span>Salvar</span>
                                    <span className="text-gray-500 text-[10px] group-hover:text-white/70">Ctrl+S</span>
                                </button>

                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white" onClick={() => { ProjectManager.openProjectsFolder(); closeAll(); }}>
                                    Pasta Projetos
                                </button>

                                <div className="h-[1px] bg-[#444] my-1"></div>

                                <div className="relative group/submenu">
                                    <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white flex justify-between w-full items-center">
                                        <span>Projetos Recentes</span>
                                        <span className="text-gray-500 text-[10px] group-hover/submenu:text-white">▶</span>
                                    </button>

                                    {/* SUBMENU */}
                                    <div className="absolute left-full top-0 bg-[#2d2d2d] border border-[#111] shadow-xl min-w-[300px] py-1 flex flex-col hidden group-hover/submenu:flex">
                                        {recentProjects.length === 0 && <div className="px-4 py-2 text-gray-500 italic text-xs">Nenhum projeto recente</div>}
                                        {recentProjects.map((p, i) => {
                                            return (
                                                <button key={i} className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white w-full truncate text-xs font-mono" title={p.path} onClick={() => { ProjectManager.loadFromFile(p.path); closeAll(); }}>
                                                    {p.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="h-[1px] bg-[#444] my-1"></div>

                                <button className="text-left px-4 py-2 hover:bg-red-600 hover:text-white" onClick={() => { ProjectManager.exitApp(); closeAll(); }}>
                                    Sair
                                </button>
                            </div>
                        )}
                    </div>

                    {/* MENU LINKS (NOVO) */}
                    <div className="relative group">
                        <button
                            className={`px-3 h-full hover:bg-[#3d3d3d] transition-colors flex items-center ${showLinksModal ? 'bg-[#3d3d3d] text-white' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (showLinksMenu) closeAll();
                                else { closeAll(); setShowLinksMenu(true); }
                            }}
                        >
                            Links
                        </button>

                        {showLinksMenu && (
                            <div className="absolute top-8 left-0 bg-[#2d2d2d] border border-[#111] shadow-xl min-w-[200px] py-1 flex flex-col z-50">
                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white" onClick={() => { setShowLinksModal(true); closeAll(); }}>
                                    Links de Projeção
                                </button>
                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white" onClick={() => { setShowOfflineBiblesModal(true); closeAll(); }}>
                                    Gerenciar Bíblias Offline
                                </button>
                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white" onClick={() => { setShowRemoteModal(true); closeAll(); }}>
                                    Mobile Remote (QR Code)
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
                                <button className="text-left px-4 py-2 hover:bg-[#007acc] hover:text-white" onClick={() => { window.dispatchEvent(new Event('open-projection-editor')); closeAll(); }}>
                                    Editar Projeção
                                </button>

                                <div className="h-[1px] bg-[#444] my-1"></div>

                                {/* ATIVAR ATALHOS TOGGLE */}
                                <button
                                    className="text-left px-4 py-2 hover:bg-[#3d3d3d] hover:text-white flex items-center gap-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newState = !shortcutsEnabled;
                                        setShortcutsEnabled(newState);
                                        localStorage.setItem('bible_shortcuts_enabled', String(newState));
                                        window.dispatchEvent(new CustomEvent('bible-shortcuts-toggle', { detail: newState }));
                                    }}
                                >
                                    <div className={`w-3 h-3 border border-gray-400 rounded-sm flex items-center justify-center ${shortcutsEnabled ? 'bg-[#007acc] border-[#007acc]' : ''}`}>
                                        {shortcutsEnabled && <span className="text-white text-[8px]">✓</span>}
                                    </div>
                                    <span>Ativar Atalhos</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* CURRENT PROJECT INDICATOR (NEW STYLE) */}
                    {currentProjectDisplay && (
                        <div className="ml-4 flex items-center gap-2 bg-[#1a1a1a] px-3 py-1 rounded-md border border-[#333] shadow-sm">
                            <span className="text-[11px] text-gray-400 font-mono select-none uppercase tracking-wide">
                                {currentProjectDisplay}
                            </span>
                        </div>
                    )}

                    {/* CANTO DIREITO: MODO MOBILE + PROJEÇÃO LOUVOR + VERSÃO */}
                    <div className="ml-auto flex items-center gap-3 pr-3">
                        {/* BOTÃO MODO MOBILE/DESKTOP */}
                        <button
                            onClick={() => {
                                const newMode = !localStorage.getItem('mobileMode') || localStorage.getItem('mobileMode') === 'false';
                                localStorage.setItem('mobileMode', String(newMode));
                                window.dispatchEvent(new CustomEvent('mobile-mode-toggle', { detail: newMode }));

                                // V114: SEND CONTROL MESSAGES (LOCK/UNLOCK)
                                if (newMode) {
                                    // Activating Mobile -> UNLOCK receiver
                                    sendState({
                                        type: 'control',
                                        action: 'unlock_mobile',
                                        source: 'desktop',
                                        timestamp: Date.now()
                                    });
                                } else {
                                    // Activating Desktop -> LOCK receiver & RELOAD
                                    sendState({
                                        type: 'control',
                                        action: 'lock_mobile',
                                        source: 'desktop',
                                        timestamp: Date.now()
                                    });
                                    // Optional: Send reset to clear screen? "lock_mobile" logic could handle it if needed.
                                    // Keeping existing reload just in case, but usually lock is enough.
                                    setTimeout(() => {
                                        sendState({
                                            type: 'control',
                                            action: 'reload',
                                            source: 'desktop',
                                            timestamp: Date.now()
                                        });
                                    }, 100);
                                }
                            }}
                            className={`text-[10px] uppercase font-bold px-3 py-1 rounded flex items-center gap-1 transition shadow-sm border ${localStorage.getItem('mobileMode') === 'true'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                                : 'bg-[#1a1a1a] hover:bg-[#333] text-gray-300 border-[#444]'
                                }`}
                            title="Alternar entre Modo Desktop (envia comandos) e Modo Mobile (recebe comandos)"
                        >
                            {localStorage.getItem('mobileMode') === 'true' ? 'ATIVAR DESKTOP' : 'ATIVAR MOBILE'}
                        </button>


                        <button
                            onClick={() => window.location.href = '/music'}
                            className="bg-[#1a1a1a] hover:bg-[#333] text-gray-300 border border-[#444] text-[10px] uppercase font-bold px-3 py-1 rounded flex items-center gap-1 transition shadow-sm"
                            title="Ir para Projeção de Louvor"
                        >
                            Projeção Louvor <span className="text-blue-500 font-normal opacity-80">(Beta)</span>
                        </button>
                        <div className="w-px h-4 bg-[#444]"></div>
                        <span className="opacity-40 text-[10px] font-mono select-none">v0.3.53</span>
                    </div>

                </div>
            </div>

            {/* Espaçador para compensar o menu fixo */}
            <div className="h-8 w-full bg-[#1a1a1a] shrink-0"></div>

            {/* MODAL LINKS */}
            {showLinksModal && <ProjectionLinksModal onClose={() => setShowLinksModal(false)} />}

            {/* MODAL NOVO PROJETO */}
            {showNewProjectModal && <NewProjectModal onClose={() => setShowNewProjectModal(false)} />}

            {/* MODAL OFFLINE BIBLES */}
            {showOfflineBiblesModal && <DownloadedBiblesModal onClose={() => setShowOfflineBiblesModal(false)} />}

            {/* MODAL REMOTE MOBILE */}
            {showRemoteModal && <MobileRemoteModal onClose={() => setShowRemoteModal(false)} />}


        </>
    );
}
