
import React, { useState, useEffect, useRef } from 'react';
import { YouVersionClient } from '../lib/youversion-client';
import { splitTextIdeally } from '../lib/text-utils';
import Head from 'next/head';
import BibleProjection from './BibleProjection';
import { useProjectionSync } from '../hooks/useProjectionSync';

// DADOS DE LIVROS E GRUPOS (MANTIDOS)
const BOOK_GROUPS = [
    { type: 'Pentateuco', color: 'bg-amber-700', books: ['GEN', 'EXO', 'LEV', 'NUM', 'DEU'] },
    { type: 'Históricos', color: 'bg-orange-600', books: ['JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST'] },
    { type: 'Poéticos', color: 'bg-red-700', books: ['JOB', 'PSA', 'PRO', 'ECC', 'SNG'] },
    { type: 'Profetas Maiores', color: 'bg-purple-700', books: ['ISA', 'JER', 'LAM', 'EZK', 'DAN'] },
    { type: 'Profetas Menores', color: 'bg-purple-600', books: ['HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'] },
    { type: 'Evangelhos', color: 'bg-blue-700', books: ['MAT', 'MRK', 'LUK', 'JHN'] },
    { type: 'Histórico NT', color: 'bg-cyan-600', books: ['ACT'] },
    { type: 'Cartas Paulo', color: 'bg-green-700', books: ['ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM'] },
    { type: 'Cartas Gerais', color: 'bg-green-600', books: ['HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD'] },
    { type: 'Revelação', color: 'bg-yellow-600', books: ['REV'] },
];

const BIBLE_BOOKS_DATA: Record<string, { name: string, abbr: string }> = {
    'GEN': { name: 'Gênesis', abbr: 'Gn' }, 'EXO': { name: 'Êxodo', abbr: 'Ex' }, 'LEV': { name: 'Levítico', abbr: 'Lv' },
    'NUM': { name: 'Números', abbr: 'Nm' }, 'DEU': { name: 'Deuteronômio', abbr: 'Dt' },
    'JOS': { name: 'Josué', abbr: 'Js' }, 'JDG': { name: 'Juízes', abbr: 'Jz' }, 'RUT': { name: 'Rute', abbr: 'Rt' },
    '1SA': { name: '1 Samuel', abbr: '1Sm' }, '2SA': { name: '2 Samuel', abbr: '2Sm' },
    '1KI': { name: '1 Reis', abbr: '1Rs' }, '2KI': { name: '2 Reis', abbr: '2Rs' },
    '1CH': { name: '1 Crônicas', abbr: '1Cr' }, '2CH': { name: '2 Crônicas', abbr: '2Cr' },
    'EZR': { name: 'Esdras', abbr: 'Ed' }, 'NEH': { name: 'Neemias', abbr: 'Ne' }, 'EST': { name: 'Ester', abbr: 'Et' },
    'JOB': { name: 'Jó', abbr: 'Jó' }, 'PSA': { name: 'Salmos', abbr: 'Sl' }, 'PRO': { name: 'Provérbios', abbr: 'Pv' },
    'ECC': { name: 'Eclesiastes', abbr: 'Ec' }, 'SNG': { name: 'Cânticos', abbr: 'Ct' },
    'ISA': { name: 'Isaías', abbr: 'Is' }, 'JER': { name: 'Jeremias', abbr: 'Jr' }, 'LAM': { name: 'Lamentações', abbr: 'Lm' },
    'EZK': { name: 'Ezequiel', abbr: 'Ez' }, 'DAN': { name: 'Daniel', abbr: 'Dn' },
    'HOS': { name: 'Oseias', abbr: 'Os' }, 'JOL': { name: 'Joel', abbr: 'Jl' }, 'AMO': { name: 'Amós', abbr: 'Am' },
    'OBA': { name: 'Obadias', abbr: 'Ob' }, 'JON': { name: 'Jonas', abbr: 'Jn' }, 'MIC': { name: 'Miqueias', abbr: 'Mq' },
    'NAM': { name: 'Naum', abbr: 'Na' }, 'HAB': { name: 'Habacuque', abbr: 'Hc' }, 'ZEP': { name: 'Sofonias', abbr: 'Sf' },
    'HAG': { name: 'Ageu', abbr: 'Ag' }, 'ZEC': { name: 'Zacarias', abbr: 'Zc' }, 'MAL': { name: 'Malaquias', abbr: 'Ml' },
    'MAT': { name: 'Mateus', abbr: 'Mt' }, 'MRK': { name: 'Marcos', abbr: 'Mc' }, 'LUK': { name: 'Lucas', abbr: 'Lc' }, 'JHN': { name: 'João', abbr: 'Jo' },
    'ACT': { name: 'Atos', abbr: 'At' }, 'ROM': { name: 'Romanos', abbr: 'Rm' },
    '1CO': { name: '1 Coríntios', abbr: '1Co' }, '2CO': { name: '2 Coríntios', abbr: '2Co' },
    'GAL': { name: 'Gálatas', abbr: 'Gl' }, 'EPH': { name: 'Efésios', abbr: 'Ef' }, 'PHP': { name: 'Filipenses', abbr: 'Fp' },
    'COL': { name: 'Colossenses', abbr: 'Cl' }, '1TH': { name: '1 Tessalonicenses', abbr: '1Ts' }, '2TH': { name: '2 Tessalonicenses', abbr: '2Ts' },
    '1TI': { name: '1 Timóteo', abbr: '1Tm' }, '2TI': { name: '2 Timóteo', abbr: '2Tm' }, 'TIT': { name: 'Tito', abbr: 'Tt' }, 'PHM': { name: 'Filemom', abbr: 'Fm' },
    'HEB': { name: 'Hebreus', abbr: 'Hb' }, 'JAS': { name: 'Tiago', abbr: 'Tg' },
    '1PE': { name: '1 Pedro', abbr: '1Pe' }, '2PE': { name: '2 Pedro', abbr: '2Pe' },
    '1JN': { name: '1 João', abbr: '1Jo' }, '2JN': { name: '2 João', abbr: '2Jo' }, '3JN': { name: '3 João', abbr: '3Jo' },
    'JUD': { name: 'Judas', abbr: 'Jd' }, 'REV': { name: 'Apocalipse', abbr: 'Ap' }
};

