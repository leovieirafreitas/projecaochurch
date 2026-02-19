
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { VagalumeClient, MusicSearchResult } from '../lib/vagalume-client';
import type { MusicSearchResult as MusicType } from '../lib/vagalume-client';
import BibleProjection from '../components/BibleProjection'; // Reutiliza o editor
import { supabase } from '../lib/supabaseClient';
import { StorageHelper } from '../lib/storage-helper';
import { useProjectionSync } from '../hooks/useProjectionSync';

export default function MusicPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MusicType[]>([]);
    const [selectedMusic, setSelectedMusic] = useState<MusicType | null>(null);
    const [slides, setSlides] = useState<string[]>([]);
    const [activeSlideIndex, setActiveSlideIndex] = useState(-1);

    // NEW STATES
    const [fullLyrics, setFullLyrics] = useState<string>(''); // Letra completa crua
    const [linesPerSlide, setLinesPerSlide] = useState<number>(4); // Default 4 linhas

    // Editor
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [previewSettings, setPreviewSettings] = useState<any>(null);

    // Performance Broadcast
    const lastBroadcastSyncRef = useRef<string>('');

    // --- LOGICA SUPABASE ---
    const [tab, setTab] = useState<'online' | 'local'>('online');
    const [isEditingText, setIsEditingText] = useState(false);
    const [mySongs, setMySongs] = useState<MusicType[]>([]);

    const loadLocalSongs = async () => {
        if (!supabase) return;
        const { data, error } = await supabase
            .from('songs')
            .select('*')
            .order('title', { ascending: true });

        if (error) {
            console.error('Erro Supabase:', error);
            // Fallback se a tabela nao existir ainda (usuario nao criou)
            return;
        }

        if (data) {
            setMySongs(data.map((s: any) => ({
                id: s.id,
                title: s.title,
                artist: s.artist,
                text: s.text,
                isLocal: true
            })));
        }
    };
    useEffect(() => { if (tab === 'local') loadLocalSongs(); }, [tab]);

    const saveCurrentMusic = async () => {
        if (!selectedMusic || !fullLyrics) return;

        const songData = {
            title: selectedMusic.title,
            artist: selectedMusic.artist,
            text: fullLyrics
        };

        const isLocal = (selectedMusic as any).isLocal;
        const currentId = selectedMusic.id;

        if (isLocal && currentId && currentId !== 'new') {
            // UPDATE
            if (!supabase) return;
            const { error } = await supabase
                .from('songs')
                .update(songData)
                .eq('id', currentId);

            if (error) alert('Erro ao atualizar: ' + error.message);
            else alert('Música atualizada!');
        } else {
            // INSERT
            if (!supabase) return;
            const { error } = await supabase
                .from('songs')
                .insert([songData]); // ID gerado automaticamente

            if (error) alert('Erro ao salvar: ' + error.message);
            else alert('Música salva!');
        }

        if (tab === 'local') loadLocalSongs();
    };

    const deleteMusic = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Excluir música?')) return;

        if (!supabase) return;
        const { error } = await supabase
            .from('songs')
            .delete()
            .eq('id', id);

        if (error) alert('Erro ao excluir: ' + error.message);

        loadLocalSongs();
        if (selectedMusic?.id === id) {
            setSelectedMusic(null);
            setSlides([]);
            setFullLyrics('');
        }
    };
    // --------------------------------------

    // GERA SLIDES DINANICAMENTE
    useEffect(() => {
        if (!fullLyrics) {
            setSlides([]);
            return;
        }

        // Normalização CRÍTICA: remove \r para evitar problemas de compatibilidade e garante quebras limpas
        const text = fullLyrics.replace(/\r/g, '');

        // Separa estrofes por linha em branco
        const rawStanzas = text.split('\n\n');
        const finalSlides: string[] = [];

        rawStanzas.forEach(stanza => {
            // Remove linhas vazias extras dentro da estrofe
            const lines = stanza.split('\n').filter(l => l.trim() !== '');
            if (lines.length === 0) return;

            // Se for muito grande (Auto/Estrofe), mas a estrofe for GIGANTE (> 8 linhas), força quebra em 4
            // Ou se linesPerSlide for definido
            const limit = linesPerSlide > 20 ? 4 : linesPerSlide;
            const isAuto = linesPerSlide > 20; // Auto = Estrofe inteira (mas com bom senso)

            if (isAuto) {
                // Modo Estrofe: Se tiver até 8 linhas, vai num slide só. Se tiver mais, quebra.
                if (lines.length <= 8) {
                    finalSlides.push(lines.join('\n'));
                } else {
                    // Quebra de 4 em 4 se for estrofe gigante
                    for (let i = 0; i < lines.length; i += 4) {
                        finalSlides.push(lines.slice(i, i + 4).join('\n'));
                    }
                }
            } else {
                // Modo Rígido (2, 3, 4 linhas)
                for (let i = 0; i < lines.length; i += limit) {
                    finalSlides.push(lines.slice(i, i + limit).join('\n'));
                }
            }
        });

        setSlides(finalSlides);
        // Não reseta o activeSlideIndex aqui para não pular se mudar no meio
    }, [fullLyrics, linesPerSlide]);

    // Busca
    const handleSearch = async () => {
        if (!query.trim()) return;
        setResults([]);
        const data = await VagalumeClient.searchMusic(query);
        setResults(data);
    };

    // Selecionar Música e Carregar Letra
    const handleSelectMusic = async (music: MusicType) => {
        setSelectedMusic(music);
        setSlides([]); // Limpa enquanto carrega
        setFullLyrics('');

        const fullData = await VagalumeClient.getLyrics(music.id);

        if (fullData && fullData.text) {
            setFullLyrics(fullData.text);
            setActiveSlideIndex(-1);
        }
    };

    // Projetar Slide
    const projectSlide = (index: number) => {
        setActiveSlideIndex(index);
        syncToApi(index);
    };

    // --- SINCRONIZAÇÃO UNIFICADA ---
    const { sendState } = useProjectionSync('sender');

    // Sincronização (Cópia da lógica do BibleSearch)
    const syncToApi = (index: number) => {
        const text = index >= 0 ? slides[index] : '';
        const ref = selectedMusic ? `${selectedMusic.title.toUpperCase()}` : '';

        // Fallback style se não tiver settings carregadas
        const style = previewSettings || {};

        // OTIMIZAÇÃO: Remove imagem gigante do payload de sincronização
        let styleToSync = style;
        if (styleToSync.backgroundImage && styleToSync.backgroundImage.length > 5000) {
            styleToSync = { ...styleToSync, backgroundImage: 'INDEXED_DB' };
        }

        const payload = {
            verseText: text,
            reference: ref,
            slides: slides, // NOVA PROPRIEDADE: Envia cortes exatos do louvor (V118)
            slideIndex: index,
            version: 'MUSIC',
            style: styleToSync,
            timestamp: Date.now()
        };

        // Evita enviar se for exatamente o mesmo payload (exceto timestamp)
        const currentPayloadStr = JSON.stringify({ ...payload, timestamp: 0 });
        if (currentPayloadStr === lastBroadcastSyncRef.current) return;
        lastBroadcastSyncRef.current = currentPayloadStr;

        sendState(payload);
    };

    // Carregar configurações salvas (Otimizado)
    const lastSettingsRawRef = useRef<string>('');
    const lastIndexedBgRef = useRef<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const saved = localStorage.getItem('music_settings');
            if (saved && saved !== lastSettingsRawRef.current) {
                try {
                    lastSettingsRawRef.current = saved;
                    const parsed = JSON.parse(saved);

                    // Só busca no IndexedDB se necessário
                    if (!parsed.backgroundImage || parsed.backgroundImage.length < 100) {
                        if (lastIndexedBgRef.current) {
                            parsed.backgroundImage = lastIndexedBgRef.current;
                        } else {
                            const indexedBg = await StorageHelper.getBackground('music_settings');
                            if (indexedBg) {
                                parsed.backgroundImage = indexedBg;
                                lastIndexedBgRef.current = indexedBg;
                            }
                        }
                    } else if (parsed.backgroundImage.startsWith('data:')) {
                        lastIndexedBgRef.current = parsed.backgroundImage;
                    }

                    setPreviewSettings((prev: any) => {
                        if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
                        return parsed;
                    });
                } catch (e) { }
            }
        };

        const handleStorage = () => { lastSettingsRawRef.current = ''; lastIndexedBgRef.current = null; load(); };
        window.addEventListener('storage', handleStorage);
        window.addEventListener('local-storage-update', handleStorage);

        load();
        const interval = setInterval(load, 2000);
        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('local-storage-update', handleStorage);
        };
    }, []);

    // Atualiza projeção se settings mudarem
    useEffect(() => {
        if (activeSlideIndex >= 0) syncToApi(activeSlideIndex);
    }, [previewSettings]);

    return (
        <div className="flex flex-col h-screen bg-[#111] text-white font-sans select-none">
            <Head><title>Projeção de Louvor</title></Head>

            {/* HEADER PROFISSIONAL */}
            <div className="h-14 bg-[#1e1e1e] flex items-center justify-between px-4 border-b border-[#333] shrink-0 shadow-md">
                <div className="flex flex-col">
                    <div className="font-bold text-lg leading-tight text-gray-100 uppercase tracking-wide">
                        Projeção Louvor <span className="text-[10px] text-blue-400 font-normal align-top ml-1 opacity-80">(BETA)</span>
                    </div>
                    <span className="opacity-40 text-[10px] font-mono select-none">v0.3.54</span>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => window.location.href = '/'} className="text-gray-400 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition border border-transparent hover:border-[#444] bg-[#2d2d2d]">
                        Voltar
                    </button>
                    <div className="w-px h-6 bg-[#333] self-center"></div>
                    <button onClick={() => setIsEditorOpen(true)} className="flex items-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] px-3 py-1.5 rounded text-xs font-bold text-gray-200 transition border border-[#444]">
                        <span>Editar Tema</span>
                    </button>
                    <button onClick={() => window.open('/projection-music', '_blank', 'width=1920,height=1080')} className="bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded text-xs font-bold text-white shadow transition flex items-center gap-1">
                        <span>Abrir Projetor</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* COLUNA 1: BUSCA E RESULTADOS */}
                <div className="w-[350px] bg-[#1a1a1a] border-r border-[#333] flex flex-col shrink-0 transition-all z-10">
                    {/* ABAS */}
                    <div className="flex bg-[#161616]">
                        <button
                            onClick={() => setTab('online')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition ${tab === 'online' ? 'bg-[#222] text-white border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e1e]'}`}
                        >
                            Online
                        </button>
                        <button
                            onClick={() => setTab('local')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition ${tab === 'local' ? 'bg-[#222] text-white border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e1e]'}`}
                        >
                            Salvas
                        </button>
                    </div>

                    <div className="p-4 flex flex-col gap-4 h-full overflow-hidden">
                        {tab === 'online' ? (
                            <>
                                <div className="flex gap-2">
                                    <input
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500 placeholder-gray-600 transition"
                                        placeholder="Buscar no Vagalume..."
                                    />
                                    <button onClick={handleSearch} className="bg-blue-700 hover:bg-blue-600 px-3 rounded text-white transition">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                    {results.map(res => (
                                        <div
                                            key={res.id}
                                            onClick={() => handleSelectMusic(res)}
                                            className={`p-3 rounded cursor-pointer border transition group ${selectedMusic?.id === res.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-[#222] border-transparent hover:bg-[#2a2a2a] hover:border-gray-700'}`}
                                        >
                                            <div className="font-bold text-sm text-gray-200 group-hover:text-white">{res.title}</div>
                                            <div className="text-xs text-gray-500 group-hover:text-gray-400">{res.artist}</div>
                                        </div>
                                    ))}
                                    {results.length === 0 && <div className="text-gray-600 text-center text-xs mt-10">Use a busca para encontrar letras...</div>}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* LISTA LOCAL */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{mySongs.length} SALVAS</span>
                                    <button onClick={() => { setSelectedMusic({ id: 'new', title: 'Nova Música', artist: '', text: '\n\n', isLocal: true } as any); setFullLyrics('\n\n'); setSlides([]); }} className="text-xs bg-green-700/80 hover:bg-green-600 text-white px-3 py-1 rounded transition border border-green-600/50">+ Nova</button>
                                </div>

                                <input
                                    className="bg-[#111] border border-[#333] rounded px-3 py-1.5 text-xs text-white w-full mb-2 outline-none focus:border-blue-500"
                                    placeholder="Filtrar..."
                                />

                                <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                    {mySongs.map(res => (
                                        <div
                                            key={res.id}
                                            onClick={() => {
                                                setSelectedMusic(res);
                                                setFullLyrics((res as any).text);
                                                setSlides([]);
                                            }}
                                            className={`p-3 rounded cursor-pointer border transition relative group ${selectedMusic?.id === res.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-[#222] border-transparent hover:bg-[#2a2a2a] hover:border-gray-700'}`}
                                        >
                                            <div className="font-bold text-sm text-gray-200 group-hover:text-white truncate pr-6">{res.title}</div>
                                            <div className="text-xs text-gray-500 group-hover:text-gray-400">{res.artist}</div>

                                            <button
                                                onClick={(e) => deleteMusic(res.id, e)}
                                                className="absolute right-2 top-2.5 text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-400 transition bg-[#222] p-1 rounded hover:bg-[#333]"
                                                title="Excluir"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                    {mySongs.length === 0 && <div className="text-gray-600 text-center text-xs mt-10">Nenhuma música salva.</div>}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* COLUNA 2: LISTA DE SLIDES (LETRA) */}
                <div className="flex-1 bg-[#0f0f0f] flex flex-col overflow-hidden relative">
                    {/* Toolbar de Conteúdo */}
                    <div className="h-12 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-4 shadow-sm shrink-0 z-20">
                        {isEditingText ? (
                            <div className="flex gap-2 w-full pr-4 items-center">
                                <input
                                    value={selectedMusic?.title || ''}
                                    onChange={e => setSelectedMusic(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                                    className="bg-[#2d2d2d] border border-[#444] text-white px-2 py-1 rounded text-sm font-bold flex-1 outline-none focus:border-blue-500"
                                    placeholder="Título da Música"
                                />
                                <input
                                    value={selectedMusic?.artist || ''}
                                    onChange={e => setSelectedMusic(prev => prev ? ({ ...prev, artist: e.target.value }) : null)}
                                    className="bg-[#2d2d2d] border border-[#444] text-gray-300 px-2 py-1 rounded text-xs w-1/3 outline-none focus:border-blue-500"
                                    placeholder="Nome do Artista"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col justify-center overflow-hidden">
                                <span className="font-bold text-gray-200 truncate text-sm">
                                    {selectedMusic ? selectedMusic.title : 'Selecione uma música...'}
                                </span>
                                {selectedMusic && <span className="text-[10px] text-gray-500 truncate">{selectedMusic.artist}</span>}
                            </div>
                        )}

                        {/* CONTROLES */}
                        <div className="flex items-center gap-3">
                            {selectedMusic && (
                                <>
                                    <button
                                        onClick={() => setIsEditingText(!isEditingText)}
                                        className={`px-3 py-1 rounded text-xs font-bold border transition ${isEditingText ? 'bg-green-700/20 text-green-400 border-green-800 hover:bg-green-700/30' : 'bg-[#2d2d2d] border-[#444] text-gray-400 hover:text-white hover:border-gray-500'}`}
                                    >
                                        {isEditingText ? 'OK' : 'Editar Texto'}
                                    </button>
                                    <button onClick={saveCurrentMusic} className="bg-blue-700/80 hover:bg-blue-600 px-3 py-1 rounded text-xs font-bold text-white shadow transition border border-blue-600/50">Salvar</button>
                                </>
                            )}
                            <div className="w-px h-6 bg-[#333]"></div>

                            {!isEditingText && (<>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Linhas:</span>
                                    <select
                                        value={linesPerSlide}
                                        onChange={(e) => setLinesPerSlide(Number(e.target.value))}
                                        className="bg-[#2d2d2d] border border-[#444] text-white text-[10px] rounded px-2 py-1 outline-none hover:bg-[#333] w-20"
                                    >
                                        <option value={2}>2 Linhas</option>
                                        <option value={3}>3 Linhas</option>
                                        <option value={4}>4 Linhas</option>
                                        <option value={99}>Auto</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Anim:</span>
                                    <select
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setPreviewSettings((prev: any) => {
                                                const novo = { ...(prev || {}), animation: val };
                                                localStorage.setItem('music_settings', JSON.stringify(novo));
                                                return novo;
                                            });
                                        }}
                                        value={previewSettings?.animation || ''}
                                        className="bg-[#2d2d2d] border border-[#444] text-white text-[10px] rounded px-2 py-1 outline-none hover:bg-[#333] w-24"
                                    >
                                        <option value="">Nenhuma</option>
                                        <option value="typewriter">Typewriter</option>
                                        <option value="fade">Fade</option>
                                        <option value="zoom">Zoom</option>
                                        <option value="slide">Slide</option>
                                    </select>
                                </div>
                            </>)}
                        </div>
                    </div>

                    {isEditingText ? (
                        <div className="flex-1 p-4 bg-[#0f0f0f]">
                            <textarea
                                value={fullLyrics}
                                onChange={e => setFullLyrics(e.target.value)}
                                className="w-full h-full bg-[#161616] text-gray-300 p-6 font-mono text-sm border border-[#333] outline-none resize-none focus:border-blue-900/50 rounded-lg shadow-inner leading-relaxed"
                                placeholder="Cole a letra da música aqui... Separe estrofes com uma linha em branco."
                            />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6 content-start grid gap-4 lg:grid-cols-2 xl:grid-cols-3 auto-rows-max custom-scrollbar">
                            {slides.map((slide, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => projectSlide(idx)}
                                    className={`
                                        min-h-[140px] p-6 rounded-lg cursor-pointer border transition relative group
                                        flex items-center justify-center text-center shadow-sm select-none
                                        ${activeSlideIndex === idx
                                            ? 'bg-blue-900/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] transform scale-[1.01]'
                                            : 'bg-[#1e1e1e] border-[#333] hover:border-[#555] hover:bg-[#252525]'}
                                    `}
                                >
                                    <span className={`absolute top-2 left-3 text-[10px] font-bold ${activeSlideIndex === idx ? 'text-blue-400' : 'text-gray-600'}`}>SLIDE {idx + 1}</span>
                                    <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-gray-200 pointer-events-none opacity-90">
                                        {slide}
                                    </p>
                                </div>
                            ))}
                            {slides.length === 0 && selectedMusic && <div className="col-span-3 text-center text-gray-600 mt-20 text-sm">Nenhuma letra gerada. <br />Use o botão "Editar Texto" para colar a letra.</div>}
                        </div>
                    )}

                    {/* BARRA DE CONTROLE RÁPIDO */}
                    {!isEditingText && slides.length > 0 && (
                        <div className="h-16 bg-[#1a1a1a] border-t border-[#333] flex items-center justify-center gap-6 shrink-0 z-20">
                            <button onClick={() => projectSlide(Math.max(0, activeSlideIndex - 1))} className="bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 px-6 py-2 rounded font-bold text-sm border border-[#444] transition flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                Anterior
                            </button>

                            <button onClick={() => syncToApi(-1)} className="bg-black hover:bg-gray-900 text-red-500 border border-red-900/30 px-6 py-2 rounded font-bold text-xs uppercase tracking-widest transition shadow-lg hover:shadow-red-900/10 flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                Blackout
                            </button>

                            <button onClick={() => projectSlide(Math.min(slides.length - 1, activeSlideIndex + 1))} className="bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200 px-6 py-2 rounded font-bold text-sm border border-[#444] transition flex items-center gap-2">
                                Próximo
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isEditorOpen && (
                <BibleProjection
                    verseText={activeSlideIndex >= 0 ? slides[activeSlideIndex] : 'Exemplo de Música\nQuebra de Linha'}
                    reference={selectedMusic?.title || 'TÍTULO DA MÚSICA'}
                    onClose={() => setIsEditorOpen(false)}
                    storageKey="music_settings"
                />
            )}
        </div>
    );
}
