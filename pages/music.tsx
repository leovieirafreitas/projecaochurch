
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { VagalumeClient, MusicSearchResult } from '../lib/vagalume-client';
import type { MusicSearchResult as MusicType } from '../lib/vagalume-client';
import BibleProjection from '../components/BibleProjection'; // Reutiliza o editor
import { supabase } from '../lib/supabaseClient';

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
    const lastBroadcastStyleRef = useRef<string>('');

    // --- LOGICA SUPABASE ---
    const [tab, setTab] = useState<'online' | 'local'>('online');
    const [isEditingText, setIsEditingText] = useState(false);
    const [mySongs, setMySongs] = useState<MusicType[]>([]);

    const loadLocalSongs = async () => {
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
            const { error } = await supabase
                .from('songs')
                .update(songData)
                .eq('id', currentId);

            if (error) alert('Erro ao atualizar: ' + error.message);
            else alert('Música atualizada!');
        } else {
            // INSERT
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

    // Sincronização (Cópia da lógica do BibleSearch)
    const syncToApi = (index: number) => {
        const text = index >= 0 ? slides[index] : '';
        const ref = selectedMusic ? `${selectedMusic.title.toUpperCase()}` : ''; // Apenas Título, ou Título - Artista

        // Fallback style se não tiver settings carregadas
        const style = previewSettings || {};

        const payload = {
            verseText: text,
            reference: ref, // Vamos usar o campo de referência para o Título da Música
            slideIndex: 0, // Música geralmente não pagina o slide individualmente (o slide já é a página)
            version: 'MUSIC',
            style: style
        };

        // 1. BROADCAST OTIMIZADO
        try {
            const currentStyleStr = JSON.stringify(style);
            const styleChanged = currentStyleStr !== lastBroadcastStyleRef.current;

            const broadcastPayload = {
                ...payload,
                style: styleChanged ? style : undefined
            };

            const bc = new BroadcastChannel('music_channel');
            bc.postMessage(broadcastPayload);
            bc.close();

            if (styleChanged) lastBroadcastStyleRef.current = currentStyleStr;
        } catch (e) { console.error(e); }

        // 2. API FALLBACK
        fetch('/api/status-music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => console.error(err));
    };

    // Carregar configurações salvas
    useEffect(() => {
        const load = () => {
            const saved = localStorage.getItem('music_settings');
            if (saved) setPreviewSettings(JSON.parse(saved));
        };
        load();
        const interval = setInterval(load, 2000);
        return () => clearInterval(interval);
    }, []);

    // Atualiza projeção se settings mudarem
    useEffect(() => {
        if (activeSlideIndex >= 0) syncToApi(activeSlideIndex);
    }, [previewSettings]);

    return (
        <div className="flex flex-col h-screen bg-[#111] text-white">
            <Head><title>Projeção de Música</title></Head>

            {/* HEADER */}
            <div className="h-14 bg-purple-900 flex items-center justify-between px-4 border-b border-purple-700 shrink-0">
                <div className="font-bold text-lg flex items-center gap-2">
                    PROJEÇÃO DE LOUVOR
                </div>
                <div className="flex gap-2">
                    <button onClick={() => window.location.href = '/'} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm font-bold">Voltar para Bíblia</button>
                    <button onClick={() => setIsEditorOpen(true)} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm font-bold">🎨 Editar Tema</button>
                    <button onClick={() => window.open('/projection-music', '_blank', 'width=1920,height=1080')} className="bg-orange-600 hover:bg-orange-500 px-3 py-1 rounded text-sm font-bold">📺 Abrir Projetor Música</button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* COLUNA 1: BUSCA E RESULTADOS */}
                <div className="w-[350px] bg-[#222] border-r border-[#333] flex flex-col shrink-0 transition-all">
                    {/* ABAS */}
                    <div className="flex bg-[#111]">
                        <button
                            onClick={() => setTab('online')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 ${tab === 'online' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            🌐 Online
                        </button>
                        <button
                            onClick={() => setTab('local')}
                            className={`flex-1 py-3 text-sm font-bold border-b-2 ${tab === 'local' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            💾 Salvas
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
                                        className="flex-1 bg-[#111] border border-[#444] rounded px-3 py-2 text-white outline-none focus:border-purple-500"
                                        placeholder="Buscar no Vagalume/Lyrics..."
                                    />
                                    <button onClick={handleSearch} className="bg-purple-600 hover:bg-purple-500 px-3 rounded">🔍</button>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pb-2">
                                    {results.map(res => (
                                        <div
                                            key={res.id}
                                            onClick={() => handleSelectMusic(res)}
                                            className={`p-3 rounded cursor-pointer border border-transparent hover:border-purple-500 transition ${selectedMusic?.id === res.id ? 'bg-purple-900/40 border-purple-500' : 'bg-[#1a1a1a]'}`}
                                        >
                                            <div className="font-bold text-sm text-white">{res.title}</div>
                                            <div className="text-xs text-gray-400">{res.artist}</div>
                                        </div>
                                    ))}
                                    {results.length === 0 && <div className="text-gray-500 text-center text-sm mt-10">Busque para baixar letras...</div>}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* LISTA LOCAL */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-400">{mySongs.length} músicas</span>
                                    <button onClick={() => { setSelectedMusic({ id: 'new', title: 'Nova Música', artist: '', text: '\n\n', isLocal: true } as any); setFullLyrics('\n\n'); setSlides([]); }} className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded">+ Nova</button>
                                </div>

                                <input
                                    className="bg-[#111] border border-[#444] rounded px-2 py-1 text-sm text-white w-full"
                                    placeholder="Filtrar salvas..."
                                    onChange={(e) => {
                                        // Filtro client-side simples visual? Ou recarregar?
                                        // Vamos fazer filtro visual simples aqui ou deixar pro usuario
                                    }}
                                />

                                <div className="flex-1 overflow-y-auto space-y-2 pb-2">
                                    {mySongs.map(res => (
                                        <div
                                            key={res.id}
                                            onClick={() => {
                                                setSelectedMusic(res);
                                                setFullLyrics((res as any).text); // Já tem texto
                                                setSlides([]);
                                                // Trigger process
                                            }}
                                            className={`p-3 rounded cursor-pointer border border-transparent hover:border-purple-500 transition relative group ${selectedMusic?.id === res.id ? 'bg-purple-900/40 border-purple-500' : 'bg-[#1a1a1a]'}`}
                                        >
                                            <div className="font-bold text-sm text-white">{res.title}</div>
                                            <div className="text-xs text-gray-400">{res.artist}</div>

                                            <button
                                                onClick={(e) => deleteMusic(res.id, e)}
                                                className="absolute right-2 top-2 text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
                                                title="Excluir"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                    {mySongs.length === 0 && <div className="text-gray-500 text-center text-sm mt-10">Nenhuma música salva.</div>}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* COLUNA 2: LISTA DE SLIDES (LETRA) */}
                <div className="flex-1 bg-[#1a1a1a] flex flex-col overflow-hidden">
                    <div className="h-12 bg-[#222] border-b border-black flex items-center justify-between px-4 shadow shrink-0">
                        {isEditingText ? (
                            <div className="flex gap-2 w-full pr-4">
                                <input
                                    value={selectedMusic?.title || ''}
                                    onChange={e => setSelectedMusic(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                                    className="bg-[#333] text-white px-2 py-1 rounded text-sm font-bold flex-1"
                                    placeholder="Título"
                                />
                                <input
                                    value={selectedMusic?.artist || ''}
                                    onChange={e => setSelectedMusic(prev => prev ? ({ ...prev, artist: e.target.value }) : null)}
                                    className="bg-[#333] text-gray-300 px-2 py-1 rounded text-xs w-1/3"
                                    placeholder="Artista"
                                />
                            </div>
                        ) : (
                            <span className="font-bold text-gray-300 truncate max-w-[50%]">
                                {selectedMusic ? `${selectedMusic.title} - ${selectedMusic.artist}` : 'Nenhuma música selecionada'}
                            </span>
                        )}

                        {/* CONTROLES */}
                        <div className="flex items-center gap-2">
                            {selectedMusic && (
                                <>
                                    <button
                                        onClick={() => setIsEditingText(!isEditingText)}
                                        className={`px-2 py-1 rounded text-xs font-bold border ${isEditingText ? 'bg-yellow-600 border-yellow-500 text-black' : 'bg-transparent border-gray-600 text-gray-400 hover:text-white'}`}
                                    >
                                        {isEditingText ? '✅ Pronto' : '✏️ Editar'}
                                    </button>
                                    <button onClick={saveCurrentMusic} className="bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded text-xs font-bold text-white shadow">💾 Salvar</button>
                                </>
                            )}

                            {!isEditingText && (<>
                                <select
                                    value={linesPerSlide}
                                    onChange={(e) => setLinesPerSlide(Number(e.target.value))}
                                    className="bg-[#111] border border-gray-600 text-white text-xs rounded px-2 py-1 outline-none focus:border-purple-500 w-24"
                                >
                                    <option value={2}>2 Linhas</option>
                                    <option value={3}>3 Linhas</option>
                                    <option value={4}>4 Linhas</option>
                                    <option value={99}>Auto</option>
                                </select>

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
                                    className="bg-[#111] border border-gray-600 text-white text-xs rounded px-2 py-1 outline-none focus:border-purple-500 w-32"
                                >
                                    <option value="">Sem Animação</option>
                                    <option value="typewriter">Escrevendo</option>
                                    <option value="fade">Fade Suave</option>
                                    <option value="zoom">Dump (Show)</option>
                                    <option value="slide">Slide Up</option>
                                </select>
                            </>)}
                        </div>
                    </div>

                    {isEditingText ? (
                        <div className="flex-1 p-4 bg-[#111]">
                            <textarea
                                value={fullLyrics}
                                onChange={e => setFullLyrics(e.target.value)}
                                className="w-full h-full bg-[#1a1a1a] text-gray-200 p-4 font-mono text-sm border border-[#333] outline-none resize-none focus:border-yellow-600 rounded"
                                placeholder="Cole a letra da música aqui... Separe estrofes com uma linha em branco."
                            />
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 content-start grid gap-4 lg:grid-cols-2 xl:grid-cols-3 auto-rows-max">
                            {slides.map((slide, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => projectSlide(idx)}
                                    className={`
                                        min-h-[120px] p-4 rounded-lg cursor-pointer border-2 transition relative group
                                        flex items-center justify-center text-center
                                        ${activeSlideIndex === idx ? 'bg-purple-900/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-[#222] border-[#333] hover:border-gray-500'}
                                    `}
                                >
                                    <span className="absolute top-2 left-2 text-[10px] font-bold text-gray-600 group-hover:text-gray-400">#{idx + 1}</span>
                                    <p className="whitespace-pre-wrap text-lg font-medium leading-relaxed text-gray-200 pointer-events-none select-none">
                                        {slide}
                                    </p>
                                </div>
                            ))}
                            {slides.length === 0 && selectedMusic && <div className="col-span-3 text-center text-gray-500">Nenhuma letra para exibir. Clique em Editar para adicionar.</div>}
                        </div>
                    )}

                    {/* BARRA DE CONTROLE RÁPIDO */}
                    {!isEditingText && slides.length > 0 && (
                        <div className="h-16 bg-[#111] border-t border-[#333] flex items-center justify-center gap-4 shrink-0">
                            <button onClick={() => projectSlide(Math.max(0, activeSlideIndex - 1))} className="bg-[#333] hover:bg-[#444] px-6 py-2 rounded font-bold text-xl">◀ Anterior</button>
                            <button onClick={() => syncToApi(-1)} className="bg-red-900/50 hover:bg-red-800 px-4 py-2 rounded font-bold text-red-200">⬛ Black</button>
                            <button onClick={() => projectSlide(Math.min(slides.length - 1, activeSlideIndex + 1))} className="bg-[#333] hover:bg-[#444] px-6 py-2 rounded font-bold text-xl">Próximo ▶</button>
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