// Parser Helpers
const cleanText = (text: string) => text.replace(/\s+/g, ' ').replace(/\[\d+\]/g, '').trim();

// DADOS DE REFERÊNCIA DE NOMES COMPLETOS (Mapeamento Manual para evitar siglas)
const VERSION_FULL_NAMES: Record<string, string> = {
    'NVI': 'Nova Versão Internacional',
    'NTLH': 'Nova Tradução na Linguagem de Hoje',
    'ARC': 'Almeida Revista e Corrigida (Novo Testamento)',
    'ARA': 'Almeida Revista e Atualizada (Novo Testamento)',
    'NAA': 'Nova Almeida Atualizada',
    'NVT': 'Nova Versão Transformadora',
    'KJA': 'King James Atualizada',
    'VFL': 'Versão Fácil de Ler',
    'NBV-P': 'Nova Bíblia Viva',
    'OL': 'O Livro',
    'PTNVI': 'Nova Versão Internacional (PT)',
    'ACF': 'Almeida Corrigida Fiel', // DBT (Oficial)
    'ACF (OLD)': 'Almeida Corrigida Fiel (Backup)' // Legacy
};

const NT_ONLY_VERSIONS = ['PORARA', 'PORARC'];
const OLD_TESTAMENT_BOOKS = new Set([
    'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
    '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
    'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
    'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'
]);

