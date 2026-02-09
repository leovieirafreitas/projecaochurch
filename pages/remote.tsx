import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useProjectionSync } from '../hooks/useProjectionSync';
import { YouVersionClient } from '../lib/youversion-client';
import { splitTextIdeally } from '../lib/text-utils';
import { BOOK_GROUPS, BIBLE_BOOKS_DATA, cleanText, NT_ONLY_VERSIONS, OLD_TESTAMENT_BOOKS, VERSION_FULL_NAMES } from '../lib/bible-data';

export default function RemotePage() {
    // STATE
    const [view, setView] = useState<'books' | 'chapters' | 'verses'>('books');
    const [selectedBookId, setSelectedBookId] = useState('GEN');
    const [selectedChapterId, setSelectedChapterId] = useState('GEN.1');

    // DATA
    const [chapterList, setChapterList] = useState<any[]>([]);
    const [verses, setVerses] = useState<{ num: number, text: string }[]>([]);

    // VERSIONS
    const [versions, setVersions] = useState<any[]>([]);
    const [currentVersion, setCurrentVersion] = useState('129'); // NVI Default
    const [downloadedVersions, setDownloadedVersions] = useState<string[]>([]);

    // SYNC
    const [currentStyle, setCurrentStyle] = useState<any>(null);
    const [isProjecting, setIsProjecting] = useState(false);
    const [isBackendAvailable, setIsBackendAvailable] = useState(true);

    // SLIDES / PAGINATION
    const [slideParts, setSlideParts] = useState<string[]>([]);
    const [currentPartIndex, setCurrentPartIndex] = useState(0);

    const { sendState, status } = useProjectionSync('receiver', (state: any) => {
        if (state) {
            // ANTI-ECO: Se o update veio de mim mesmo, ignora
            const mySenderId = (window as any).senderId;
            if (mySenderId && state.senderId === mySenderId) {
                return;
            }

            if (state.style) setCurrentStyle(state.style);
            // Se recebermos um estado com texto, assumimos que está projetando
            if (state.verseText) setIsProjecting(true);
            else if (state.verseText === '') setIsProjecting(false);
        }
    }, false); // V74: Força LOCAL-ONLY para o Mobile Remote (Zero Egress)

    const [activeVerse, setActiveVerse] = useState<{ num: number, text: string } | null>(null);

    // Initial Load
    useEffect(() => {
        loadVersions();

        // Check Backend Status & Downloaded Versions
        fetch('/api/status')
            .then(r => {
                if (r.ok) {
                    setIsBackendAvailable(true);
                    return r.json();
                }
                throw new Error('Backend Offline');
            })
            .then(data => {
                if (data && data.style) setCurrentStyle(data.style);
                if (data && data.verseText) {
                    setIsProjecting(true);
                }
            })
            .catch(() => setIsBackendAvailable(false));

        // Fetch Offline Versions form Desktop
        fetch('/api/offline/versions')
            .then(r => r.json())
            .then((data: any[]) => {
                setDownloadedVersions(data.map(d => d.id));
            })
            .catch(err => console.error("Failed to fetch offline versions", err));

    }, []);

    // Continuous Backend Status Check (Every 2 seconds)
    useEffect(() => {
        const checkBackend = () => {
            fetch('/api/status', { method: 'HEAD' })
                .then(r => {
                    if (r.ok) setIsBackendAvailable(true);
                    else setIsBackendAvailable(false);
                })
                .catch(() => setIsBackendAvailable(false));
        };

        const interval = setInterval(checkBackend, 2000);
        return () => clearInterval(interval);
    }, []);

    // Load Chapters when Book changes
    const handleBookSelect = async (bookId: string) => {
        setSelectedBookId(bookId);
        // Load chapters immediately
        const chaps = await YouVersionClient.getChapters(currentVersion, bookId);
        if (chaps) {
            setChapterList(chaps);
            setView('chapters');
        }
    };

    // Load Verses when Chapter changes
    const handleChapterSelect = async (chapId: string) => {
        setSelectedChapterId(chapId);
        // Load text
        loadChapterText(selectedBookId, chapId);
        setView('verses');
    };

    const loadVersions = async () => {
        try {
            const data = await YouVersionClient.getVersions();
            setVersions(data.filter(v => v.abbreviation !== 'BLT'));
            const saved = localStorage.getItem('bible_version');
            if (saved) setCurrentVersion(saved);
        } catch (e) {
            console.error(e);
        }
    };

    const loadChapterText = async (bookId: string, chapId: string) => {
        setVerses([]);
        try {
            const result = await YouVersionClient.getPassage(currentVersion, chapId);
            if (result && (result.content || result.data?.content)) {
                const html = result.content || result.data.content;
                parseAndSetVerses(html);
            }
        } catch (e) { console.error(e); }
    };

    const parseAndSetVerses = (html: string) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        tempDiv.querySelectorAll('.note, .chapter-number, .audio-player, .s1, h1, h2, .r').forEach(n => n.remove());

        const versesFound: { num: number, text: string }[] = [];
        let cleanHtml = html
            .replace(/<span[^>]*class="[^"]*(?:label|v|verse-number|versenum)[^"]*"[^>]*>([\d]+)<\/span>/gi, '___V$1___')
            .replace(/<span[^>]*class="[^"]*yv-v[^"]*"[^>]*v="(\d+)"[^>]*>/gi, '___V$1___')
            .replace(/data-usfm="[^"]+\.[^"]+\.(\d+)"/gi, 'data-v="$1"');

        let txt = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const parts = txt.split('___V');

        parts.forEach((part: string) => {
            const match = part.match(/^(\d+)___(.*)/);
            if (match) {
                const num = parseInt(match[1]);
                let text = match[2].trim().replace(/^[\d]+\s+/, '').replace(/Copyright.*/gi, '').trim();
                if (num > 0 && text) versesFound.push({ num, text });
            } else {
                const rawMatch = part.match(/^(\d+)\s+(.*)/);
                if (rawMatch) versesFound.push({ num: parseInt(rawMatch[1]), text: rawMatch[2].trim() });
            }
        });

        if (versesFound.length < 2) {
            const pureText = tempDiv.textContent || '';
            const matches = pureText.matchAll(/(\d+)\s+([^0-9]+)(?=\d+\s|$)/g);
            for (const match of matches) {
                versesFound.push({ num: parseInt(match[1]), text: cleanText(match[2]) });
            }
        }

        versesFound.sort((a, b) => a.num - b.num);
        const unique = versesFound.filter((v, i, a) => a.findIndex(t => t.num === v.num) === i);
        setVerses(unique);
    };

    // Helper centralizado para enviar projeção
    const sendProjection = async (text: string, ref: string, index: number) => {
        // Ganhando robustez: Se não tivermos estilo local, buscamos do servidor antes de enviar
        let styleToUse = currentStyle;
        if (!styleToUse || Object.keys(styleToUse).length === 0) {
            try {
                const r = await fetch('/api/status');
                if (r.ok) {
                    const data = await r.json();
                    if (data && data.style) {
                        styleToUse = data.style;
                        setCurrentStyle(data.style);
                    }
                }
            } catch (e) { console.error('Error fetching style before project:', e); }
        }

        // CRITICAL: SEMPRE incrementa bgVersion para resetar GIF
        // Isso garante reset mesmo ao navegar entre partes do mesmo versículo
        const newBgVersion = (styleToUse?.bgVersion || 0) + 1;
        styleToUse = { ...styleToUse, bgVersion: newBgVersion };

        // VITAL: Atualiza o estado local para que o próximo incremento seja (N+1) e não (N) novamente
        setCurrentStyle(styleToUse);

        console.log('[Mobile] Incrementando bgVersion:', newBgVersion, 'para ref:', ref);

        // Gera SenderID se não existir
        if (!(window as any).senderId) {
            (window as any).senderId = 'mobile-' + Math.random().toString(36).substring(2);
        }

        sendState({
            verseText: text,
            reference: ref,
            slideIndex: index,
            version: currentVersion,
            style: styleToUse || {},
            timestamp: Date.now(),
            senderId: (window as any).senderId,
            source: 'mobile',
            master: 'mobile' // CRITICAL: Permite que mobile assuma controle e bgVersion seja processado
        });
    }

    const handleProject = async (verse: { num: number, text: string }) => {
        setActiveVerse(verse);
        setIsProjecting(true);

        // 1. Dividir em partes
        const parts = splitTextIdeally(verse.text, 180);
        setSlideParts(parts);
        setCurrentPartIndex(0);

        // 2. Preparar referência
        const bookName = BIBLE_BOOKS_DATA[selectedBookId]?.name || selectedBookId;
        const chapNum = selectedChapterId.split('.')[1] || selectedChapterId;
        const ref = `${bookName} ${chapNum}:${verse.num}`;

        // 3. Enviar parte 0
        if (parts.length > 0) {
            await sendProjection(parts[0], ref, 0);
        }
    };

    const nextPart = () => {
        if (currentPartIndex < slideParts.length - 1 && activeVerse) {
            const nextIdx = currentPartIndex + 1;
            setCurrentPartIndex(nextIdx);

            const bookName = BIBLE_BOOKS_DATA[selectedBookId]?.name || selectedBookId;
            const chapNum = selectedChapterId.split('.')[1] || selectedChapterId;
            const ref = `${bookName} ${chapNum}:${activeVerse.num}`;

            sendProjection(slideParts[nextIdx], ref, nextIdx);
        }
    };

    const prevPart = () => {
        if (currentPartIndex > 0 && activeVerse) {
            const prevIdx = currentPartIndex - 1;
            setCurrentPartIndex(prevIdx);

            const bookName = BIBLE_BOOKS_DATA[selectedBookId]?.name || selectedBookId;
            const chapNum = selectedChapterId.split('.')[1] || selectedChapterId;
            const ref = `${bookName} ${chapNum}:${activeVerse.num}`;

            sendProjection(slideParts[prevIdx], ref, prevIdx);
        }
    };

    const handleToggleProjection = async () => {
        if (isProjecting) {
            // STOP
            setIsProjecting(false);

            let styleToUse = currentStyle;
            if (!styleToUse) {
                try {
                    const r = await fetch('/api/status');
                    if (r.ok) {
                        const data = await r.json();
                        if (data && data.style) styleToUse = data.style;
                    }
                } catch (e) { }
            }

            sendState({
                verseText: '',
                reference: '',
                slideIndex: 0,
                style: styleToUse || {},
                timestamp: Date.now(),
                master: 'mobile',
                source: 'mobile'
            });
        } else {
            // RESUME
            if (activeVerse && slideParts.length > 0) {
                setIsProjecting(true);
                const bookName = BIBLE_BOOKS_DATA[selectedBookId]?.name || selectedBookId;
                const chapNum = selectedChapterId.split('.')[1] || selectedChapterId;
                const ref = `${bookName} ${chapNum}:${activeVerse.num}`;

                await sendProjection(slideParts[currentPartIndex], ref, currentPartIndex);
            } else {
                alert("Selecione um versículo para projetar.");
            }
        }
    };

    const renderHeader = () => (
        <div className="bg-[#1a1a1a] p-3 border-b border-[#333] sticky top-0 z-50 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 overflow-hidden">
                {view !== 'books' && (
                    <button onClick={() => setView('books')} className="p-2 bg-[#333] rounded text-white active:scale-95 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                )}
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                        {view === 'books' ? 'PROJECTION CHURCH' : view === 'chapters' ? 'Selecione o Capítulo' : 'Selecione o Versículo'}
                    </span>
                    <span className="text-sm font-bold truncate text-white leading-tight mt-0.5">
                        {view === 'books' && 'Bíblia Sagrada'}
                        {view === 'chapters' && BIBLE_BOOKS_DATA[selectedBookId]?.name}
                        {view === 'verses' && `${BIBLE_BOOKS_DATA[selectedBookId]?.name} ${selectedChapterId.split('.')[1] || ''}`}
                    </span>
                </div>
            </div>

            <select
                className="bg-[#333] text-white text-[10px] font-bold p-2 rounded max-w-[150px] uppercase border border-[#444] outline-none truncate"
                value={currentVersion}
                onChange={e => { setCurrentVersion(e.target.value); localStorage.setItem('bible_version', e.target.value); }}
            >
                <optgroup label="Minhas Bíblias (Offline & Online)">
                    {versions
                        .filter((v, i, a) => a.findIndex(t => String(t.id) === String(v.id)) === i)
                        .map(v => {
                            let abbr = v.abbreviation.toUpperCase();
                            if (v.id === 'PORARA') abbr = 'ARA (NT)';
                            let fullName = VERSION_FULL_NAMES[v.abbreviation.toUpperCase()] || VERSION_FULL_NAMES[v.id] || v.local_title || v.name || abbr;

                            // Fix overrides
                            if (v.id === 'PORARA') fullName = 'Almeida Revista e Atualizada (Novo Testamento)';
                            if (v.id === 'PORARC') fullName = 'Almeida Revista e Corrigida (Novo Testamento)';

                            const isDownloaded = downloadedVersions.includes(String(v.id));
                            const label = isDownloaded ? `${fullName} (BAIXADA)` : fullName;

                            return <option key={v.id} value={v.id}>{label}</option>;
                        })}
                </optgroup>
            </select>
        </div>
    );

    const renderBooks = () => (
        <div className="p-2 pb-32">
            <div className="grid grid-cols-4 gap-1">
                {BOOK_GROUPS.map(group => {
                    const isNtOnly = NT_ONLY_VERSIONS.includes(currentVersion);
                    const filteredBooks = group.books.filter(b => !isNtOnly || !OLD_TESTAMENT_BOOKS.has(b));
                    if (filteredBooks.length === 0) return null;

                    return filteredBooks.map(bookId => (
                        <button
                            key={bookId}
                            onClick={() => handleBookSelect(bookId)}
                            className={`aspect-[4/3] rounded-sm flex flex-col items-center justify-center active:brightness-75 transition text-white shadow-sm ${group.color} ${selectedBookId === bookId ? 'ring-2 ring-white z-10' : ''}`}
                        >
                            <span className="text-sm font-black uppercase leading-none mb-0.5">{BIBLE_BOOKS_DATA[bookId]?.abbr || bookId}</span>
                            <span className="text-[7px] uppercase font-bold opacity-80 leading-none truncate w-full text-center px-0.5">{BIBLE_BOOKS_DATA[bookId]?.name}</span>
                        </button>
                    ));
                })}
            </div>
        </div>
    );

    const renderChapters = () => (
        <div className="p-2 pb-32">
            <div className="grid grid-cols-5 gap-3">
                {chapterList.map((c, i) => (
                    <button
                        key={c.id || i}
                        onClick={() => handleChapterSelect(c.passage_id || c.id)}
                        className="aspect-square rounded bg-[#222] border border-[#333] flex items-center justify-center text-lg font-bold text-gray-200 active:bg-amber-600 active:border-amber-500 active:text-white transition"
                    >
                        {c.human || c.number || i + 1}
                    </button>
                ))}
            </div>
        </div>
    );

    const renderVerses = () => (
        <div className="p-2 pb-32">
            {/* BOTÃO VOLTAR CAPÍTULOS DENTRO DA LISTA */}
            <button
                onClick={() => setView('chapters')}
                className="w-full py-3 mb-4 bg-[#222] border border-[#333] rounded text-xs font-bold uppercase text-gray-400 flex items-center justify-center gap-2 active:bg-[#333]"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Voltar para Capítulos
            </button>

            <div className="grid grid-cols-5 gap-3">
                {verses.map(v => (
                    <button
                        key={v.num}
                        onClick={() => handleProject(v)}
                        className={`aspect-square rounded border flex items-center justify-center text-lg font-bold transition shadow-sm
                            ${activeVerse?.num === v.num
                                ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105 z-10'
                                : 'bg-[#222] border-[#333] text-gray-300 active:bg-[#444]'
                            }
                        `}
                    >
                        {v.num}
                    </button>
                ))}
            </div>
            {verses.length === 0 && <div className="text-center text-gray-500 mt-10">Carregando versículos...</div>}
        </div>
    );


    return (
        <div className="min-h-screen bg-black text-white flex flex-col font-sans select-none">
            <Head><title>Projection Church</title></Head>

            {renderHeader()}

            <div className="flex-1 overflow-y-auto">
                {view === 'books' && renderBooks()}
                {view === 'chapters' && renderChapters()}
                {view === 'verses' && renderVerses()}
            </div>

            {/* Footer: Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#333] p-4 flex flex-col gap-3 z-50 pb-8 sm:pb-4 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">

                {/* --- PAGINATION CONTROLS (Only if multiple parts) --- */}
                {slideParts.length > 1 && isProjecting && (
                    <div className="flex items-center justify-between gap-2 bg-[#222] p-2 rounded-lg border border-[#333] animate-in slide-in-from-bottom-2 fade-in duration-300">
                        <button
                            onClick={prevPart}
                            disabled={currentPartIndex === 0}
                            className="bg-[#333] text-white p-3 rounded flex-1 flex items-center justify-center active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>

                        <div className="flex flex-col items-center min-w-[30%]">
                            <span className="text-white font-bold text-lg leading-none">{currentPartIndex + 1} / {slideParts.length}</span>
                            <span className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">Partes</span>
                        </div>

                        <button
                            onClick={nextPart}
                            disabled={currentPartIndex === slideParts.length - 1}
                            className="bg-[#333] text-white p-3 rounded flex-1 flex items-center justify-center active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleToggleProjection}
                        className={`font-bold px-6 py-4 rounded-xl flex-1 active:scale-95 transition shadow-lg text-sm tracking-widest uppercase border 
                            ${!isBackendAvailable
                                ? 'bg-gray-800 border-gray-600 text-gray-400 cursor-not-allowed'
                                : isProjecting
                                    ? 'bg-red-900/80 border-red-700 text-white hover:bg-red-800'
                                    : 'bg-green-700/80 border-green-600 text-white hover:bg-green-600'
                            }`}
                        disabled={!isBackendAvailable}
                    >
                        {!isBackendAvailable ? 'OFFLINE (DESKTOP)' : isProjecting ? 'PARAR PROJEÇÃO' : 'RETOMAR PROJEÇÃO'}
                    </button>

                    <div className="flex flex-col items-end justify-center min-w-[60px]">
                        <div className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase mb-1">Status</div>
                        {/* Status Dot */}
                        {!isBackendAvailable ? (
                            <span className="w-3 h-3 rounded-full bg-gray-500" title="Backend Desktop Offline"></span>
                        ) : status !== 'connected' ? (
                            <span className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"></span>
                        ) : isProjecting ? (
                            <span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></span>
                        ) : (
                            <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
