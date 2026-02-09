
import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { YouVersionClient } from '../lib/youversion-client';
import { LocalBibleManager } from '../lib/local-bible-manager';
import { splitTextIdeally, splitTextGeometrically } from '../lib/text-utils';
import Head from 'next/head';

import BibleProjection from './BibleProjection';
import { useProjectionSync } from '../hooks/useProjectionSync';
import MenuBar from './MenuBar';
import { StorageHelper } from '../lib/storage-helper';

import { BOOK_GROUPS, BIBLE_BOOKS_DATA, VERSION_FULL_NAMES, NT_ONLY_VERSIONS, OLD_TESTAMENT_BOOKS, cleanText } from '../lib/bible-data';


const PreviewContent = ({ style, currentText, reference }: { style: any, currentText: string, reference: string }) => {
    const delay = style?.textDelay ? Number(style.textDelay) : 0;
    const textRef = useRef<HTMLDivElement>(null);
    // CRITICAL for Delay: Start Hidden if delay > 0
    const [textVisible, setTextVisible] = useState(delay <= 0);

    // Delay Timer
    useEffect(() => {
        if (delay > 0) {
            setTextVisible(false);
            const timer = setTimeout(() => {
                setTextVisible(true);
            }, delay * 1000);
            return () => clearTimeout(timer);
        } else {
            setTextVisible(true);
        }
    }, [delay]);

    // Auto-Fit Hook
    useEffect(() => {
        if (!currentText) return;
        if (textRef.current && style?.fontSize) {
            const el = textRef.current;
            const targetSize = parseInt(style.fontSize);
            el.style.fontSize = `${targetSize}px`;

            let currentSize = targetSize;
            while (el.scrollHeight > el.clientHeight + 1 && currentSize > 10) {
                currentSize--;
                el.style.fontSize = `${currentSize}px`;
            }
        }
    }, [currentText, style]);

    return (
        <>
            {/* Texto Versículo */}
            <div
                ref={textRef}
                className={textVisible && ((style as any)?.textAnimation) && ((style as any)?.textAnimation) !== 'none' ? `anim-enter anim-${(style as any)?.textAnimation} anim-delay` : ''}
                style={{
                    position: 'absolute',
                    zIndex: 10,
                    left: `${(style?.textBox?.x || 50)}%`,
                    top: `${(style?.textBox?.y || 50)}%`,
                    width: `${(style?.textBox?.w || 80)}%`,
                    height: `${(style?.textBox?.h || 40)}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: (style as any)?.verticalAlign || 'center',
                    textAlign: style?.textAlign || 'center',
                    color: style?.color || '#ffffff',
                    fontFamily: style?.fontFamily || 'Inter, sans-serif',
                    fontSize: `${style?.fontSize || 30}px`,
                    fontWeight: style?.fontWeight || 'normal',
                    textTransform: (style as any)?.textTransform || 'none',
                    textShadow: 'none',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', hyphens: 'auto',
                    lineHeight: 1.25,
                    maxWidth: '100%',
                    maxHeight: '100%',
                    overflow: 'hidden',
                    animationDuration: `${(style as any)?.textDuration || 0.6}s`,
                    opacity: textVisible ? 1 : 0,
                    transition: 'opacity 0.5s ease-out'
                }}
            >
                {currentText}
            </div>

            {/* Referência */}
            <div
                className={textVisible && ((style as any)?.refAnimation) && ((style as any)?.refAnimation) !== 'none' ? `anim-enter anim-${(style as any)?.refAnimation}` : ''}
                style={{
                    position: 'absolute',
                    zIndex: 20,
                    left: `${(style?.refPos?.x || 50)}%`,
                    top: `${(style?.refPos?.y || 80)}%`,
                    transform: 'translate(-50%, -50%)',
                    color: (style as any)?.refColor || style?.color || '#ffffff',
                    fontFamily: style?.fontFamily || 'Inter, sans-serif',
                    fontSize: `${(style as any)?.refFontSize || 20}px`,
                    fontWeight: 'bold',
                    textShadow: 'none',
                    textTransform: (style as any)?.textTransform || 'none',
                    whiteSpace: 'nowrap',
                    animationDuration: `${(style as any)?.refDuration || 0.6}s`,
                    opacity: textVisible ? 0.9 : 0,
                    transition: 'opacity 0.5s ease-out'
                }}
            >
                {(style as any)?.refContent || reference}
            </div>
        </>
    );
};

const getVersionCopyright = (id: string) => {
    // Garantir que id é uma string válida
    if (!id || typeof id !== 'string') return '';
    const v = id.toUpperCase();
    // EXCLUSIVO PARA ACF - SBTB (Conforme solicitado)
    if (v === 'PORACF' || v === 'ACF' || v === 'ACF2011' || v === 'ACF_SBTB') {
        return "A Bíblia Sagrada - Almeida Corrigida Fiel | acf - © 1994, 1995, 2007, 2011 Sociedade Bíblica Trinitariana do Brasil";
    }
    return "";
};

export default function BibleSearch() {
    const [selectedBookId, setSelectedBookId] = useState('GEN');
    const [selectedChapterId, setSelectedChapterId] = useState('GEN.1');
    const [chapterList, setChapterList] = useState<any[]>([]);
    const [previewVerses, setPreviewVerses] = useState<{ num: number, text: string }[]>([]);

    const [versions, setVersions] = useState<any[]>([]);
    const [currentVersion, setCurrentVersion] = useState('129'); // NVI

    const [activeSlide, setActiveSlide] = useState<{ text: string, ref: string, copyright?: string } | null>(null);
    const [currentCopyright, setCurrentCopyright] = useState('');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isProjectionVisible, setIsProjectionVisible] = useState(true);

    // --- STATES PARA PREVIEW/SLIDES (Adicionados para corrigir erro) ---
    const [previewSettings, setPreviewSettings] = useState<any>(null);
    const [slideParts, setSlideParts] = useState<string[]>([]);
    const [currentPartIndex, setCurrentPartIndex] = useState(0);

    // Download Offline
    const [downloadStatus, setDownloadStatus] = useState<{ downloading: boolean, progress: number, message: string, currentId?: string }>({ downloading: false, progress: 0, message: '' });
    const abortControllerRef = useRef<boolean>(false);
    const [downloadedVersions, setDownloadedVersions] = useState<string[]>([]);

    useEffect(() => {
        LocalBibleManager.listDownloadedVersions().then(list => setDownloadedVersions(list.map(v => String(v.id))));


    }, []);

    const nextPart = () => { if (currentPartIndex < slideParts.length - 1) setCurrentPartIndex(prev => prev + 1); };
    const prevPart = () => { if (currentPartIndex > 0) setCurrentPartIndex(prev => prev - 1); };

    // V108: Atalhos de Teclado para Navegação de Versículos Longos (Setas)
    useEffect(() => {
        const handleArrows = (e: KeyboardEvent) => {
            // Ignorar se estiver digitando em input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (activeSlide && slideParts.length > 1) {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (currentPartIndex < slideParts.length - 1) setCurrentPartIndex(prev => prev + 1);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (currentPartIndex > 0) setCurrentPartIndex(prev => prev - 1);
                }
            }
        };
        window.addEventListener('keydown', handleArrows);
        return () => window.removeEventListener('keydown', handleArrows);
    }, [activeSlide, slideParts, currentPartIndex]);

    // PERFORMANCE: Ref para evitar enviar imagem gigante repetidamente no Broadcast
    const lastBroadcastStyleRef = useRef<string>('');
    const lastSentStyleRef = useRef<string>(''); // V58: Otimização de Egress Supabase (Difference Check)
    const sequenceIdRef = useRef(0); // V53: Serialização
    const payloadRef = useRef<any>(null); // V37: Guarda o estado atual para envio atômico
    const forceSyncNow = useRef(false); // V39: Bypass debounce para sync imediato
    const forceLocalOverride = useRef(false); // V67: Time Travel override flag

    // SYNC REFS (Bidirectional)
    const isRemoteUpdate = useRef(false);
    const ignoreIndexReset = useRef(false);

    // MODO MOBILE (Controle de Conflito)
    const [mobileMode, setMobileMode] = useState(false);
    const [activatingDesktop, setActivatingDesktop] = useState(false); // V43: Feedback no SISTEMA
    const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false); // V76: Custom Version Dropdown
    const [editTarget, setEditTarget] = useState<'ref' | 'text'>('ref'); // V78: Animation Target Selector

    // Carregar configurações visuais (Otimizado: Evita ler imagem gigante toda vez)
    const lastSettingsRawRef = useRef<string>('');
    const lastIndexedBgRef = useRef<string | null>(null);
    const manualSlidesRef = useRef<string[] | null>(null); // SYNC: Garante cortes exatos do editor

    useEffect(() => {
        const loadSettings = async () => {
            const saved = localStorage.getItem('bible_settings');
            if (saved && saved !== lastSettingsRawRef.current) {
                try {
                    lastSettingsRawRef.current = saved;
                    const parsed = JSON.parse(saved);

                    // ADAPTER: Handle Payload structure vs Legacy Style structure
                    let actualStyle = parsed;
                    if (parsed.style) {
                        actualStyle = parsed.style;
                    }

                    // Só busca no IndexedDB se mudou algo ou se ainda não temos no cache local do componente
                    if (!actualStyle.backgroundImage || actualStyle.backgroundImage.length < 100) {
                        if (lastIndexedBgRef.current) {
                            actualStyle.backgroundImage = lastIndexedBgRef.current;
                        } else {
                            const indexedBg = await StorageHelper.getBackground('bible_settings');
                            if (indexedBg) {
                                actualStyle.backgroundImage = indexedBg;
                                lastIndexedBgRef.current = indexedBg;
                            }
                        }
                    } else if (actualStyle.backgroundImage && actualStyle.backgroundImage.startsWith('data:')) {
                        // Se por algum motivo veio no localstorage, atualizamos o cache
                        lastIndexedBgRef.current = actualStyle.backgroundImage;
                    }

                    setPreviewSettings((prev: any) => {
                        if (JSON.stringify(prev) === JSON.stringify(actualStyle)) return prev;
                        return actualStyle;
                    });
                } catch (e) { }
            }
        };

        // Resetar cache se o storage mudar externamente (ex: abrir editor)
        const handleStorage = () => { lastSettingsRawRef.current = ''; lastIndexedBgRef.current = null; loadSettings(); };
        const handleBackground = () => { lastIndexedBgRef.current = null; loadSettings(); };

        // NOVO: Ouvir evento de sync forçado vindo do BibleProjection
        // NOVO: Ouvir evento de sync forçado vindo do BibleProjection
        const handleForceSync = (e: any) => {
            // Logs removed for performance
            const payload = e.detail;
            if (payload) {
                const style = payload.style || payload;
                setPreviewSettings(style);

                // SYNC: Recebe cortes exatos
                if (payload.slides && Array.isArray(payload.slides)) {
                    manualSlidesRef.current = payload.slides;
                }

                // Sincroniza Texto e Index se vier do Editor
                if (payload.verseText) {
                    setActiveSlide(prev => {
                        if (prev?.text === payload.verseText && prev?.ref === payload.reference) return prev;
                        return { text: payload.verseText, ref: payload.reference || prev?.ref || '' };
                    });
                }
                if (typeof payload.slideIndex === 'number') {
                    setCurrentPartIndex(payload.slideIndex);
                    ignoreIndexReset.current = true;
                }

                lastSettingsRawRef.current = JSON.stringify(payload);
            }
        };

        const handleProjectSaved = () => {
            // Log removed for performance
            forceSyncNow.current = true;
            setPreviewSettings((prev: any) => ({ ...prev }));
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('local-storage-update', handleStorage);
        window.addEventListener('background-saved', handleBackground);
        window.addEventListener('force-sync-settings', handleForceSync);
        window.addEventListener('project-saved', handleProjectSaved);

        loadSettings();
        const interval = setInterval(loadSettings, 2000);
        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('local-storage-update', handleStorage);
            window.removeEventListener('background-saved', handleBackground);
            window.removeEventListener('force-sync-settings', handleForceSync);
            window.removeEventListener('project-saved', handleProjectSaved);
        };
    }, []);

    // ========== QUICK SEARCH MODAL ==========
    const [quickSearch, setQuickSearch] = useState({
        visible: false,
        stage: 'book' as 'book' | 'chapter' | 'verse',
        input: '',
        matchedBook: null as { id: string, name: string, abbr: string } | null,
        selectedChapter: null as number | null,
        chapterCount: 0,
        verseCount: 0,
        error: ''
    });

    // Normalize text: remove accents, spaces, and convert to uppercase for comparison
    const normalizeText = (text) => {
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '')  // Remove all spaces
            .toUpperCase();
    };


    // Quick Search: Keyboard Handler
    const [shortcutsEnabled, setShortcutsEnabled] = useState(false);

    // Initial Load & Listen for Toggle
    useEffect(() => {
        const load = () => {
            const pref = localStorage.getItem('bible_shortcuts_enabled') === 'true';
            setShortcutsEnabled(pref);
        };
        load();
        const handler = (e: any) => setShortcutsEnabled(e.detail);
        window.addEventListener('bible-shortcuts-toggle', handler);
        return () => window.removeEventListener('bible-shortcuts-toggle', handler);
    }, []);

    useEffect(() => {
        const handleQuickSearchKey = async (e: KeyboardEvent) => {
            // Ignore if typing in input fields
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            // ESC: Close modal (Funcionamento Global)
            if (e.key === 'Escape' && quickSearch.visible) {
                setQuickSearch(prev => ({ ...prev, visible: false, input: '', stage: 'book', error: '' }));
                return;
            }

            // CRITICAL: SE ATALHOS ESTIVEREM DESATIVADOS, PARE AQUI.
            // (Mas somente se o modal NÃO ESTIVER ABERTO. Se estiver, o usuário precisa conseguir digitar).
            if (!shortcutsEnabled && !quickSearch.visible) {
                return;
            }

            // If modal is NOT visible, check for letter keys to open it
            if (!quickSearch.visible) {

                if (e.key.length === 1 && /[a-zA-Z0-9áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(e.key)) {
                    e.preventDefault();
                    const char = e.key.toUpperCase();
                    const bookList = Object.entries(BIBLE_BOOKS_DATA).map(([id, data]) => ({ id, ...data }));
                    const isNtOnly = NT_ONLY_VERSIONS.includes(currentVersion) || currentVersion === 'PORARA' || currentVersion === 'PORARC';
                    let availableBooks = bookList;
                    if (isNtOnly) {
                        availableBooks = bookList.filter(b => !OLD_TESTAMENT_BOOKS.has(b.id));
                    }
                    let matches = availableBooks.filter(b =>
                        normalizeText(b.name).startsWith(normalizeText(char)) ||
                        normalizeText(b.abbr).startsWith(normalizeText(char))
                    );
                    // SMART FILTER: If user typed accent, refine matches
                    if (/[áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(char)) {
                        matches = matches.filter(b =>
                            b.name.toUpperCase().startsWith(char) ||
                            b.abbr.toUpperCase().startsWith(char)
                        );
                    }

                    if (matches.length === 1) {
                        const match = matches[0];
                        setSelectedBookId(match.id);
                        YouVersionClient.getChapters(currentVersion, match.id).then(chapters => {
                            setChapterList(chapters);
                            setQuickSearch({
                                visible: true,
                                stage: 'chapter',
                                input: '',
                                matchedBook: match,
                                selectedChapter: null,
                                chapterCount: chapters.length,
                                verseCount: 0,
                                error: ''
                            });
                        });
                    } else {
                        setQuickSearch({
                            visible: true,
                            stage: 'book',
                            input: char,
                            matchedBook: matches[0] || null,
                            allMatches: matches,
                            selectedChapter: null,
                            chapterCount: 0,
                            verseCount: 0,
                            error: matches.length === 0 ? 'Livro não encontrado' : ''
                        });
                    }
                }
                return;
            }

            // Modal IS visible - handle input based on stage
            if (quickSearch.stage === 'book') {
                if (e.key === 'Backspace') {
                    e.preventDefault();
                    const newInput = quickSearch.input.slice(0, -1);
                    if (newInput === '') {
                        setQuickSearch(prev => ({ ...prev, visible: false, input: '', error: '' }));
                    } else {
                        const bookList = Object.entries(BIBLE_BOOKS_DATA).map(([id, data]) => ({ id, ...data }));
                        const match = bookList.find(b =>
                            normalizeText(b.name).startsWith(normalizeText(newInput)) ||
                            normalizeText(b.abbr).startsWith(normalizeText(newInput))
                        );
                        setQuickSearch(prev => ({ ...prev, input: newInput, matchedBook: match || null, error: match ? '' : 'Livro não encontrado' }));
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (quickSearch.matchedBook) {
                        // Move to Chapter stage - fetch chapter count
                        // OPTIMIZATION: Use static chapter count if available (Instant Transition)
                        const staticChapters = (quickSearch.matchedBook as any).chapters || 0;

                        // SYNC: Ensure main Grid updates silently so visual feedback is correct
                        YouVersionClient.getChapters(currentVersion, quickSearch.matchedBook.id).then(setChapterList).catch(() => { });

                        if (staticChapters > 0) {
                            setQuickSearch(prev => ({
                                ...prev,
                                stage: 'chapter',
                                input: '',
                                chapterCount: staticChapters,
                                error: ''
                            }));
                        } else {
                            try {
                                const chapters = await YouVersionClient.getChapters(currentVersion, quickSearch.matchedBook.id);
                                setChapterList(chapters); // Also sync here
                                setQuickSearch(prev => ({
                                    ...prev,
                                    stage: 'chapter',
                                    input: '',
                                    chapterCount: chapters.length,
                                    error: ''
                                }));
                            } catch (err) {
                                setQuickSearch(prev => ({ ...prev, error: 'Erro ao carregar capítulos' }));
                            }
                        }
                    }
                } else if (e.key.length === 1 && /[a-zA-Z0-9áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(e.key)) {
                    e.preventDefault();
                    const newInput = quickSearch.input + e.key.toUpperCase();
                    const bookList = Object.entries(BIBLE_BOOKS_DATA).map(([id, data]) => ({ id, ...data }));
                    const isNtOnly = NT_ONLY_VERSIONS.includes(currentVersion) || currentVersion === 'PORARA' || currentVersion === 'PORARC';
                    let availableBooks = bookList;
                    if (isNtOnly) {
                        availableBooks = bookList.filter(b => !OLD_TESTAMENT_BOOKS.has(b.id));
                    }
                    let matches = availableBooks.filter(b =>
                        normalizeText(b.name).startsWith(normalizeText(newInput)) ||
                        normalizeText(b.abbr).startsWith(normalizeText(newInput))
                    );
                    // SMART FILTER: If user typed accent, refine matches to auto-advance specific books (e.g. "JÓ" vs "Jonas")
                    if (/[áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(newInput)) {
                        matches = matches.filter(b =>
                            b.name.toUpperCase().startsWith(newInput) ||
                            b.abbr.toUpperCase().startsWith(newInput)
                        );
                    }

                    if (matches.length === 1) {
                        const match = matches[0];
                        setSelectedBookId(match.id);

                        // OPTIMIZATION: Instant Transition using static data
                        const staticChapters = (match as any).chapters || 0;
                        if (staticChapters > 0) {
                            setQuickSearch(prev => ({
                                ...prev,
                                stage: 'chapter',
                                input: '',
                                matchedBook: match,
                                chapterCount: staticChapters,
                                error: ''
                            }));
                            // Background fetch for grid
                            YouVersionClient.getChapters(currentVersion, match.id).then(setChapterList).catch(() => { });
                        } else {
                            YouVersionClient.getChapters(currentVersion, match.id).then(chapters => {
                                setChapterList(chapters);
                                setQuickSearch(prev => ({
                                    ...prev,
                                    stage: 'chapter',
                                    input: '',
                                    matchedBook: match,
                                    chapterCount: chapters.length,
                                    error: ''
                                }));
                            });
                        }
                    } else {
                        setQuickSearch(prev => ({
                            ...prev,
                            input: newInput,
                            matchedBook: matches[0] || null,
                            allMatches: matches,
                            error: matches.length === 0 ? 'Livro não encontrado' : ''
                        }));
                    }
                }
            } else if (quickSearch.stage === 'chapter') {
                if (e.key === 'Backspace') {
                    e.preventDefault();
                    const newInput = quickSearch.input.slice(0, -1);
                    setQuickSearch(prev => ({ ...prev, input: newInput, error: '' }));
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const chapterNum = parseInt(quickSearch.input);
                    if (chapterNum > 0 && chapterNum <= quickSearch.chapterCount) {
                        // Move to Verse stage - fetch verse count
                        try {
                            const verses = await YouVersionClient.getPassage(currentVersion, `${quickSearch.matchedBook!.id}.${chapterNum}`);
                            // --- ROBUST PARSER (COPIED FROM loadChapterText) ---
                            // This ensures verse count is accurate even for complex HTML from YouVersion
                            let cleanHtml = (verses.content || verses.data?.content || '')
                                .replace(/<span[^>]*class=\"[^\"]*(?:label|v|verse|verse-number|versenum|num|chapternum)[^\"]*\"[^>]*>([\d]+(?:[\-\u2013][\d]+)?)<\/span>/gi, '___V$1___')
                                .replace(/<span[^>]*class=\"[^\"]*yv-v[^\"]*\"[^>]*v=\"([\d]+(?:[\-\u2013][\d]+)?)\"[^>]*>/gi, '___V$1___')
                                .replace(/data-usfm=\"[^\"]+\.[^"]+\.([\d]+(?:[\-\u2013][\d]+)?)\"/gi, 'data-v=\"$1\"');

                            let txt = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                            const parts = txt.split('___V');
                            let maxVerse = 0;

                            parts.forEach((part: string) => {
                                const match = part.match(/^([\d\-\u2013]+)___/);
                                if (match) {
                                    const ref = match[1];
                                    if (ref.match(/[\-\u2013]/)) {
                                        const rangeParts = ref.split(/[\-\u2013]/);
                                        const end = parseInt(rangeParts[1]);
                                        if (!isNaN(end)) maxVerse = Math.max(maxVerse, end);
                                    } else {
                                        const val = parseInt(ref);
                                        if (!isNaN(val)) maxVerse = Math.max(maxVerse, val);
                                    }
                                }
                            });

                            // Fallback if regex failed completely (e.g. plain text or different format)
                            if (maxVerse === 0) {
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = verses.content || verses.data?.content || '';
                                const legacyCount = tempDiv.querySelectorAll('[data-usfm]').length;
                                maxVerse = legacyCount > 0 ? legacyCount : 176; // Fallback to 176 (Psalm 119)
                            }

                            const verseCount = maxVerse > 0 ? maxVerse : 176; // Always allow navigation up to 176 if uncertain

                            setQuickSearch(prev => ({
                                ...prev,
                                stage: 'verse',
                                input: '',
                                selectedChapter: chapterNum,
                                verseCount: verseCount,
                                error: ''
                            }));
                        } catch (err) {
                            console.error('QuickSearch Error:', err);
                            setQuickSearch(prev => ({ ...prev, error: 'Erro ao carregar versículos' }));
                        }
                    } else {
                        setQuickSearch(prev => ({ ...prev, error: 'Capítulo não encontrado' }));
                    }
                } else if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                    e.preventDefault();
                    const newInput = quickSearch.input + e.key;
                    setQuickSearch(prev => ({ ...prev, input: newInput, error: '' }));
                }
            } else if (quickSearch.stage === 'verse') {
                if (e.key === 'Backspace') {
                    e.preventDefault();
                    const newInput = quickSearch.input.slice(0, -1);
                    setQuickSearch(prev => ({ ...prev, input: newInput, error: '' }));
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const verseNum = parseInt(quickSearch.input);
                    // FORCE NAVIGATION: Allow if number is valid, ignore count validation if it seems wrong (e.g. 0)
                    const safeCount = quickSearch.verseCount > 0 ? quickSearch.verseCount : 200;
                    if (verseNum > 0 && (verseNum <= safeCount || safeCount === 200)) {
                        // Execute: Load the verse
                        const bookId = quickSearch.matchedBook!.id;
                        const chapter = quickSearch.selectedChapter!;
                        const chapId = `${bookId}.${chapter}`;

                        // LIGHTNING FAST: Update UI states IMMEDIATELY (no waiting)
                        setSelectedBookId(bookId);
                        setSelectedChapterId(chapId);

                        // Close modal INSTANTLY
                        setQuickSearch({
                            visible: false,
                            stage: 'book',
                            input: '',
                            matchedBook: null,
                            selectedChapter: null,
                            chapterCount: 0,
                            verseCount: 0,
                            error: ''
                        });

                        // PARALLEL LOADING: Fire all requests at once (don't wait)
                        // 1. Load chapter list for grid (background)
                        YouVersionClient.getChapters(currentVersion, bookId)
                            .then(setChapterList)
                            .catch(() => { });

                        // 2. Load chapter text for verse list (background)
                        loadChapterText(bookId, chapId);

                        // 3. Load and project the specific verse (background)
                        YouVersionClient.getPassage(currentVersion, chapId)
                            .then(result => {
                                if (result && (result.content || result.data?.content)) {
                                    const html = result.content || result.data.content;
                                    const tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = html;

                                    // V112: SUPER ROBUST VERSE EXTRACTOR FOR QUICK SEARCH
                                    let verseText = '';
                                    let found = false;

                                    // 1. Try standard USFM selector (Most reliable for Almeida/NVI)
                                    const verseEl = tempDiv.querySelector(`[data-usfm*=".${verseNum}"]`);
                                    if (verseEl) {
                                        verseText = verseEl.textContent?.trim() || '';
                                        found = true;
                                    }

                                    // 2. Try YouVersion specific classes (label, v, verse) - For YV API
                                    if (!found) {
                                        // Find the span containing the verse number
                                        const spans = Array.from(tempDiv.querySelectorAll('.label, .v, .verse, .chapternum, .num'));
                                        const target = spans.find(s => s.textContent?.trim() === String(verseNum));

                                        if (target) {
                                            found = true;
                                            // The text is usually in siblings until the next verse number
                                            let current = target.nextSibling;
                                            while (current) {
                                                if (current.nodeType === Node.TEXT_NODE) {
                                                    verseText += current.textContent || '';
                                                } else if (current.nodeType === Node.ELEMENT_NODE) {
                                                    const el = current as HTMLElement;
                                                    // Stop if next verse marker found
                                                    if (el.classList.contains('label') || el.classList.contains('v') || el.classList.contains('verse') || el.getAttribute('data-usfm')) {
                                                        break;
                                                    }
                                                    verseText += el.textContent || ' ';
                                                }
                                                current = current.nextSibling;
                                            }
                                        }
                                    }

                                    // 3. Try data-v attribute (Alternative YV format)
                                    if (!found) {
                                        const vEl = tempDiv.querySelector(`[data-v="${verseNum}"]`);
                                        if (vEl) {
                                            verseText = vEl.textContent || '';
                                            found = true;
                                        }
                                    }

                                    // 4. Last Resort: Text Content Regex (Risky but better than nothing)
                                    if (!found) {
                                        const fullText = tempDiv.textContent || '';
                                        // Regex to find "N text... (N+1)" - Adjusted to accept optional whitespace (\s*)
                                        // Some browsers concatenate "1" and "Text" as "1Text"
                                        const regex = new RegExp(`\\b${verseNum}\\s*([^\\d]+)(?:\\d+|$)`, 'i');
                                        const match = fullText.match(regex);
                                        if (match && match[1]) {
                                            verseText = match[1];
                                            found = true;
                                        }
                                    }

                                    if (found && verseText) {
                                        // Clean verse number if still present at start
                                        const cleanText = verseText.replace(/^\d+\s*/, '').replace(/\s+/g, ' ').trim();
                                        const bookName = BIBLE_BOOKS_DATA[bookId]?.name || bookId;
                                        const ref = `${bookName} ${chapter}:${verseNum}`;

                                        setActiveSlide({
                                            text: cleanText,
                                            ref,
                                            copyright: result.copyright || ''
                                        });
                                        setIsProjectionVisible(true);
                                    } else {
                                        // Feedback if verse not found in text
                                        console.warn(`[QuickSearch] Verse ${verseNum} not found in HTML text.`);
                                        // Optional: Show "Versículo não localizado no texto" on UI or Project entire chapter?
                                        // Better to do nothing than project wrong text.
                                    }
                                }
                            })
                            .catch(err => console.error('Error loading verse:', err));
                    } else {
                        setQuickSearch(prev => ({ ...prev, error: 'Versículo não encontrado' }));
                    }
                } else if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                    e.preventDefault();
                    const newInput = quickSearch.input + e.key;
                    setQuickSearch(prev => ({ ...prev, input: newInput, error: '' }));
                }
            }
        };

        window.addEventListener('keydown', handleQuickSearchKey);
        return () => window.removeEventListener('keydown', handleQuickSearchKey);
    }, [quickSearch, currentVersion, shortcutsEnabled]);

    // REAGIR AO CARREGAMENTO DE PROJETO (SEM RELOAD)
    useEffect(() => {
        const handleProjectLoaded = () => {
            // Log removed for performance
            // 1. Atualizar Settings
            const savedSettings = localStorage.getItem('bible_settings');
            if (savedSettings) {
                try { setPreviewSettings(JSON.parse(savedSettings)); } catch (e) { }
            }
            // 2. Atualizar Versão
            const savedVersion = localStorage.getItem('bible_version');
            if (savedVersion) {
                setCurrentVersion(savedVersion);
            }

            // FORÇA SYNC IMEDIATO (Garante que a projeção receba o novo tema/fundo)
            lastBroadcastStyleRef.current = ''; // Invalida cache de envio
            lastSentStyleRef.current = ''; // Força envio do novo estilo
            forceSyncNow.current = true;
        };
        window.addEventListener('project-loaded', handleProjectLoaded);
        return () => window.removeEventListener('project-loaded', handleProjectLoaded);
    }, []);

    // REAGIR AO TOGGLE DE MODO MOBILE/DESKTOP
    useEffect(() => {
        const handleModeToggle = (e: any) => {
            const isMobile = e.detail;
            setMobileMode(isMobile);

            // V40: AUTHORIZATION CONTROL
            // Desktop controla QUEM tem permissão de falar
            if (isMobile) {
                // Ativou Mobile: Envia pacote de AUTORIZAÇÃO
                if (sendState) {
                    // V109: FORCE RESET when switching to Mobile (Clear Desktop Cache)
                    sendState({
                        master: 'mobile',
                        timestamp: Date.now(),
                        source: 'desktop',
                        verseText: '',      // Clear Text
                        reference: ''       // Clear Ref
                    } as any);

                    // Also hide local projection instantly to give feedback
                    setIsProjectionVisible(false);
                }
            } else {
                // Ativou Desktop:
                setActivatingDesktop(true); // V65: Ativa Splash Screen Central
                forceLocalOverride.current = true; // V67: Força override de timestamp no Receiver (Time Travel Fix)

                // V110: FORCE RESET PROJECTOR when returning to Desktop (Clear Mobile Cache)
                if (sendState) {
                    sendState({
                        master: 'desktop',
                        timestamp: Date.now(),
                        source: 'desktop',
                        verseText: '', // Clear visuals first
                        reference: ''
                    } as any);
                }

                // Força reenvio imediato do conteúdo atual
                lastBroadcastStyleRef.current = '';
                lastSentStyleRef.current = ''; // Força envio do estilo completo após reset
                forceSyncNow.current = true;
            }
        };
        window.addEventListener('mobile-mode-toggle', handleModeToggle);

        // SEMPRE INICIA DESATIVADO (Modo Desktop)
        localStorage.setItem('mobileMode', 'false');
        setMobileMode(false);

        return () => window.removeEventListener('mobile-mode-toggle', handleModeToggle);
    }, []);


    // --- SINCRONIZAÇÃO COM API DE PROJEÇÃO EXTERNA (SUPABASE REALTIME) ---
    // V66: SENDER não precisa de Realtime Channel (usa REST). Economiza 1 conexão.
    const { sendState } = useProjectionSync('sender', undefined, false);

    // SYNC RECEIVER (Ouvir Mobile/Outros PCs)
    const lastIncomingSequenceId = useRef(0);

    // V66: RECEIVER só conecta no Supabase se MobileMode estiver ativo.
    // Enquanto estiver usando só o PC, não gasta conexão (Escala Infinita).
    useProjectionSync('receiver', (data: any) => {
        if (!data || data.timestamp === 0) return;

        // Se NÃO estiver em Modo Mobile, ignora ABSOLUTAMENTE TUDO.
        // O Desktop é o Mestre. Ninguém manda nele.
        if (!mobileMode) return;

        // V54: Proteção contra Ecos e Pacotes Antigos no Preview
        if (data.sequenceId && data.sequenceId <= lastIncomingSequenceId.current) {
            return;
        }
        if (data.sequenceId) {
            lastIncomingSequenceId.current = data.sequenceId;
        }

        // Evitar Echo (Se o update for igual ao atual, ignora)
        if (activeSlide && data.reference === activeSlide.ref && data.verseText === activeSlide.text && data.slideIndex === currentPartIndex) {
            return;
        }

        // Marca flags para impedir loop de envio e reset de índice
        isRemoteUpdate.current = true;
        ignoreIndexReset.current = true;

        if (typeof data.verseText === 'string') {
            // Se texto vier vazio, significa PARAR PROJEÇÃO
            if (data.verseText === '') {
                setIsProjectionVisible(false);
            } else {
                // Texto presente: Ligar Projeção e Atualizar Slide
                // Log removed for performance
                setIsProjectionVisible(true);
                setActiveSlide({ text: data.verseText, ref: data.reference || '' });
                if (typeof data.slideIndex === 'number') {
                    setCurrentPartIndex(data.slideIndex);
                }
            }
        }
    }, mobileMode);

    // Listener para abrir editor via Menu
    useEffect(() => {
        const handler = () => setIsEditorOpen(true);
        window.addEventListener('open-projection-editor', handler);
        return () => window.removeEventListener('open-projection-editor', handler);
    }, []);

    useEffect(() => {
        // BLOQUEIO DE LOOP (Se o update veio de fora, não envia de volta)
        if (isRemoteUpdate.current) {
            isRemoteUpdate.current = false;
            return;
        }

        // BLOQUEIO: Se estiver em Modo Mobile, NÃO envia (só recebe)
        if (mobileMode) return;

        const syncToApi = async () => {
            const shouldShow = activeSlide && isProjectionVisible;

            // Sempre envia a imagem completa (Base64 ou URL) para garantir que apareça na projeção
            let styleToSync = previewSettings ? { ...previewSettings } : {};

            // FIX CRÍTICO (V97): Remover refContent estático do style.
            // Se o editor estiver fechado, refContent no localStorage é lixo antigo (ex: "Gênesis").
            // Ao deletar, forçamos a projeção a usar a 'reference' dinâmica do payload (ex: "Apocalipse").
            if (styleToSync.refContent) delete styleToSync.refContent;

            // OTIMIZAÇÃO CRÍTICA: Se for Base64 Grande e estivermos no Desktop (Tauri),
            // fazemos upload local e enviamos apenas a URL. Isso evita travar o mobile/rede.
            try {
                const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
                if (isTauri && styleToSync.backgroundImage && styleToSync.backgroundImage.startsWith('data:')) {

                    // Verifica se já fizemos upload dessa imagem para não repetir
                    const bgSignature = styleToSync.backgroundImage.substring(0, 100) + styleToSync.backgroundImage.length;
                    const w = window as any;

                    if (w.lastUploadedSignature === bgSignature && w.lastUploadedUrl) {
                        styleToSync.backgroundImage = w.lastUploadedUrl;
                    } else {
                        // Faz Upload
                        const url = await invoke('save_image_to_app_data', {
                            filename: 'projection_bg.png',
                            base64Data: styleToSync.backgroundImage
                        }) as string;

                        if (url) {
                            w.lastUploadedSignature = bgSignature;
                            w.lastUploadedUrl = url;
                            styleToSync.backgroundImage = url;
                        }
                    }
                }
            } catch (e) {
                console.error("Falha ao otimizar imagem:", e);
                // Falha silenciosa: envia Base64 mesmo
            }

            // Gera um ID único para esta sessão (se não existir)
            if (!(window as any).senderId) {
                (window as any).senderId = Math.random().toString(36).substring(2) + Date.now().toString(36);
            }

            // V53: Serialização de Comandos
            // V64: Usar Timestamp como SequenceID para evitar conflito ao trocar de Mobile -> Desktop
            // (Se o mobile mandou 100 updates, o contador do desktop estava no 10. Ao voltar, o receiver ignorava.
            //  Com Date.now(), o desktop sempre ganha pois está no presente).
            const newSequenceId = Date.now();
            sequenceIdRef.current = newSequenceId;

            // CRITICAL FIX: Incrementa bgVersion quando o versículo muda (para resetar GIF)
            // Use GLOBAL counter like Mobile Does to prevent stale state issues
            let globalBgVersion = (window as any).globalBgVersion || styleToSync.bgVersion || 0;

            const currentRef = shouldShow ? activeSlide.ref : '';
            const lastSentRef = (window as any).lastSentVerseRef || '';

            if (currentRef && currentRef !== lastSentRef) {
                // Novo versículo detectado -> Incrementa bgVersion GLOBALMENTE
                globalBgVersion++;
                (window as any).globalBgVersion = globalBgVersion;
                (window as any).lastSentVerseRef = currentRef;

                styleToSync.bgVersion = globalBgVersion;

                // CRITICAL: Salva bgVersion no localStorage para persistir
                try {
                    const saved = localStorage.getItem('bible_settings');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        parsed.style = parsed.style || {};
                        parsed.style.bgVersion = globalBgVersion;
                        localStorage.setItem('bible_settings', JSON.stringify(parsed));
                    }
                    // Atualiza o state local também para não perder sync
                    setPreviewSettings((prev: any) => ({ ...prev, bgVersion: globalBgVersion }));
                } catch (e) {
                    console.error('[BibleSearch] Erro ao salvar bgVersion:', e);
                }

                console.log('[BibleSearch] Novo versículo:', currentRef, '-> bgVersion:', globalBgVersion);
            } else {
                // Se for o mesmo versículo, garante que envie o último bgVersion válido
                if (globalBgVersion > (styleToSync.bgVersion || 0)) {
                    styleToSync.bgVersion = globalBgVersion;
                }
            }

            const payload = {
                verseText: shouldShow ? activeSlide.text : '',
                reference: shouldShow ? activeSlide.ref : '',
                copyright: shouldShow ? activeSlide.copyright : '',
                slideIndex: currentPartIndex,
                version: currentVersion,
                style: styleToSync,
                timestamp: Date.now(),
                senderId: (window as any).senderId, // Identifica QUEM enviou
                source: 'desktop' as 'desktop', // Identifica o TIPO de aparelho
                master: 'desktop' as 'desktop', // V38: ATOMIC UNLOCK
                sequenceId: newSequenceId, // V64: Timestamp-based ID
                force: forceLocalOverride.current // V67: Flag para receiver ignorar timestamp antigo do mobile
            };

            // Consome a flag
            if (forceLocalOverride.current) forceLocalOverride.current = false;

            // Evita enviar se for exatamente o mesmo payload (exceto timestamp)
            // Evita enviar se for exatamente o mesmo payload (exceto timestamp)
            const payloadNoTs = { ...payload, timestamp: 0 };
            if (JSON.stringify(payloadNoTs) === lastBroadcastStyleRef.current) {
                setActivatingDesktop(false); // Já está syncado
                return;
            }
            lastBroadcastStyleRef.current = JSON.stringify(payloadNoTs);

            // V60: ESTRATÉGIA DE ESCALA (ZERO EGRESS DESNECESSÁRIO)
            // 1. stripStyleForCloud: true -> Nunca envia imagem gigante pro Supabase. O celular só precisa do texto.
            // 2. forceLocalOnly: !mobileMode -> Se o desktop está no comando, NÃO envia nada pro Supabase (Zero Requests).
            //    O celular só começa a receber dados quando ELE assume o controle (mobileMode = true).
            sendState(payload, {
                forceLocalOnly: !mobileMode,
                stripStyleForCloud: true
            });

            setActivatingDesktop(false); // V43: Envio concluído
        };

        // V39: Se forceSyncNow estiver ativo, executa IMEDIATAMENTE (sem debounce)
        if (forceSyncNow.current) {
            forceSyncNow.current = false;
            syncToApi();
            return;
        }

        const timer = setTimeout(syncToApi, 100); // Pequeno debounce para não travar
        return () => clearTimeout(timer);
    }, [activeSlide, currentPartIndex, previewSettings, currentVersion, isProjectionVisible, mobileMode]);


    // Helper de Fontes (Igual Projeção) - Garante consistência de métricas
    const normalizeFont = (fontCtx: string) => {
        if (!fontCtx) return 'inherit';
        if (fontCtx.includes('NewBlack')) return 'NewBlackTypeface, sans-serif';
        return fontCtx;
    };

    // Quebra de Texto (Atualizado)
    // Quebra de Texto (Atualizado - V107 Sync Geometric)
    useEffect(() => {
        // SYNC PRIORITY: Se receber slides prontos do editor, usa eles (Pixel Perfect)
        if (manualSlidesRef.current) {
            // Debug log removed for performance
            setSlideParts(manualSlidesRef.current);
            manualSlidesRef.current = null;
            if (!ignoreIndexReset.current) setCurrentPartIndex(0);
            ignoreIndexReset.current = false;
            return;
        }

        if (activeSlide?.text) {
            // CRITICAL FIX: Se previewSettings está null, carrega AGORA de forma síncrona
            let style = previewSettings;
            if (!style || Object.keys(style).length === 0) {
                // Warn removed for performance - loading from localStorage
                try {
                    const saved = localStorage.getItem('bible_settings');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        style = parsed.style || parsed;
                        setPreviewSettings(style); // Atualiza o state para próximas vezes
                    }
                } catch (e) {
                    console.error('[ERROR] Falha ao carregar bible_settings:', e);
                }
            }

            // Se AINDA está vazio, usa defaults
            if (!style) style = {};

            const textBox = style.textBox || { w: 80, h: 40 };
            const fontSize = style.fontSize ? Number(style.fontSize) : 30;
            const fontFamily = style.fontFamily || 'Inter, sans-serif';
            const isBold = style.fontWeight === 'bold';

            const wPx = Math.max(10, ((textBox.w || 80) / 100) * 1024 - 40);
            const hPx = Math.max(10, ((textBox.h || 40) / 100) * 576 - 20);
            const fontName = normalizeFont(fontFamily).replace(/"/g, '');

            // Debug logs removed for performance

            const parts = splitTextGeometrically(
                activeSlide.text,
                wPx,
                hPx,
                fontSize,
                fontName,
                isBold ? 'bold' : 'normal'
            );

            // Debug log removed for performance

            setSlideParts(parts);

            // SMART RESET: Só reseta para 0 se for interação LOCAL.
            // Se for update remoto (Mobile), mantém o índice recebido.
            if (!ignoreIndexReset.current) {
                setCurrentPartIndex(0);
            }
            ignoreIndexReset.current = false;
        } else {
            setSlideParts([]);
        }
    }, [activeSlide, previewSettings]); // Added previewSettings dependency

    useEffect(() => {
        // Debug log removed for performance
        loadVersions();
    }, []);

    // Carregar capítulos e versículos iniciais
    useEffect(() => {
        if (currentVersion && selectedBookId) {
            // Debug log removed for performance
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
            // 1. FAST LOAD: Get Local Versions Only First
            const localVersions = await LocalBibleManager.getLocalVersions();
            // Filtrar duplicados e inválidos
            const validLocals = localVersions.filter(v => v.abbreviation !== 'BLT' && String(v.id) !== '1967');

            // Set Initial State (Immediate Feedback)
            setVersions(validLocals); // Show what we have immediately

            // Check if current version is available locally or default
            const saved = localStorage.getItem('bible_version');
            if (saved && validLocals.some(v => v.id === saved)) {
                setCurrentVersion(saved);
            } else if (validLocals.length > 0) {
                // Saturação temporária se não tiver a salva
                // Mas não mudamos ainda para não pular se a online voltar rápido
            }

            // 2. BACKGROUND LOAD: Try to get complete list (Online)
            // Do not await UI render, but let this run
            YouVersionClient.getVersions().then(fullData => {
                const validAll = fullData.filter(v => v.abbreviation !== 'BLT' && String(v.id) !== '1967');
                setVersions(validAll);

                // Re-check defaults with full list
                if (saved && saved !== '1967') {
                    setCurrentVersion(saved);
                } else {
                    // Fallback logic
                    const nvi = validAll.find(v => v.abbreviation === 'NVI');
                    if (nvi) setCurrentVersion(nvi.id);
                    else {
                        const almeida = validAll.find(v => v.id === 'ALMEIDA_EXTERNA');
                        if (almeida) setCurrentVersion('ALMEIDA_EXTERNA');
                        else if (validAll.length > 0) setCurrentVersion(validAll[0].id);
                    }
                }
            }).catch(err => {
                console.warn('[BibleSearch] Online versions failed, keeping local list.', err);
                // If local list was empty, we need a fallback
                if (validLocals.length === 0) {
                    setCurrentVersion('ALMEIDA_EXTERNA');
                }
            });

        } catch (e) {
            console.error('[ERROR] Failed to load local versions:', e);
            setCurrentVersion('ALMEIDA_EXTERNA');
        }
    };

    const loadChapters = async (bookId: string) => {
        try {
            // Debug logs removed for performance
            const chaps = await YouVersionClient.getChapters(currentVersion, bookId);
            // Debug logs removed for performance
            if (chaps) setChapterList(chaps);
            return chaps;
        } catch (e) {
            console.error('[ERROR] Failed to load chapters:', e);
        }
    };

    const loadChapterText = async (bookId: string, chapId: string) => {
        try {
            console.log(`[loadChapterText] Loading ${currentVersion} ${bookId} ${chapId}`);
            const result = await YouVersionClient.getPassage(currentVersion, chapId);
            console.log(`[loadChapterText] Result:`, result ? 'OK' : 'NULL');

            if (result && (result.content || result.data?.content)) {
                setCurrentCopyright(result.copyright || '');
                const html = result.content || result.data.content;
                console.log(`[loadChapterText] HTML length:`, html?.length || 0);

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;

                // Remove lixo (inclui títulos s1 e h1 que causam bugs em livros numerados ex: 1 João)
                tempDiv.querySelectorAll('.note, .chapter-number, .audio-player, .s1, h1, h2, .r').forEach(n => n.remove());

                const verses: { num: number, text: string }[] = [];

                // --- PARSER VIOLENTO (REGEX MELHORADO - SUPPORT RANGES 15-18) ---
                let cleanHtml = (html || '')
                    .replace(/\<span[^\>]*class=\"[^\"]*(?:label|v|verse|verse-number|versenum|num|chapternum)[^\"]*\"[^\>]*\>([\d]+(?:[\-\u2013][\d]+)?)\<\/span\>/gi, '___V$1___')
                    .replace(/\<span[^\>]*class=\"[^\"]*yv-v[^\"]*\"[^\>]*v=\"([\d]+(?:[\-\u2013][\d]+)?)\"[^\>]*\>/gi, '___V$1___')
                    .replace(/data-usfm=\"[^\"]+\.[^\"]+\.([\d]+(?:[\-\u2013][\d]+)?)\"/gi, 'data-v=\"$1\"');

                let txt = cleanHtml.replace(/\<[^\>]+\>/g, ' ').replace(/\s+/g, ' ').trim();
                const parts = txt.split('___V');
                const versesFound: { num: number, text: string }[] = [];

                parts.forEach((part: string) => {
                    // Match number or range (e.g., "15" or "15-18")
                    const match = part.match(/^([\d\-\u2013]+)___(.*)/);
                    if (match) {
                        const ref = match[1];
                        let text = match[2].trim();
                        text = text.replace(/^[\d\-\u2013]+\s+/, '').trim();
                        text = text.replace(/Copyright.*/gi, '').trim();

                        if (text) {
                            // Check for Range (e.g. 15-18)
                            if (ref.match(/[\-\u2013]/)) {
                                const rangeParts = ref.split(/[\-\u2013]/);
                                const start = parseInt(rangeParts[0]);
                                const end = parseInt(rangeParts[1]);
                                if (!isNaN(start) && !isNaN(end) && end >= start) {
                                    for (let k = start; k <= end; k++) {
                                        versesFound.push({ num: k, text: text });
                                    }
                                } else if (!isNaN(start)) {
                                    versesFound.push({ num: start, text: text });
                                }
                            } else {
                                // Single Verse
                                const num = parseInt(ref);
                                if (num > 0) versesFound.push({ num, text });
                            }
                        }
                    } else {
                        // Fallback Regex for raw text lines (less common now)
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

                console.log(`[loadChapterText] Verses found:`, versesFound.length);

                if (versesFound.length > 0) {
                    versesFound.sort((a, b) => a.num - b.num);
                    const unique = versesFound.filter((v, i, a) => a.findIndex(t => t.num === v.num) === i);
                    setPreviewVerses(unique);
                } else {
                    console.warn(`[loadChapterText] NO VERSES FOUND for ${currentVersion} ${chapId}`);
                    setPreviewVerses([{ num: 0, text: `Texto indisponível para ${bookId} ${chapId}. Verifique se o download foi concluído corretamente.` }]);
                }

            } else {
                console.error(`[loadChapterText] NO RESULT for ${currentVersion} ${chapId}`);
                setPreviewVerses([{ num: 0, text: `Capítulo não encontrado. Verifique se a Bíblia foi baixada corretamente.` }]);
            }
        } catch (e) {
            console.error('[loadChapterText] ERROR:', e);
            setPreviewVerses([{ num: 0, text: `Erro ao carregar: ${e instanceof Error ? e.message : 'Erro desconhecido'}` }]);
        }
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
        // Remove verse numbers from text (e.g., "22 E Obede..." -> "E Obede...")
        const cleanedText = v.text.replace(/^\d+\s*/, '').trim();

        setActiveSlide({ text: cleanedText, ref, copyright: currentCopyright });
        setIsProjectionVisible(true);
    };

    const handleDownloadVersion = async (versionId?: string) => {
        const targetId = versionId || currentVersion;
        // Garantir comparação type-safe (string vs string)
        const meta = versions.find(v => String(v.id) === String(targetId));

        if (downloadStatus.downloading) {
            if (confirm("Deseja cancelar o download em andamento?")) {
                abortControllerRef.current = true;
            }
            return;
        }

        if (!confirm(`Deseja baixar a versão ${targetId} completa para uso offline?\n\nIsso pode levar alguns minutos dependendo da sua internet. O app continuará funcionando durante o download.`)) return;

        setDownloadStatus({ downloading: true, progress: 0, message: 'Iniciando...', currentId: targetId });
        abortControllerRef.current = false;

        try {
            await YouVersionClient.downloadVersion(
                targetId,
                (msg, pct) => setDownloadStatus(prev => ({ ...prev, downloading: true, progress: pct, message: msg })),
                () => abortControllerRef.current,
                meta
            );
            if (!abortControllerRef.current) {
                // alert('Download concluído com sucesso! A versão agora está disponível offline.');
                setDownloadedVersions(prev => [...prev, targetId]);
                // Force reload to ensure UI consistency
                setTimeout(() => loadVersions(), 500);
            }
        } catch (e: any) {
            console.error('Download error:', e);
            if (!abortControllerRef.current) {
                alert(`Erro ao baixar versão: ${e.message || 'Verifique sua conexão ou tente novamente.'}`);
            }
        } finally {
            setDownloadStatus({ downloading: false, progress: 0, message: '' });
        }
    };

    // Keyboard Navigation for Slides + Blank Screen
    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            // Slide Navigation
            if (e.key === 'ArrowRight') {
                if (slideParts.length > 1 && currentPartIndex < slideParts.length - 1) {
                    e.preventDefault();
                    setCurrentPartIndex(p => p + 1);
                }
            }
            if (e.key === 'ArrowLeft') {
                if (slideParts.length > 1 && currentPartIndex > 0) {
                    e.preventDefault();
                    setCurrentPartIndex(p => p - 1);
                }
            }

            // Blank Screen (B key or Escape) - Professional Feature
            if (e.key === 'b' || e.key === 'B' || e.key === 'Escape') {
                e.preventDefault();
                setIsProjectionVisible(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [slideParts.length, currentPartIndex]);

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
        <div className="h-screen bg-[#1a1a1a] text-white flex flex-col overflow-hidden font-sans select-none">
            <Head><title>Project Church</title></Head>

            {/* BARRA DE MENU SUPERIOR */}
            <MenuBar />

            <div className="flex-1 flex overflow-hidden">
                {/* COLUNA ESQUERDA FIXA (AGORA SÓ LISTA DE TEXTO) */}
                <div className="w-[450px] min-w-[350px] border-r border-[#333] flex flex-col bg-white text-black shrink-0 relative z-20 shadow-xl transition-all">
                    <div className="p-3 bg-gray-100 border-b border-gray-300 flex justify-between items-center h-12 shrink-0 gap-2">
                        <div className="font-bold text-base text-gray-800 truncate flex-1 min-w-[30%]">
                            {BIBLE_BOOKS_DATA[selectedBookId]?.name} {selectedChapterId.split('.')[1] || ''}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 max-w-[70%]">
                            {/* CUSTOM DROPDOWN REDESIGNED START */}
                            <div className="relative flex-1 min-w-0">
                                <button
                                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                                    className="w-full bg-white border border-gray-300 text-gray-700 text-[11px] font-bold uppercase rounded py-1 px-2 flex justify-between items-center hover:bg-gray-50 transition min-w-[140px]"
                                    title="Selecione a Versão"
                                >
                                    <span className="truncate mr-2">
                                        {(() => {
                                            const v = versions.find(ver => ver.id === currentVersion);
                                            if (!v) return currentVersion;
                                            // Mapping Logic - SAFE ACCESS
                                            const safeAbbr = (v.abbreviation || '').toUpperCase();
                                            const safeId = String(v.id);

                                            let fullName = VERSION_FULL_NAMES[safeAbbr] || VERSION_FULL_NAMES[safeId] || v.local_title || v.name || safeAbbr || safeId;

                                            // Override Specifics
                                            if (safeId === 'PORARA') fullName = 'Almeida Revista e Atualizada (Novo Testamento)';
                                            if (safeId === 'PORARC') fullName = 'Almeida Revista e Corrigida (Novo Testamento)';
                                            if (safeId === 'PORACF') fullName = 'Almeida Corrigida Fiel';
                                            if (safeId === 'PORBBS') fullName = 'Bíblia Sagrada (BBS)';
                                            if (safeId === '129') fullName = 'Nova Versão Internacional';
                                            if (safeId === '1967') fullName = 'O Livro';
                                            if (safeId === '4360') fullName = 'Nova Versão Internacional (PT)';
                                            if (safeId === '215') fullName = 'Almeida Corrigida Fiel (ACF- SBTB)';

                                            // Numeric fallback
                                            if (!isNaN(Number(fullName))) {
                                                if (safeAbbr) fullName = `${safeAbbr} (${safeId})`;
                                                else fullName = `Versão ${safeId}`;
                                            }

                                            return fullName;
                                        })()}
                                    </span>
                                    <svg className={`w-3 h-3 text-gray-500 transition-transform ${isVersionDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* DROPDOWN MENU OVERLAY */}
                                {isVersionDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsVersionDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 mt-1 w-[450px] bg-white border border-gray-300 shadow-2xl rounded-sm max-h-[600px] overflow-y-auto z-50 flex flex-col">

                                            {/* GROUP 1: MOVED TO MAIN LIST */}

                                            {/* GROUP 2: ALL VERSIONS (ONLINE/OFFLINE) */}
                                            <div className="bg-gray-100 px-3 py-2 text-[10px] font-black text-gray-500 border-y border-gray-200 mt-0 sticky top-0">
                                                VERSÕES DISPONÍVEIS
                                            </div>
                                            {(versions || [])
                                                .filter((v, i, a) => v && v.id && String(v.id) !== '1967' && a.findIndex(t => String(t.id) === String(v.id)) === i)
                                                .map(v => {
                                                    try {
                                                        const isInstalled = (downloadedVersions || []).includes(String(v.id));

                                                        // Safe Access
                                                        const safeAbbr = (v.abbreviation || '').toUpperCase();
                                                        const safeName = v.name || '';
                                                        const safeLocalTitle = v.local_title || '';
                                                        const safeId = String(v.id);

                                                        // Name Logic
                                                        let fullName = VERSION_FULL_NAMES[safeAbbr] || VERSION_FULL_NAMES[safeId] || safeLocalTitle || safeName || safeAbbr || safeId;

                                                        // Specific Overrides
                                                        if (safeId === 'PORARA') fullName = 'Almeida Revista e Atualizada (Novo Testamento)';
                                                        if (safeId === 'PORARC') fullName = 'Almeida Revista e Corrigida (Novo Testamento)';
                                                        if (safeId === 'PORACF') fullName = 'Almeida Corrigida Fiel';
                                                        if (safeId === 'PORBBS') fullName = 'Bíblia Sagrada (BBS)';
                                                        if (safeId === '129') fullName = 'Nova Versão Internacional';
                                                        if (safeId === '1967') fullName = 'O Livro';
                                                        if (safeId === '4360') fullName = 'Nova Versão Internacional (PT)';
                                                        if (safeId === '215') fullName = 'Almeida Corrigida Fiel (ACF- SBTB)';

                                                        // Fallback for Numeric Names
                                                        if (!isNaN(Number(fullName))) {
                                                            const tryAbbr = VERSION_FULL_NAMES[safeAbbr];
                                                            if (tryAbbr) {
                                                                fullName = tryAbbr;
                                                            } else if (safeAbbr) {
                                                                fullName = `${safeAbbr} (${safeId})`;
                                                            } else {
                                                                fullName = `Versão ${safeId}`;
                                                            }
                                                        }

                                                        const isDownloadingThis = downloadStatus.downloading && downloadStatus.currentId === v.id;

                                                        return (
                                                            <div
                                                                key={v.id}
                                                                onClick={() => {
                                                                    setCurrentVersion(v.id);
                                                                    localStorage.setItem('bible_version', v.id);
                                                                    setIsVersionDropdownOpen(false);
                                                                }}
                                                                className={`px-3 py-2 text-left text-[11px] font-bold uppercase transition border-b border-gray-100 flex justify-between items-center group cursor-pointer
                                                                ${currentVersion === v.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                                                            >
                                                                <span>{fullName}</span>
                                                                <div className="flex items-center gap-2">
                                                                    {isInstalled && <span className="text-green-500 font-bold text-xs bg-green-100 px-1 rounded">INSTALADA ✓</span>}

                                                                    {!isInstalled && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDownloadVersion(v.id);
                                                                            }}
                                                                            disabled={downloadStatus.downloading}
                                                                            className={`p-1.5 rounded-full hover:bg-gray-200 group-hover:block transition-all ${isDownloadingThis ? 'block' : 'text-gray-400 opacity-60 hover:text-green-600 hover:opacity-100'}`}
                                                                            title="Baixar para Offline"
                                                                        >
                                                                            {isDownloadingThis ? (
                                                                                <span className="text-[9px] font-mono text-blue-600 animate-pulse">{Math.round(downloadStatus.progress)}%</span>
                                                                            ) : (
                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    } catch (err) {
                                                        return null;
                                                    }
                                                })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-400">
                        {previewVerses.length > 0 ? (
                            previewVerses.map(v => {
                                // FIXED: Compare by Reference (Attempt 2)
                                const bookObj = BIBLE_BOOKS_DATA[selectedBookId];
                                const bookName = bookObj ? bookObj.name : selectedBookId;
                                const chapNum = selectedChapterId.includes('.') ? selectedChapterId.split('.')[1] : selectedChapterId;
                                const verseRef = `${bookName} ${chapNum}:${v.num}`;
                                // Robust comparison: Check exact ref OR suffix match (fallback for edge cases)
                                const isSelected = activeSlide?.ref === verseRef || (activeSlide?.ref && activeSlide.ref.endsWith(`:${v.num}`) && activeSlide.ref.includes(bookName));

                                return (
                                    <div
                                        key={v.num}
                                        onClick={() => projectVerse(v)}
                                        className={`flex gap-2 px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition items-start group ${isSelected ? 'bg-blue-500' : ''}`}
                                    >
                                        <span className={`text-xs font-bold w-6 pt-0.5 text-right shrink-0 ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`}>{v.num}</span>
                                        <p className={`text-sm leading-snug ${isSelected ? 'text-white font-semibold' : 'text-gray-600'}`}>{v.text}</p>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-gray-400 text-sm">Carregando...</div>
                        )}
                    </div>

                    {/* Sticky Copyright Footer */}
                    {(getVersionCopyright(currentVersion) || currentCopyright) && (
                        <div className="bg-gray-100 border-t border-gray-300 px-3 py-2 text-[10px] text-gray-600 text-center leading-tight shrink-0 font-medium select-none shadow-[0_-2px_4px_rgba(0,0,0,0.05)] relative z-10">
                            {getVersionCopyright(currentVersion) || currentCopyright}
                        </div>
                    )}
                </div>

                {/* --- COLUNA DIREITA (GRID + LIVE PREVIEW EMBAIXO) --- */}
                <div className="flex-1 flex flex-col bg-[#222] min-w-[600px] overflow-hidden relative">




                    {/* PAINEL LIVROS (Topo - 40%) - LAYOUT ELÁSTICO (Preenchimento Total) */}
                    <div className="h-[40%] bg-zinc-700 p-[1px] overflow-hidden shrink-0 border-b border-[#333]">
                        <div className="grid h-full gap-[1px] bg-zinc-700" style={{ gridTemplateColumns: 'repeat(11, 1fr)', gridAutoRows: 'minmax(0, 1fr)' }}>
                            {BOOK_GROUPS.map(group => {
                                const isNtOnly = NT_ONLY_VERSIONS.includes(currentVersion);
                                const filteredBooks = group.books.filter(b => !isNtOnly || !OLD_TESTAMENT_BOOKS.has(b));
                                if (filteredBooks.length === 0) return null;

                                return filteredBooks.map(bookId => {
                                    const info = BIBLE_BOOKS_DATA[bookId] || { name: bookId, abbr: bookId };
                                    return (
                                        <button
                                            key={bookId}
                                            onClick={() => selectBook(bookId)}
                                            className={`${group.color} text-white w-full h-full flex flex-col border border-black/20 items-center justify-center hover:brightness-110 active:brightness-90 transition-all ${selectedBookId === bookId ? 'ring-2 ring-white z-10 shadow-lg relative' : 'opacity-95'}`}
                                            title={info.name}
                                        >
                                            <span className="text-[13px] font-black leading-none mb-0.5 tracking-tighter">{info.abbr}</span>
                                            <span className="text-[8px] uppercase font-bold opacity-90 leading-none truncate w-full text-center px-0.5 scale-95">{info.name}</span>
                                        </button>
                                    );
                                });
                            })}
                        </div>
                    </div>

                    {/* PAINEL GRIDS (Meio - 30%) */}
                    <div className="h-[30%] flex bg-[#222] border-b border-black shrink-0 text-white">
                        {/* Capítulos - Grid 12 Colunas (Elástico) */}
                        <div className="w-[50%] border-r border-[#111] bg-[#222] flex flex-col shrink-0">
                            <div className="bg-[#1a1a1a] px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0 border-b border-[#333] flex justify-between items-center h-7">
                                <span>Capítulos</span>
                                <span className="bg-gray-800 px-1 rounded text-gray-300">{chapterList.length}</span>
                            </div>
                            <div className="flex-1 p-[1px] overflow-hidden flex flex-col bg-zinc-700">
                                <div className="grid h-full w-full gap-[1px]" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gridAutoRows: 'minmax(0, 1fr)' }}>
                                    {chapterList.map((c, i) => {
                                        const chapNum = (c.human || c.number || (i + 1)).toString();
                                        const isSelected = selectedChapterId.endsWith(`.${chapNum}`) || selectedChapterId === chapNum;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => selectChapter(i)}
                                                className={`w-full h-full text-xs font-bold flex items-center justify-center transition-all border border-black/20 ${isSelected ? 'bg-amber-600 text-white z-10 ring-1 ring-white relative' : 'bg-[#333] text-gray-400 hover:bg-[#444] hover:text-white'}`}
                                            >
                                                {chapNum}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Versículos - Grid 10 Colunas (Elástico) */}
                        <div className="flex-1 bg-[#1e1e1e] flex flex-col min-w-0">
                            <div className="bg-[#1a1a1a] px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0 border-b border-[#333] flex justify-between items-center h-7">
                                <span>Versículos</span>
                                <span className="bg-gray-800 px-1 rounded text-gray-300">{previewVerses.length}</span>
                            </div>
                            <div className="flex-1 p-[1px] overflow-hidden flex flex-col bg-zinc-700">
                                <div className="grid h-full w-full gap-[1px] content-start" style={{ gridTemplateColumns: 'repeat(10, 1fr)', gridAutoRows: 'minmax(0, 1fr)' }}>
                                    {previewVerses.map(v => {
                                        // FIXED: Numeric Grid Highlight logic & Visual Borders
                                        const bookName = BIBLE_BOOKS_DATA[selectedBookId]?.name || selectedBookId;
                                        const chapNum = selectedChapterId.split('.')[1] || selectedChapterId;
                                        const verseRef = `${bookName} ${chapNum}:${v.num}`;
                                        const isSelected = activeSlide?.ref === verseRef;

                                        return (
                                            <button
                                                key={v.num}
                                                onClick={() => projectVerse(v)}
                                                className={`w-full h-full text-xs font-bold flex items-center justify-center transition-all border border-black/20 ${isSelected ? 'bg-blue-600 text-white shadow-lg z-10 ring-1 ring-white relative' : 'bg-[#333] text-gray-400 hover:bg-[#444] hover:text-white'}`}
                                                title={v.text}
                                            >
                                                {v.num}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>


                        </div>
                    </div>

                    {/* PAINEL LIVE PREVIEW (Inferior - 30% - PAN & ZOOM CORIGIDO) */}
                    <div className="flex-1 bg-[#111] flex flex-col min-h-[30%] relative border-t border-[#333]">
                        <div className="bg-[#111] px-4 py-2 flex justify-between items-center border-b border-[#222] h-10 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${isProjectionVisible ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-gray-600'}`}></span>
                                    <span className="text-xs font-medium text-gray-400 tracking-wide uppercase">Retorno (Live)</span>
                                </div>

                                {/* Controles de Slide - REMOVIDOS (Usando Overlay Interno) */}
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setIsProjectionVisible(!isProjectionVisible)}
                                    title="Atalhos: B ou Esc = Pausar/Retomar | ← → = Trocar Slides"
                                    className={`
                                        h-7 px-4 rounded-md text-xs font-bold uppercase tracking-wide transition-all shadow-sm flex items-center justify-center min-w-[130px]
                                        ${isProjectionVisible
                                            ? 'bg-red-600 hover:bg-red-500 text-white'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'}
                                    `}
                                >
                                    {isProjectionVisible ? 'Parar Projeção' : 'Retomar Projeção'}
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
                                                position: 'relative',
                                                transform: 'translate(0px, 0px) scale(0.3)',
                                                transformOrigin: 'center center',
                                                flexShrink: 0,
                                                boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                                                overflow: 'hidden',
                                                transition: 'transform 0.05s linear'
                                            }}
                                        >
                                            {/* BACKGROUND IMAGE LAYER */}
                                            {previewSettings?.backgroundImage && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${(previewSettings as any)?.bgRect?.x || 50}%`,
                                                        top: `${(previewSettings as any)?.bgRect?.y || 50}%`,
                                                        width: `${(previewSettings as any)?.bgRect?.w || 100}%`,
                                                        height: `${(previewSettings as any)?.bgRect?.h || 100}%`,
                                                        transform: 'translate(-50%, -50%)',
                                                        zIndex: 0,
                                                        pointerEvents: 'none'
                                                    }}
                                                >
                                                    <img
                                                        key={`bg-${(previewSettings as any)?.bgVersion || 0}`}
                                                        src={previewSettings.backgroundImage}
                                                        alt="bg"
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    />
                                                </div>
                                            )}

                                            {/* PREVIEW ESTÁTICO (Sem Animação - Agilidade do Operador) */}
                                            {/* Texto Versículo */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    zIndex: 10,
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
                                                    fontFamily: normalizeFont(previewSettings?.fontFamily || 'Inter, sans-serif'),
                                                    fontWeight: previewSettings?.fontWeight || 'normal',
                                                    fontSize: `${previewSettings?.fontSize || 30}px`,
                                                    textTransform: (previewSettings as any)?.textTransform || 'none',
                                                    textShadow: (previewSettings as any)?.textShadowEnabled ? `${(previewSettings as any)?.textShadowX || 2}px ${(previewSettings as any)?.textShadowY || 2}px ${(previewSettings as any)?.textShadowBlur || 4}px ${(previewSettings as any)?.textShadowColor || '#000'}` : 'none',
                                                    WebkitTextStroke: (previewSettings as any)?.textStrokeEnabled ? `${(previewSettings as any)?.textStrokeWidth || 1}px ${(previewSettings as any)?.textStrokeColor || '#000'}` : undefined,
                                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', hyphens: 'auto',
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
                                                    zIndex: 10,
                                                    left: `${(previewSettings as any)?.refPos?.x || 50}%`,
                                                    top: `${(previewSettings as any)?.refPos?.y || 80}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    color: (previewSettings as any)?.refColor || previewSettings?.color || '#ffffff',
                                                    fontFamily: previewSettings?.fontFamily || 'Inter, sans-serif',
                                                    fontSize: `${(previewSettings as any)?.refFontSize || 20}px`,
                                                    fontWeight: 'bold',
                                                    textShadow: (previewSettings as any)?.refShadowEnabled ? `${(previewSettings as any)?.refShadowX || 2}px ${(previewSettings as any)?.refShadowY || 2}px ${(previewSettings as any)?.refShadowBlur || 4}px ${(previewSettings as any)?.refShadowColor || '#000'}` : 'none',
                                                    WebkitTextStroke: (previewSettings as any)?.refStrokeEnabled ? `${(previewSettings as any)?.refStrokeWidth || 1}px ${(previewSettings as any)?.refStrokeColor || '#000'}` : undefined,
                                                    opacity: 0.9,
                                                    textTransform: (previewSettings as any)?.textTransform || 'none',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {activeSlide.ref}
                                            </div>


                                        </div>
                                    </div>

                                    {/* CONTROLES DE NAVEGAÇÃO DE SLIDES (OVERLAY) */}
                                    {slideParts.length > 1 && (
                                        <div
                                            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 z-50 bg-black/80 p-2 rounded-full border border-gray-700 shadow-xl backdrop-blur"
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={(e) => { e.stopPropagation(); prevPart(); }}
                                                disabled={currentPartIndex === 0}
                                                className={`p-2 rounded-full text-white transition-colors ${currentPartIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-blue-600 cursor-pointer'}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                            </button>

                                            <span className="text-white text-xs font-bold font-mono min-w-[40px] text-center select-none">
                                                {currentPartIndex + 1} / {slideParts.length}
                                            </span>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); nextPart(); }}
                                                disabled={currentPartIndex === slideParts.length - 1}
                                                className={`p-2 rounded-full text-white transition-colors ${currentPartIndex === slideParts.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-blue-600 cursor-pointer'}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                            </button>
                                        </div>
                                    )}
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
                        <BibleProjection
                            key={`projection-${activeSlide.ref || 'new'}`}
                            verseText={activeSlide.text}
                            reference={activeSlide.ref}
                            onClose={() => setIsEditorOpen(false)}
                        />
                    )}

                    {/* QUICK SEARCH MODAL */}
                    {quickSearch.visible && (
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                                zIndex: 9999,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <div
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '12px',
                                    padding: '40px 60px',
                                    minWidth: '500px',
                                    maxWidth: '600px',
                                    position: 'relative',
                                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
                                }}
                            >
                                {/* ESC to cancel */}
                                <div style={{
                                    position: 'absolute',
                                    top: '16px',
                                    right: '20px',
                                    fontSize: '12px',
                                    color: '#666',
                                    fontWeight: '500'
                                }}>
                                    Esc para cancelar
                                </div>

                                {/* Book Stage */}
                                {quickSearch.stage === 'book' && (
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '18px', color: '#666', marginBottom: '12px', fontWeight: '600' }}>
                                            Livro
                                        </div>
                                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#000', marginBottom: '8px' }}>
                                            {quickSearch.matchedBook?.name || '...'}
                                        </div>
                                        {quickSearch.error && (
                                            <div style={{ fontSize: '14px', color: '#dc2626', marginTop: '12px' }}>
                                                {quickSearch.error}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Chapter Stage */}
                                {quickSearch.stage === 'chapter' && (
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
                                            Livro
                                        </div>
                                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#000', marginBottom: '20px' }}>
                                            {quickSearch.matchedBook?.name}
                                        </div>
                                        <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
                                            Capítulo
                                        </div>
                                        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#000', marginBottom: '8px' }}>
                                            {quickSearch.input || '_'}
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#999', marginTop: '12px' }}>
                                            Capítulos: {quickSearch.chapterCount}
                                        </div>
                                        {quickSearch.error && (
                                            <div style={{ fontSize: '14px', color: '#dc2626', marginTop: '12px' }}>
                                                {quickSearch.error}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Verse Stage */}
                                {quickSearch.stage === 'verse' && (
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
                                            Livro
                                        </div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', marginBottom: '16px' }}>
                                            {quickSearch.matchedBook?.name}
                                        </div>
                                        <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
                                            Capítulo
                                        </div>
                                        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#000', marginBottom: '16px' }}>
                                            {quickSearch.selectedChapter}
                                        </div>
                                        <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
                                            Versículo
                                        </div>
                                        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#000', marginBottom: '8px' }}>
                                            {quickSearch.input || '_'}
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#999', marginTop: '12px' }}>
                                            Versículos: {quickSearch.verseCount}
                                        </div>
                                        {quickSearch.error && (
                                            <div style={{ fontSize: '14px', color: '#dc2626', marginTop: '12px' }}>
                                                {quickSearch.error}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Footer instruction */}
                                <div style={{
                                    marginTop: '32px',
                                    paddingTop: '20px',
                                    borderTop: '1px solid #e5e7eb',
                                    fontSize: '13px',
                                    color: '#666',
                                    textAlign: 'center',
                                    fontWeight: '500'
                                }}>
                                    Digite uma tecla para localizar rapidamente o versículo
                                </div>
                            </div>
                        </div>
                    )}


                </div>
            </div>

            {/* FOOTER GLOBAL - RODAPÉ DO SISTEMA */}
            <div className="bg-white border-t-2 border-gray-400 px-4 py-2 text-[13px] text-gray-700 font-semibold select-none shadow-[0_-4px_8px_rgba(0,0,0,0.15)] w-full flex items-center justify-center h-9 shrink-0 z-50">
                Digite uma tecla para localizar rapidamente o versículo
            </div>
        </div >
    );
}