export default function BibleSearch() {
    const [selectedBookId, setSelectedBookId] = useState('GEN');
    const [selectedChapterId, setSelectedChapterId] = useState('GEN.1');
    const [chapterList, setChapterList] = useState<any[]>([]);
    const [previewVerses, setPreviewVerses] = useState<{ num: number, text: string }[]>([]);

    const [versions, setVersions] = useState<any[]>([]);
    const [currentVersion, setCurrentVersion] = useState('129'); // NVI

    const [activeSlide, setActiveSlide] = useState<{ text: string, ref: string } | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isProjectionVisible, setIsProjectionVisible] = useState(true);

    // --- STATES PARA PREVIEW/SLIDES (Adicionados para corrigir erro) ---
    const [previewSettings, setPreviewSettings] = useState<any>(null);
    const [slideParts, setSlideParts] = useState<string[]>([]);
    const [currentPartIndex, setCurrentPartIndex] = useState(0);

    const nextPart = () => { if (currentPartIndex < slideParts.length - 1) setCurrentPartIndex(prev => prev + 1); };
    const prevPart = () => { if (currentPartIndex > 0) setCurrentPartIndex(prev => prev - 1); };

    // PERFORMANCE: Ref para evitar enviar imagem gigante repetidamente no Broadcast
    const lastBroadcastStyleRef = useRef<string>('');

    // Carregar configurações visuais
    useEffect(() => {
        const loadSettings = () => {
            const saved = localStorage.getItem('bible_settings');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setPreviewSettings((prev: any) => {
                        // Deep Compare para evitar re-renders infinitos e spam de API
                        if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
                        return parsed;
                    });
                } catch (e) { }
            }
        };
        loadSettings();
        const interval = setInterval(loadSettings, 2000); // Polling para atualizar live
        return () => clearInterval(interval);
    }, []);


    // --- SINCRONIZAÇÃO COM API DE PROJEÇÃO EXTERNA (SUPABASE REALTIME) ---
    const { sendState } = useProjectionSync('sender');

    useEffect(() => {
        const syncToApi = async () => {
            const shouldShow = activeSlide && isProjectionVisible;
            const payload = {
                verseText: shouldShow ? activeSlide.text : '',
                reference: shouldShow ? activeSlide.ref : '',
                slideIndex: currentPartIndex,
                version: currentVersion,
                style: previewSettings || {},
                timestamp: Date.now()
            };
            sendState(payload);
        };
        syncToApi();
    }, [activeSlide, currentPartIndex, previewSettings, currentVersion, isProjectionVisible]);


    // Quebra de Texto (Atualizado)
    useEffect(() => {
        if (activeSlide?.text) {
            const parts = splitTextIdeally(activeSlide.text, 180);
            setSlideParts(parts);
            setCurrentPartIndex(0);
        } else {
            setSlideParts([]);
        }
    }, [activeSlide]);

    useEffect(() => {
        console.log('[DEBUG] Component mounted, loading versions...');
        loadVersions();
    }, []);

    // Carregar capítulos e versículos iniciais
    useEffect(() => {
        if (currentVersion && selectedBookId) {
            console.log('[DEBUG] Initial load - Version:', currentVersion, 'Book:', selectedBookId);
            loadChapters(selectedBookId);
            if (selectedChapterId) {
                loadChapterText(selectedBookId, selectedChapterId);
            }
        }
    }, [currentVersion]);

    // ATUALIZAÇÃO DE CAPÍTULOS E FILTRO NT
    useEffect(() => {
        // Se mudou para versão NT e o livro selecionado é OT -> Mudar para MAT automaticamente
        const isNt = NT_ONLY_VERSIONS.includes(currentVersion);
        if (isNt && OLD_TESTAMENT_BOOKS.has(selectedBookId)) {
            // Force reset to MAT without loading chapters twice
            setSelectedBookId('MAT');
            // O effect vai rodar de novo pois selectedBookId não mudou no render cycle ainda? 
            // Não, se eu setar aqui ele agenda update.
            // Mas preciso garantir que carregue.
            // Vou chamar load diretamente.
            selectBook('MAT');
            return;
        }
    }, [currentVersion, selectedBookId]);

    const loadVersions = async () => {
        try {
            console.log('[DEBUG] Loading versions...');
            const data = await YouVersionClient.getVersions();
            console.log('[DEBUG] Versions loaded:', data?.length || 0);
            setVersions(data.filter(v => v.abbreviation !== 'BLT'));
            const saved = localStorage.getItem('bible_version');
            if (saved) {
                console.log('[DEBUG] Using saved version:', saved);
                setCurrentVersion(saved);
            } else {
                // Tentar NVI primeiro
                const nvi = data.find(v => v.abbreviation === 'NVI');
                if (nvi) {
                    console.log('[DEBUG] Using NVI as default:', nvi.id);
                    setCurrentVersion(nvi.id);
                } else {
                    // Fallback para ALMEIDA_EXTERNA se NVI não estiver disponível
                    const almeida = data.find(v => v.id === 'ALMEIDA_EXTERNA');
                    if (almeida) {
                        console.log('[DEBUG] NVI not available, using ALMEIDA_EXTERNA as fallback');
                        setCurrentVersion('ALMEIDA_EXTERNA');
                    } else if (data.length > 0) {
                        // Usar a primeira versão disponível
                        console.log('[DEBUG] Using first available version:', data[0].id);
                        setCurrentVersion(data[0].id);
                    }
                }
            }
        } catch (e) {
            console.error('[ERROR] Failed to load versions:', e);
            // Em caso de erro total, usar ALMEIDA_EXTERNA
            setCurrentVersion('ALMEIDA_EXTERNA');
        }
    };

    const loadChapters = async (bookId: string) => {
        try {
            console.log('[DEBUG] Loading chapters for book:', bookId, 'Version:', currentVersion);
            const chaps = await YouVersionClient.getChapters(currentVersion, bookId);
            console.log('[DEBUG] Chapters loaded:', chaps?.length || 0);
            if (chaps) setChapterList(chaps);
            return chaps;
        } catch (e) {
            console.error('[ERROR] Failed to load chapters:', e);
        }
    };

    const loadChapterText = async (bookId: string, chapId: string) => {
        try {
            console.log('[DEBUG] Loading text for:', chapId, 'Version:', currentVersion);
            const result = await YouVersionClient.getPassage(currentVersion, chapId);
            console.log('[DEBUG] API Result:', result);

            if (result && (result.content || result.data?.content)) {
                const html = result.content || result.data.content;
                console.log('[DEBUG] Raw HTML Length:', html.length);

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;

                // Remove lixo (inclui títulos s1 e h1 que causam bugs em livros numerados ex: 1 João)
                tempDiv.querySelectorAll('.note, .chapter-number, .audio-player, .s1, h1, h2, .r').forEach(n => n.remove());

                const verses: { num: number, text: string }[] = [];

                // --- PARSER VIOLENTO (REGEX) ---
                let cleanHtml = html
                    .replace(/<span[^>]*class="[^"]*(?:label|v|verse-number|versenum)[^"]*"[^>]*>([\d]+)<\/span>/gi, '___V$1___')
                    .replace(/<span[^>]*class="[^"]*yv-v[^"]*"[^>]*v="(\d+)"[^>]*>/gi, '___V$1___')
                    .replace(/data-usfm="[^"]+\.[^"]+\.(\d+)"/gi, 'data-v="$1"');

                let txt = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const parts = txt.split('___V');
                const versesFound: { num: number, text: string }[] = [];

                parts.forEach((part: string) => {
                    const match = part.match(/^(\d+)___(.*)/);
                    if (match) {
                        const num = parseInt(match[1]);
                        let text = match[2].trim();
                        text = text.replace(/^[\d]+\s+/, '').trim();
                        text = text.replace(/Copyright.*/gi, '').trim();

                        if (num > 0 && text) {
                            versesFound.push({ num, text });
                        }
                    } else {
                        const rawMatch = part.match(/^(\d+)\s+(.*)/);
                        if (rawMatch) {
                            versesFound.push({ num: parseInt(rawMatch[1]), text: rawMatch[2].trim() });
                        }
                    }
                });

                if (versesFound.length < 2) {
                    const pureText = tempDiv.textContent || '';
                    const matches = pureText.matchAll(/(\d+)\s+([^0-9]+)(?=\d+\s|$)/g);
                    for (const match of matches) {
                        versesFound.push({ num: parseInt(match[1]), text: cleanText(match[2]) });
                    }
                }

                if (versesFound.length > 0) {
                    versesFound.sort((a, b) => a.num - b.num);
                    const unique = versesFound.filter((v, i, a) => a.findIndex(t => t.num === v.num) === i);
                    setPreviewVerses(unique);
                } else {
                    setPreviewVerses([{ num: 0, text: 'Texto indisponível nesta versão.' }]);
                }

            } else { setPreviewVerses([]); }
        } catch (e) { console.error(e); setPreviewVerses([]); }
    };

    const selectBook = (bookId: string) => {
        setSelectedBookId(bookId);
        loadChapters(bookId).then(chaps => {
            if (chaps && chaps.length > 0) {
                const first = chaps[0];
                const fid = first.passage_id || first.id;
                setSelectedChapterId(fid);
                loadChapterText(bookId, fid);
            }
        });
    };

    const selectChapter = (chapIndex: number) => {
        if (!chapterList[chapIndex]) return;
        const chapId = chapterList[chapIndex].passage_id || chapterList[chapIndex].id;
        setSelectedChapterId(chapId);
        loadChapterText(selectedBookId, chapId);
    };

    const projectVerse = (v: { num: number, text: string }) => {
        if (v.num === 0) return;
        const bookName = BIBLE_BOOKS_DATA[selectedBookId]?.name || selectedBookId;
        const chapNum = selectedChapterId.split('.')[1] || selectedChapterId;
        const ref = `${bookName} ${chapNum}:${v.num}`;
        setActiveSlide({ text: v.text, ref });
        setIsProjectionVisible(true);
    };

    const previewContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const el = document.getElementById('preview-scaler');
            if (!el) return;

            const currentTrans = el.style.transform;
            const scaleMatch = currentTrans.match(/scale\(([^)]+)\)/);
            let currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 0.3;

            // Ajuste de sensibilidade do zoom
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            let newScale = Math.max(0.1, Math.min(3, currentScale + delta));

            const translateMatch = currentTrans.match(/translate\(([^)]+)\)/);
            const translatePart = translateMatch ? `translate(${translateMatch[1]})` : 'translate(0px, 0px)';
            el.style.transform = `${translatePart} scale(${newScale})`;

            const slider = document.getElementById('zoom-slider') as HTMLInputElement;
            if (slider) slider.value = String(newScale);
        };

        const container = previewContainerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            if (container) {
                container.removeEventListener('wheel', handleWheel);
            }
        };
    }, []);

    return (
        <div className="h-screen bg-[#1a1a1a] text-white flex overflow-hidden font-sans select-none">
            <Head><title>Project Church</title></Head>

            {/* COLUNA ESQUERDA FIXA (AGORA SÓ LISTA DE TEXTO) */}
            <div className="w-[450px] min-w-[350px] border-r border-[#333] flex flex-col bg-white text-black shrink-0 relative z-20 shadow-xl transition-all">
                <div className="p-3 bg-gray-100 border-b border-gray-300 flex justify-between items-center h-12 shrink-0 gap-2">
                    <div className="font-bold text-base text-gray-800 truncate flex-1 min-w-[30%]">
                        {BIBLE_BOOKS_DATA[selectedBookId]?.name} {selectedChapterId.split('.')[1] || ''}
                    </div>
                    <select
                        value={currentVersion}
                        onChange={(e) => { setCurrentVersion(e.target.value); localStorage.setItem('bible_version', e.target.value); }}
                        className="bg-white border border-gray-300 text-gray-700 text-[11px] font-bold uppercase rounded py-1 px-2 outline-none cursor-pointer max-w-[70%] flex-shrink-0"
                        title="Selecione a Versão"
                    >
                        {versions.map(v => {
                            // Tenta obter o nome completo na ordem: Mapeamento Manual > Titulo Local > Nome > Abreviação
                            const abbr = v.abbreviation.toUpperCase();
                            const fullName = VERSION_FULL_NAMES[abbr] || v.local_title || v.name || abbr;
                            return (
                                <option key={v.id} value={v.id} title={fullName}>
                                    {fullName}
                                </option>
                            );
                        })}
                        {versions.length === 0 && <option>NVI</option>}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-400">
                    {previewVerses.length > 0 ? (
                        previewVerses.map(v => (
                            <div
                                key={v.num}
                                onClick={() => projectVerse(v)}
                                className={`flex gap-2 px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition items-start group ${activeSlide?.text === v.text ? 'bg-blue-100' : ''}`}
                            >
                                <span className={`text-xs font-bold w-6 pt-0.5 text-right shrink-0 ${activeSlide?.text === v.text ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`}>{v.num}</span>
                                <p className={`text-sm leading-snug ${activeSlide?.text === v.text ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>{v.text}</p>
                            </div>
                        ))
                    ) : (
                        <div className="p-4 text-center text-gray-400 text-sm">Carregando...</div>
                    )}
                </div>
            </div>

            {/* --- COLUNA DIREITA (GRID + LIVE PREVIEW EMBAIXO) --- */}
            <div className="flex-1 flex flex-col bg-[#222] min-w-[600px] overflow-hidden">
                {/* HEADER / NAVEGAÇÃO MÚSICA */}
                <div className="bg-[#1a1a1a] p-1 border-b border-black flex items-center shrink-0 h-10 px-2 gap-2">
                    <button
                        onClick={() => window.location.href = '/music'}
                        className="bg-purple-700 hover:bg-purple-600 text-white text-[10px] uppercase font-bold px-3 py-1 rounded flex items-center gap-2 shadow-lg transition"
                    >
                        PROJEÇÃO LOUVOR <span className="opacity-70 text-[9px] font-normal">(BETA)</span>
                    </button>
                </div>

                {/* PAINEL LIVROS (Topo - 35%) */}
                <div className="h-[35%] border-b border-black bg-[#1a1a1a] p-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 shrink-0">
                    <div className="grid grid-cols-12 gap-1 content-start">
                        {BOOK_GROUPS.map(group => {
                            const isNtOnly = NT_ONLY_VERSIONS.includes(currentVersion);
                            // Filtra livros se for NT Only
                            const filteredBooks = group.books.filter(b => !isNtOnly || !OLD_TESTAMENT_BOOKS.has(b));

                            if (filteredBooks.length === 0) return null; // Esconde grupo vazio

                            return filteredBooks.map(bookId => {
                                const info = BIBLE_BOOKS_DATA[bookId] || { name: bookId, abbr: bookId };
                                return (
                                    <button key={bookId} onClick={() => selectBook(bookId)} className={`${group.color} text-white rounded-[2px] h-14 flex flex-col items-center justify-center hover:brightness-110 active:brightness-90 transition-all ${selectedBookId === bookId ? 'ring-2 ring-white z-10' : 'opacity-90'}`}>
                                        <span className="text-base font-bold leading-none mb-0.5">{info.abbr}</span>
                                        <span className="text-[9px] uppercase font-bold opacity-80 leading-none truncate w-full text-center px-0.5">{info.name}</span>
                                    </button>
                                );
                            });
                        })}
                    </div>
                </div>

                {/* PAINEL GRIDS (Meio - 35%) */}
                <div className="h-[35%] flex bg-[#222] border-b border-black shrink-0">
                    {/* Capítulos */}
                    <div className="w-[300px] border-r border-[#111] bg-[#222] flex flex-col shrink-0">
                        <div className="bg-[#1a1a1a] px-2 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0">Capítulos</div>
                        <div className="flex-1 p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
                            <div className="grid grid-cols-5 gap-1">
                                {chapterList.map((c, i) => {
                                    const chapNum = (c.human || c.number || (i + 1)).toString();
                                    const isSelected = selectedChapterId.endsWith(`.${chapNum}`) || selectedChapterId === chapNum;
                                    return (<button key={i} onClick={() => selectChapter(i)} className={`h-12 text-lg font-bold rounded-sm flex items-center justify-center transition-colors ${isSelected ? 'bg-amber-600 text-white' : 'bg-[#333] text-gray-300 hover:bg-[#444]'}`}>{chapNum}</button>)
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Versículos */}
                    <div className="flex-1 bg-[#1e1e1e] flex flex-col min-w-0">
                        <div className="bg-[#1a1a1a] px-2 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0">Versículos</div>
                        <div className="flex-1 p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
                            <div className="grid grid-cols-8 lg:grid-cols-10 gap-1 content-start">
                                {previewVerses.map(v => (
                                    <button key={v.num} onClick={() => projectVerse(v)} className={`h-12 text-xl font-bold rounded-sm flex items-center justify-center transition-all ${activeSlide?.text === v.text ? 'bg-blue-600 text-white shadow-lg scale-105 z-10' : 'bg-[#333] text-gray-300 hover:bg-[#444]'}`}>{v.num}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* PAINEL LIVE PREVIEW (Inferior - 30% - PAN & ZOOM CORIGIDO) */}
                <div className="flex-1 bg-[#111] flex flex-col min-h-[30%] relative border-t-2 border-amber-600">
                    <div className="bg-[#000] px-3 py-1 flex justify-between items-center border-b border-[#333] h-8 shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> RETORNO (LIVE)
                            </span>
                            {/* Controles de Slide (Setinhas) */}
                            {slideParts.length > 1 && (
                                <div className="flex items-center gap-1 ml-4 bg-[#222] rounded px-1">
                                    <button onClick={prevPart} disabled={currentPartIndex === 0} className="px-2 py-0.5 text-white hover:text-blue-400 disabled:opacity-30">◀</button>
                                    <span className="text-[10px] text-gray-300 font-mono w-8 text-center">{currentPartIndex + 1} / {slideParts.length}</span>
                                    <button onClick={nextPart} disabled={currentPartIndex === slideParts.length - 1} className="px-2 py-0.5 text-white hover:text-blue-400 disabled:opacity-30">▶</button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    let baseUrl = window.location.origin;

                                    // Tentar obter IP via Tauri Invoke (Mais confiável)
                                    if (window.__TAURI__) {
                                        try {
                                            const ip = await window.__TAURI__.invoke('get_local_ip');
                                            if (ip) {
                                                baseUrl = `http://${ip}:3000`; // Porta 3000 fixa do Actix
                                            }
                                        } catch (e) {
                                            console.error("Erro Tauri IP:", e);
                                        }
                                    } else {
                                        // Fallback Fetch (Legacy/Browser Dev)
                                        try {
                                            const res = await fetch('/api/local-ip');
                                            if (res.ok) {
                                                const data = await res.json();
                                                if (data.ip && data.ip !== 'localhost') {
                                                    const port = window.location.port || '3000';
                                                    baseUrl = `http://${data.ip}:${port}`;
                                                }
                                            }
                                        } catch (e) {
                                            console.error('Falha ao obter IP local via Fetch', e);
                                        }
                                    }

                                    const text = baseUrl + '/projection';

                                    try {
                                        await navigator.clipboard.writeText(text);
                                        // Alerta simples e confiável
                                        alert(`✅ LINK COPIADO COM SUCESSO!\n\n${text}\n\nAbra este link no navegador do celular/tablet conectado ao mesmo Wi-Fi.`);
                                    } catch (err) {
                                        // Fallback para Electron/Legacy
                                        try {
                                            const textArea = document.createElement("textarea");
                                            textArea.value = text;
                                            textArea.style.position = "fixed";
                                            document.body.appendChild(textArea);
                                            textArea.focus();
                                            textArea.select();
                                            const successful = document.execCommand('copy');
                                            document.body.removeChild(textArea);
                                            if (successful) {
                                                alert('Link de REDE copiado (Modo Compatibilidade): ' + text);
                                            } else {
                                                throw new Error('Fallback falhou');
                                            }
                                        } catch (fallbackErr) {
                                            prompt('Link de REDE (Copie manualmente):', text);
                                        }
                                    }
                                }}
                                className="bg-[#333] hover:bg-[#444] text-[9px] text-gray-300 uppercase font-bold px-2 py-1 rounded flex items-center gap-1 transition border border-[#444]">
                                Link Projeção (Rede)
                            </button>
                            <button onClick={() => setIsProjectionVisible(!isProjectionVisible)} className={`${isProjectionVisible ? 'bg-red-900/50 hover:bg-red-900 text-red-200 border-red-900/50' : 'bg-green-700 hover:bg-green-600 text-white border-green-700'} text-[9px] uppercase font-bold px-2 py-1 rounded flex items-center gap-1 transition border w-24 justify-center`}>
                                {isProjectionVisible ? '⏹ Parar' : '▶ Retomar'}
                            </button>
                            <button onClick={() => setIsEditorOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] uppercase font-bold px-3 py-1 rounded flex items-center gap-1 transition">
                                Editar Projeção
                            </button>
                        </div>
                    </div>

                    {/* ÁREA DO PROJETOR SIMULADA (WYSIWYG) */}
                    <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-[#0a0a0a]">
                        {activeSlide && isProjectionVisible ? (
                            <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black/50">
                                {/* CONTROLE DE ZOOM DO PREVIEW (FIXO) */}
                                <div className="absolute top-2 right-2 z-50 flex items-center gap-2 bg-black/80 px-2 py-1 rounded border border-white/10 shadow-lg select-none">
                                    <span className="text-[10px] text-gray-400 font-bold">ZOOM</span>
                                    <input
                                        type="range"
                                        id="zoom-slider"
                                        min="0.1"
                                        max="3"
                                        step="0.1"
                                        defaultValue="0.3"
                                        className="w-24 h-1 accent-blue-500 cursor-pointer"
                                        onInput={(e) => {
                                            const val = Number(e.currentTarget.value);
                                            const el = document.getElementById('preview-scaler');
                                            if (el) {
                                                const currentTrans = el.style.transform;
                                                const translateMatch = currentTrans.match(/translate\(([^)]+)\)/);
                                                const translatePart = translateMatch ? `translate(${translateMatch[1]})` : 'translate(0px, 0px)';
                                                el.style.transform = `${translatePart} scale(${val})`;
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                {/* VIRTUAL CANVAS PREVIEW (Pan & Zoom Container) */}
                                <div
                                    ref={previewContainerRef}
                                    className="relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent cursor-grab active:cursor-grabbing"
                                    onMouseDown={(e) => {
                                        const el = document.getElementById('preview-scaler');
                                        if (!el) return;
                                        el.dataset.dragging = "true";
                                        el.dataset.startX = String(e.clientX);
                                        el.dataset.startY = String(e.clientY);

                                        const currentTrans = el.style.transform;
                                        const translateMatch = currentTrans.match(/translate\(([^,]+)(?:,\s*([^)]+))?\)/);
                                        if (translateMatch) {
                                            el.dataset.currentX = translateMatch[1].replace('px', '');
                                            el.dataset.currentY = translateMatch[2] ? translateMatch[2].replace('px', '') : '0';
                                        } else {
                                            el.dataset.currentX = '0';
                                            el.dataset.currentY = '0';
                                        }
                                    }}
                                    onMouseMove={(e) => {
                                        const el = document.getElementById('preview-scaler');
                                        if (!el || el.dataset.dragging !== "true") return;

                                        const dx = e.clientX - parseFloat(el.dataset.startX || '0');
                                        const dy = e.clientY - parseFloat(el.dataset.startY || '0');

                                        const newX = parseFloat(el.dataset.currentX || '0') + dx;
                                        const newY = parseFloat(el.dataset.currentY || '0') + dy;

                                        const currentTrans = el.style.transform;
                                        const scaleMatch = currentTrans.match(/scale\(([^)]+)\)/);
                                        const scalePart = scaleMatch ? `scale(${scaleMatch[1]})` : 'scale(0.3)';

                                        el.style.transform = `translate(${newX}px, ${newY}px) ${scalePart}`;
                                    }}
                                    onMouseUp={() => {
                                        const el = document.getElementById('preview-scaler');
                                        if (el) el.dataset.dragging = "false";
                                    }}
                                    onMouseLeave={() => {
                                        const el = document.getElementById('preview-scaler');
                                        if (el) el.dataset.dragging = "false";
                                    }}
                                >
                                    <div
                                        id="preview-scaler"
                                        style={{
                                            width: '1024px',
                                            height: '576px',
                                            backgroundColor: previewSettings?.backgroundColor || '#000',
                                            backgroundImage: previewSettings?.backgroundImage ? `url(${previewSettings.backgroundImage})` : 'none',
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            position: 'relative',
                                            transform: 'translate(0px, 0px) scale(0.3)',
                                            transformOrigin: 'center center',
                                            flexShrink: 0,
                                            boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                                            overflow: 'hidden',
                                            transition: 'transform 0.05s linear' // Suavidade básica
                                        }}
                                    >
                                        {/* CONTEÚDO IDÊNTICO AO PROJECTION */}
                                        {/* Texto Versículo */}
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: `${(previewSettings as any)?.textBox?.x || 50}%`,
                                                top: `${(previewSettings as any)?.textBox?.y || 50}%`,
                                                width: `${(previewSettings as any)?.textBox?.w || 80}%`,
                                                height: `${(previewSettings as any)?.textBox?.h || 40}%`,
                                                transform: 'translate(-50%, -50%)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: (previewSettings as any)?.verticalAlign || 'center',
                                                textAlign: previewSettings?.textAlign || 'center',
                                                color: previewSettings?.color || '#ffffff',
                                                fontFamily: previewSettings?.fontFamily || 'Inter, sans-serif',
                                                fontWeight: previewSettings?.fontWeight || 'normal',
                                                fontSize: `${previewSettings?.fontSize || 30}px`,
                                                textTransform: (previewSettings as any)?.textTransform || 'none',
                                                textShadow: 'none', // Sem sombra
                                                whiteSpace: 'pre-wrap',
                                                lineHeight: 1.25,
                                                maxWidth: '100%',
                                                maxHeight: '100%',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {slideParts[currentPartIndex]}
                                        </div>

                                        {/* Referência */}
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: `${(previewSettings as any)?.refPos?.x || 50}%`,
                                                top: `${(previewSettings as any)?.refPos?.y || 80}%`,
                                                transform: 'translate(-50%, -50%)',
                                                color: (previewSettings as any)?.refColor || previewSettings?.color || '#ffffff',
                                                fontFamily: previewSettings?.fontFamily || 'Inter, sans-serif',
                                                fontSize: `${(previewSettings as any)?.refFontSize || 20}px`,
                                                fontWeight: 'bold',
                                                textShadow: 'none',
                                                opacity: 0.9,
                                                textTransform: (previewSettings as any)?.textTransform || 'none',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {activeSlide.ref}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-700 flex flex-col items-center select-none w-full h-full justify-center bg-[#111]">
                                <h1 className="text-4xl font-black opacity-10">OFFLINE</h1>
                                {activeSlide && !isProjectionVisible && (
                                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-50 mt-2 text-red-500 animate-pulse">
                                        PROJEÇÃO PARADA (Clique em Retomar)
                                    </span>
                                )}
                                {!activeSlide && <span className="text-[10px] uppercase font-bold tracking-widest opacity-30 mt-2">Nenhum slide ativo</span>}
                            </div>
                        )}
                    </div>
                </div>

                {isEditorOpen && activeSlide && (
                    <BibleProjection verseText={activeSlide.text} reference={activeSlide.ref} onClose={() => setIsEditorOpen(false)} />
                )}
            </div>
        </div>
    );
}
