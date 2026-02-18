import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ProjectManager } from '../lib/project-manager';
import { useProjectionSync } from '../hooks/useProjectionSync';

const ProjectionLinksModal = dynamic(() => import('./ProjectionLinksModal'), { ssr: false });
const NewProjectModal = dynamic(() => import('./NewProjectModal'), { ssr: false });
const DownloadedBiblesModal = dynamic(() => import('./DownloadedBiblesModal'), { ssr: false });
const MobileRemoteModal = dynamic(() => import('./MobileRemoteModal'), { ssr: false });
const ShortcutsModal = dynamic(() => import('./ShortcutsModal'), { ssr: false });

// CONSTANTES DE NOME (Mapeamento manual para garantir nomes bonitos no menu)
const VERSION_FULL_NAMES: Record<string, string> = {
    'ARA': 'Almeida Revista e Atualizada',
    'ARC': 'Almeida Revista e Corrigida',
    'NVI': 'Nova Versão Internacional',
    'NVT': 'Nova Versão Transformadora',
    'KJA': 'King James Atualizada',
    'ACF': 'Almeida Corrigida Fiel',
    'NAA': 'Nova Almeida Atualizada',
    'NBV': 'Nova Bíblia Viva',
    'NTLH': 'Nova Tradução na Linguagem de Hoje',
    'TB': 'Tradução Brasileira',
    'BKJ': 'Bíblia King James Fiel 1611',
    'VFL': 'Bíblia Livre Para Todos',
    'OL': 'O Livro',
    'PORARA': 'Almeida Revista e Atualizada',
    'PORARC': 'Almeida Revista e Corrigida',
    'PORACF': 'Almeida Corrigida Fiel',
    'PORBBS': 'Bíblia Sagrada (BBS)',
    '129': 'Nova Versão Internacional',
    '1967': 'O Livro',
    '4360': 'Nova Versão Internacional (PT)',
    '215': 'Almeida Corrigida Fiel',
};

export default function MenuBar() {
    const { sendState } = useProjectionSync('sender');

    // Helper para renderizar menus de versão agrupados
    const renderVersionMenuBlock = (slotIndex: number, buttonLabel: string, headerLabel: string) => {
        const visibleVersions = versions.filter(v => !hiddenVersions.includes(String(v.id)));

        const renderItem = (v: any) => {
            const isSelected = String(activeSlots[slotIndex]) === String(v.id);
            const label = VERSION_FULL_NAMES[v.abbreviation?.toUpperCase()] || v.name || v.id;
            return (
                <button
                    key={v.id}
                    className={`w-full px-4 py-1.5 text-left text-[11px]  hover:bg-[#007acc] hover:text-white border-b border-[#444] uppercase flex items-center justify-between ${isSelected ? 'text-blue-400 font-bold bg-[#333]' : ''}`}
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('bible-set-slot-version', { detail: { slot: slotIndex, version: v.id } }));
                        closeAll();
                    }}
                >
                    <span className="truncate mr-2">{label}</span>
                    {isSelected && <span className="text-blue-500">✔</span>}
                </button>
            );
        };

        const pt = visibleVersions.filter(v => !v.lang || v.lang.toLowerCase().startsWith('pt'));
        const en = visibleVersions.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
        const es = visibleVersions.filter(v => v.lang && v.lang.toLowerCase().startsWith('es'));
        const other = visibleVersions.filter(v => v.lang && !v.lang.toLowerCase().startsWith('pt') && !v.lang.toLowerCase().startsWith('en') && !v.lang.toLowerCase().startsWith('es'));

        return (
            <div className="relative group/item">
                <button className="w-full text-left px-4 py-2 hover:bg-[#007acc] hover:text-white flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="text-gray-400 text-xs">↔</span> {buttonLabel}</span>
                    <span className="text-xs">▶</span>
                </button>
                <div className="absolute left-full top-0 hidden group-hover/item:block bg-[#2d2d2d] text-gray-300 border border-[#111] shadow-xl w-[300px] max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
                    <div className="bg-[#3d3d3d] px-3 py-2 text-[10px] font-bold text-gray-400 border-b border-[#444] sticky top-0 uppercase">{headerLabel}</div>

                    {pt.length > 0 && <div className="bg-[#333] px-3 py-1 text-[9px] font-bold text-gray-500 border-b border-[#444] border-t border-gray-700">PORTUGUÊS</div>}
                    {pt.map(renderItem)}

                    {en.length > 0 && <div className="bg-[#333] px-3 py-1 text-[9px] font-bold text-gray-500 border-b border-[#444] border-t border-gray-700">ENGLISH</div>}
                    {en.map(renderItem)}

                    {es.length > 0 && <div className="bg-[#333] px-3 py-1 text-[9px] font-bold text-gray-500 border-b border-[#444] border-t border-gray-700">ESPAÑOL</div>}
                    {es.map(renderItem)}

                    {other.length > 0 && <div className="bg-[#333] px-3 py-1 text-[9px] font-bold text-gray-500 border-b border-[#444] border-t border-gray-700">OUTROS</div>}
                    {other.map(renderItem)}
                </div>
            </div>
        );
    };
    const [showFileMenu, setShowFileMenu] = useState(false);
    const [showToolsMenu, setShowToolsMenu] = useState(false);
    const [showLinksMenu, setShowLinksMenu] = useState(false);
    const [showVersionMenu, setShowVersionMenu] = useState(false);
    const [shortcutsEnabled, setShortcutsEnabled] = useState(false); // NOVO
    const [recentProjects, setRecentProjects] = useState<{ path: string, label: string }[]>([]);
    const [currentProjectDisplay, setCurrentProjectDisplay] = useState<string | null>(null);
    const [showLinksModal, setShowLinksModal] = useState(false);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [showOfflineBiblesModal, setShowOfflineBiblesModal] = useState(false);
    const [showRemoteModal, setShowRemoteModal] = useState(false);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);

    // Cache de Versões para o Menu
    // Cache de Versões para o Menu
    const [versions, setVersions] = useState<any[]>([]);
    const [hiddenVersions, setHiddenVersions] = useState<string[]>([]);
    const [activeSlots, setActiveSlots] = useState<string[]>(['129', 'PORARA', 'PORACF']); // Slots tracking

    useEffect(() => {
        // Carrega versões do cache (gravado pelo BibleSearch)
        const loadCache = () => {
            const c = localStorage.getItem('cached_bible_versions');
            const h = localStorage.getItem('bible_hidden_versions');
            const s0 = localStorage.getItem('bible_slot_0');
            const s1 = localStorage.getItem('bible_slot_1');
            const s2 = localStorage.getItem('bible_slot_2');

            if (c) try { setVersions(JSON.parse(c)); } catch (e) { }
            if (h) try { setHiddenVersions(JSON.parse(h)); } catch (e) { }
            if (s0 || s1 || s2) {
                setActiveSlots([
                    s0 || activeSlots[0],
                    s1 || activeSlots[1],
                    s2 || activeSlots[2]
                ]);
            }
        };
        loadCache();
        // Polling suave para manter sintonia sem Context API complexa
        const interval = setInterval(loadCache, 2000);
        return () => clearInterval(interval);
    }, []);

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
        setShowVersionMenu(false);
        setShowShortcutsModal(false);
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

                    {/* MENU VERSÃO (Completo estilo Holyrics) */}
                    <div className="relative group">
                        <button
                            className={`px-3 h-full hover:bg-[#3d3d3d] transition-colors flex items-center ${showVersionMenu ? 'bg-[#3d3d3d] text-white' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (showVersionMenu) closeAll();
                                else { closeAll(); setShowVersionMenu(true); }
                            }}
                        >
                            Versão
                        </button>

                        {showVersionMenu && (
                            <div className="absolute top-8 left-0 bg-[#2d2d2d] text-gray-300 border border-[#111] shadow-xl min-w-[220px] py-1 flex flex-col z-50 text-sm font-sans">

                                {/* ITEM: PADRÃO (Submenu) */}
                                {renderVersionMenuBlock(0, 'Padrão', 'DEFINIR VERSÃO PADRÃO')}

                                {/* ITEM: AUX 1 (Submenu) */}
                                {renderVersionMenuBlock(1, 'Alterar auxiliar 1', 'DEFINIR AUXILIAR 1')}

                                {/* ITEM: AUX 2 (Submenu) */}
                                {renderVersionMenuBlock(2, 'Alterar auxiliar 2', 'DEFINIR AUXILIAR 2')}

                                <div className="my-1 border-b border-[#444]"></div>

                                {/* ITEM: OCULTAR (Submenu Checkbox) */}
                                <div className="relative group/item">
                                    <button className="w-full text-left px-4 py-2 hover:bg-[#007acc] hover:text-white flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <span className="text-red-400 font-bold text-xs">✕</span> Ocultar
                                        </span>
                                        <span className="text-xs">▶</span>
                                    </button>
                                    <div className="absolute left-full top-0 hidden group-hover/item:block bg-[#2d2d2d] text-gray-300 border border-[#111] shadow-xl w-[300px] max-h-[400px] overflow-y-auto">
                                        <div className="bg-[#3d3d3d] px-3 py-2 text-[10px] font-bold text-gray-400 border-b border-[#444] sticky top-0">MARQUE PARA OCULTAR</div>
                                        {versions.map(v => {
                                            const isHidden = hiddenVersions.includes(String(v.id));
                                            return (
                                                <button
                                                    key={v.id}
                                                    className="w-full px-4 py-1.5 text-left text-[11px] hover:bg-[#007acc] border-b border-[#444] uppercase flex items-center gap-2"
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Não fecha menu
                                                        window.dispatchEvent(new CustomEvent('bible-toggle-hidden', { detail: { version: v.id } }));
                                                        setHiddenVersions(prev => isHidden ? prev.filter(x => x !== String(v.id)) : [...prev, String(v.id)]);
                                                    }}
                                                >
                                                    <input type="checkbox" checked={isHidden} readOnly className="cursor-pointer" />
                                                    <span className={isHidden ? 'text-gray-400 line-through decoration-red-400' : 'text-gray-300'}>
                                                        {VERSION_FULL_NAMES[v.abbreviation?.toUpperCase()] || v.name || v.id}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
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
                                        closeAll();
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



                    {/* MENU ATALHOS (NOVO) */}
                    <button
                        className={`px-3 h-full hover:bg-[#3d3d3d] transition-colors flex items-center ${showShortcutsModal ? 'bg-[#3d3d3d] text-white' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            closeAll();
                            setShowShortcutsModal(true);
                        }}
                    >
                        Atalhos
                    </button>

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

            {/* MODAL ATALHOS */}
            {showShortcutsModal && <ShortcutsModal onClose={() => setShowShortcutsModal(false)} />}


        </>
    );
}
