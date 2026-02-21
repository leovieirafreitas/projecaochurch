import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { splitTextGeometrically, splitTextIdeally } from '../lib/text-utils';
import { StorageHelper } from '../lib/storage-helper';
import Head from 'next/head';

interface BibleProjectionProps {
    verseText: string;
    reference: string;
    onClose: () => void;
    storageKey?: string;
}

// FONTES: Usando nomes exatos do arquivo fonts.css/projection.tsx
const CUSTOM_FONTS = [
    { name: 'Inter', value: 'Inter, sans-serif' },
    { name: 'Wondra', value: 'Wondra' },
    { name: 'Bigstage', value: 'Bigstage' },
    { name: 'CSCaleb', value: 'CSCalebMono' },
    { name: 'Headless Typeface', value: 'NewBlackTypeface' },
    { name: 'SunnySide', value: 'SunnySide' },
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Lora', value: 'Lora, serif' },
    // Windows Fonts
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Tahoma', value: 'Tahoma, sans-serif' },
    { name: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
    { name: 'Times New Roman', value: '"Times New Roman", serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Courier New', value: '"Courier New", monospace' },
    { name: 'Impact', value: 'Impact, sans-serif' },
    { name: 'Segoe UI', value: '"Segoe UI", sans-serif' },
];

// EFEITOS: Mapeando para os nomes de classe esperados por projection.tsx (anim-*)
const ANIMATION_EFFECTS = [
    { name: 'Nenhum', value: 'none' },
    { name: 'Fade In', value: 'fade' },         // vira .anim-fade
    { name: 'Slide Up', value: 'slide-up' },     // vira .anim-slide-up
    { name: 'Slide Down', value: 'slide-down' }, // vira .anim-slide-down
    { name: 'Slide Left', value: 'slide-left' }, // vira .anim-slide-left
    { name: 'Slide Right', value: 'slide-right' },// vira .anim-slide-right
];

// CRÍTICO: Usar mesma resolução virtual da ProjectionPage para garantir quebra de linha idêntica (Wysiwyg)
const VIRTUAL_WIDTH = 1024;
const VIRTUAL_HEIGHT = 576;

// --- HELPER: SAFE URL VERSIONING ---
const getCacheBustedUrl = (url: string | null | undefined, version: number) => {
    if (!url) return '';
    // Don't append params to Data URIs or Blobs (breaks the image)
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    return `${url}${url.includes('?') ? '&' : '?'}v=${version}`;
};

// --- MANAGED BACKGROUND (V114 Blob Strategy) ---
// Ensures GIF reset without re-downloading (Zero Lag)
const ManagedBackgroundImage = ({ src, resetTrigger, className, onMouseDown }: {
    src: string;
    resetTrigger: number;
    className?: string;
    onMouseDown?: (e: React.MouseEvent) => void;
}) => {
    const [displayUrl, setDisplayUrl] = useState<string>('');
    const blobRef = useRef<Blob | null>(null);
    const lastSrcRef = useRef<string>('');

    useEffect(() => {
        let activeUrl = '';
        let isCancelled = false;

        const updateUrl = async () => {
            // If source changed, invalidate cached blob
            if (src !== lastSrcRef.current) {
                if (blobRef.current) {
                    // Revoke old blob URL
                    if (displayUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(displayUrl);
                    }
                }
                blobRef.current = null;
                lastSrcRef.current = src;
            }

            // Get or create blob
            if (!blobRef.current) {
                if (src.startsWith('data:')) {
                    // Convert Base64 to Blob
                    try {
                        const parts = src.split(',');
                        if (parts.length === 2) {
                            const mime = parts[0].split(':')[1].split(';')[0];
                            const byteString = atob(parts[1]);
                            const ab = new ArrayBuffer(byteString.length);
                            const ia = new Uint8Array(ab);
                            for (let i = 0; i < byteString.length; i++) {
                                ia[i] = byteString.charCodeAt(i);
                            }
                            blobRef.current = new Blob([ab], { type: mime });
                        }
                    } catch (e) {
                        console.error('Failed to convert Base64 to Blob:', e);
                    }
                } else if (!src.startsWith('blob:')) {
                    // Fetch URL to get Blob
                    try {
                        const res = await fetch(src);
                        if (res.ok) {
                            blobRef.current = await res.blob();
                        }
                    } catch (e) {
                        console.error('Failed to fetch image:', e);
                    }
                }
            }

            if (isCancelled) return;

            // Generate display URL
            if (blobRef.current) {
                // Create new Object URL (forces browser to restart animation)
                activeUrl = URL.createObjectURL(blobRef.current);
                setDisplayUrl(activeUrl);
            } else {
                // Fallback: use src directly (for blob: URLs or if fetch failed)
                setDisplayUrl(src);
            }
        };

        updateUrl();

        return () => {
            isCancelled = true;
            if (activeUrl && activeUrl.startsWith('blob:')) {
                URL.revokeObjectURL(activeUrl);
            }
        };
    }, [src, resetTrigger]);

    if (!displayUrl) return null;

    return <img key={displayUrl} src={displayUrl} className={className} onMouseDown={onMouseDown} alt="bg" />;
};

export default function BibleProjection({ verseText, reference, onClose, storageKey = 'bible_settings' }: BibleProjectionProps) {
    // --- ESTADOS GERAIS ---
    const [themes, setThemes] = useState<any[]>([]);
    const [availableFonts, setAvailableFonts] = useState(CUSTOM_FONTS);

    // Carrega TODAS as fontes do Windows se suportado
    useEffect(() => {
        const loadFonts = async () => {
            try {
                // @ts-ignore
                if (window.queryLocalFonts) {
                    // @ts-ignore
                    const localFonts = await window.queryLocalFonts();
                    // @ts-ignore
                    const unique = new Set([...localFonts.map((f: any) => f.family)]);
                    // @ts-ignore
                    const sysFonts = Array.from(unique).map((f: any) => ({ name: f, value: `"${f}", sans-serif` })).sort((a: any, b: any) => a.name.localeCompare(b.name));

                    setAvailableFonts(prev => {
                        const cur = new Set(prev.map(p => p.name));
                        return [...prev, ...sysFonts.filter((s: any) => !cur.has(s.name))];
                    });
                    console.log("[BibleProjection] Fontes do sistema carregadas:", sysFonts.length);
                }
            } catch (e) { console.error("Erro ao carregar fontes do sistema (permissão negada?):", e); }
        };
        loadFonts();
    }, []);
    const [editingThemeId, setEditingThemeId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'text' | 'templates'>('text');
    const [bgVersion, setBgVersion] = useState(0); // For forcing GIF reload via URL change in EDITOR
    const [previewBgVersion, setPreviewBgVersion] = useState(0); // For forcing GIF reload via URL change in MODAL
    const [showGuides, setShowGuides] = useState(true);

    const [viewingTheme, setViewingTheme] = useState<any>(null); // State for View Modal

    // --- ESTADOS DO SLIDE ---
    const [slides, setSlides] = useState<string[]>([]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    // --- ESTILOS DE TEXTO ---
    const [fontSize, setFontSize] = useState(40); // Base menor p/ 1024x576
    const [color, setColor] = useState('#ffffff');
    const [textAlign, setTextAlign] = useState<any>('center');
    const [verticalAlign, setVerticalAlign] = useState<any>('center');
    const [fontFamily, setFontFamily] = useState('Inter, sans-serif');
    const [isBold, setIsBold] = useState(false);
    const [isUppercase, setIsUppercase] = useState(false);

    // --- FUNDO / CHROMA ---
    const [backgroundColor, setBackgroundColor] = useState('#00ff00'); // Default verde
    const [background, setBackground] = useState<string | null>(null);

    // --- LAYOUT E POSICIONAMENTO ---
    const [textBox, setTextBox] = useState({ x: 50, y: 50, w: 90, h: 50 });  // w/h em %
    const [bgRect, setBgRect] = useState({ x: 50, y: 50, w: 100, h: 100 });
    const [refPos, setRefPos] = useState({ x: 50, y: 85 });

    // --- EFEITOS DE TEXTO ---
    const [textShadowEnabled, setTextShadowEnabled] = useState(false);
    const [textShadowColor, setTextShadowColor] = useState('#000000');
    const [textShadowX, setTextShadowX] = useState(2);
    const [textShadowY, setTextShadowY] = useState(2);
    const [textShadowBlur, setTextShadowBlur] = useState(4);

    const [textStrokeEnabled, setTextStrokeEnabled] = useState(false);
    const [textStrokeColor, setTextStrokeColor] = useState('#000000');
    const [textStrokeWidth, setTextStrokeWidth] = useState(1);

    // --- ANIMAÇÕES (TEXTO) ---
    const [textAnimation, setTextAnimation] = useState('none');
    const [textDuration, setTextDuration] = useState(0.6);
    const [textDelay, setTextDelay] = useState(0.1);

    // --- REFERÊNCIA ---
    const [showRef, setShowRef] = useState(true);
    const [refFontSize, setRefFontSize] = useState(20);
    const [refFontFamily, setRefFontFamily] = useState('Inter, sans-serif');
    const [refColor, setRefColor] = useState('#ffffff');
    const [refShadowEnabled, setRefShadowEnabled] = useState(false);
    const [refShadowColor, setRefShadowColor] = useState('#000000');
    const [refShadowX, setRefShadowX] = useState(2);
    const [refShadowY, setRefShadowY] = useState(2);
    const [refShadowBlur, setRefShadowBlur] = useState(4);
    const [refStrokeEnabled, setRefStrokeEnabled] = useState(false);
    const [refStrokeColor, setRefStrokeColor] = useState('#000000');
    const [refStrokeWidth, setRefStrokeWidth] = useState(1);
    const [refAnimation, setRefAnimation] = useState('none');
    const [refDuration, setRefDuration] = useState(0.6);
    const [refBgEnabled, setRefBgEnabled] = useState(false);
    const [refBgColor, setRefBgColor] = useState('rgba(0,0,0,0.5)');
    const [refBgRadius, setRefBgRadius] = useState(4);

    // --- DRAG & RESIZE STATES ---
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [activeElement, setActiveElement] = useState<'text' | 'bg' | 'ref' | null>(null);

    // Armazena estado inicial da interação
    const startPos = useRef({ x: 0, y: 0 });
    const startDim = useRef({ x: 0, y: 0, w: 0, h: 0 }); // Guarda % iniciais

    // AUTO-RESET GIF quando versículo muda (CRITICAL FIX)
    const prevVerseRef = useRef<string>('');
    useEffect(() => {
        const currentVerse = `${reference}:${verseText}`;
        if (prevVerseRef.current && prevVerseRef.current !== currentVerse) {
            // Novo versículo detectado -> Reseta GIF
            setBgVersion(v => v + 1);
            console.log('[BibleProjection] Novo versículo detectado -> GIF resetado');
        }
        prevVerseRef.current = currentVerse;
    }, [verseText, reference]);

    // --- RESTORE STATE ON MOUNT (CRUCIAL PARA PERSISTÊNCIA AO FECHAR/ABRIR) ---
    // --- RESTORE STATE ON MOUNT (CRUCIAL PARA PERSISTÊNCIA AO FECHAR/ABRIR) ---
    useEffect(() => {
        const restore = async () => {
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    const s = parsed.style;
                    if (s) {
                        // Restaura ID do tema em uso (CRÍTICO PARA O BOTÃO 'SALVAR' FUNCIONAR CERTO)
                        if (s.themeId) setEditingThemeId(s.themeId);

                        // Restaura Texto
                        if (s.fontSize) setFontSize(Number(s.fontSize));
                        if (s.color) setColor(s.color);
                        if (s.fontFamily) setFontFamily(s.fontFamily);
                        if (s.textAlign) setTextAlign(s.textAlign);
                        if (s.verticalAlign) setVerticalAlign(s.verticalAlign);
                        if (s.fontWeight) setIsBold(s.fontWeight === 'bold');
                        if (s.textTransform) setIsUppercase(s.textTransform === 'uppercase');

                        // Restaura Background (COM SUPORTE A INDEXED DB)
                        if (s.backgroundColor) setBackgroundColor(s.backgroundColor);

                        if (s.backgroundImage === 'INDEXED_DB') {
                            try {
                                const bg = await StorageHelper.getBackground(storageKey);
                                if (bg) setBackground(bg);
                            } catch (e) {
                                console.error('Failed to load BG from IndexedDB', e);
                            }
                        } else if (s.backgroundImage) {
                            setBackground(s.backgroundImage);
                        }

                        // Restaura Layout
                        if (s.textBox) setTextBox(s.textBox);
                        if (s.bgRect) setBgRect(s.bgRect);
                        if (s.refPos) setRefPos(s.refPos);

                        // Restaura Efeitos Texto
                        if (s.textShadowEnabled !== undefined) setTextShadowEnabled(s.textShadowEnabled);
                        if (s.textShadowColor) setTextShadowColor(s.textShadowColor);
                        if (s.textShadowX) setTextShadowX(s.textShadowX);
                        if (s.textShadowY) setTextShadowY(s.textShadowY);
                        if (s.textShadowBlur) setTextShadowBlur(s.textShadowBlur);
                        if (s.textStrokeEnabled !== undefined) setTextStrokeEnabled(s.textStrokeEnabled);
                        if (s.textStrokeColor) setTextStrokeColor(s.textStrokeColor);
                        if (s.textStrokeWidth) setTextStrokeWidth(s.textStrokeWidth);
                        if (s.textAnimation) setTextAnimation(s.textAnimation);
                        if (s.textDuration) setTextDuration(s.textDuration);
                        if (s.textDelay) setTextDelay(s.textDelay);

                        // Restaura Referência
                        if (s.showRef !== undefined) setShowRef(s.showRef);
                        if (s.refFontSize) setRefFontSize(s.refFontSize);
                        if (s.refFontFamily) setRefFontFamily(s.refFontFamily);
                        if (s.refColor) setRefColor(s.refColor);
                        if (s.refAnimation) setRefAnimation(s.refAnimation);
                        if (s.refDuration) setRefDuration(s.refDuration);
                        if (s.refShadowEnabled !== undefined) setRefShadowEnabled(s.refShadowEnabled);
                        if (s.refShadowColor) setRefShadowColor(s.refShadowColor);
                        if (s.refShadowX) setRefShadowX(s.refShadowX);
                        if (s.refShadowY) setRefShadowY(s.refShadowY);
                        if (s.refShadowBlur) setRefShadowBlur(s.refShadowBlur);
                        if (s.refStrokeEnabled !== undefined) setRefStrokeEnabled(s.refStrokeEnabled);
                        if (s.refStrokeColor) setRefStrokeColor(s.refStrokeColor);
                        if (s.refStrokeWidth) setRefStrokeWidth(s.refStrokeWidth);
                    }
                }
            } catch (e) {
                console.error("Erro ao restaurar configurações:", e);
            }
        };
        restore();
    }, []);

    // --- DRAG LOGIC ---
    const handleMouseDown = (e: React.MouseEvent, type: 'text' | 'bg' | 'ref', action: 'move' | 'resize') => {
        if (!showGuides && type !== 'bg') return;
        e.stopPropagation();
        e.preventDefault();

        setActiveElement(type);
        startPos.current = { x: e.clientX, y: e.clientY };

        if (type === 'text') startDim.current = { ...textBox, h: textBox.h || 0 };
        else if (type === 'bg') startDim.current = { ...bgRect, h: bgRect.h || 0 };
        else if (type === 'ref') startDim.current = { ...refPos, w: 0, h: 0 };

        if (action === 'move') setIsDragging(true);
        else setIsResizing(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!activeElement || (!isDragging && !isResizing) || !containerRef.current) return;

        // Delta em pixels de tela
        const dxCtx = (e.clientX - startPos.current.x) / scale;
        const dyCtx = (e.clientY - startPos.current.y) / scale;

        // Converte delta pixel para delta % (Baseado no VIRTUAL SIZE)
        const dPctX = (dxCtx / VIRTUAL_WIDTH) * 100;
        const dPctY = (dyCtx / VIRTUAL_HEIGHT) * 100;

        if (isDragging) {
            if (activeElement === 'text') {
                setTextBox(prev => ({ ...prev, x: startDim.current.x + dPctX, y: startDim.current.y + dPctY }));
            } else if (activeElement === 'ref') {
                setRefPos(prev => ({ ...prev, x: startDim.current.x + dPctX, y: startDim.current.y + dPctY }));
            } else if (activeElement === 'bg') {
                setBgRect(prev => ({ ...prev, x: startDim.current.x + dPctX, y: startDim.current.y + dPctY }));
            }
        }
        else if (isResizing) {
            // Resize logic: Se arrastar para direita/baixo aumenta W/H.
            // Para 'text' ou 'bg'. Ref não tem resize box usualmente (só font size)
            if (activeElement === 'text') {
                // Resize centralizado ou borda? O modelo atual usa x/y como centro.
                // Se x/y é centro, aumentar W expande para os dois lados se não ajustarmos x.
                // Mas simplificando: Vamos assumir que resize aumenta Width e Height mantendo o centro visualmente 'estranho' se não formos cuidadosos.
                // MELHOR: Resize altera W/H e mantem X/Y fixo (centro). Isso faz o box crescer para fora.
                setTextBox(prev => ({
                    ...prev,
                    w: Math.max(10, startDim.current.w + (dPctX * 2)), // *2 pq cresce p/ ambos lados do centro
                    h: Math.max(10, startDim.current.h + (dPctY * 2))
                }));
            } else if (activeElement === 'bg') {
                setBgRect(prev => ({
                    ...prev,
                    w: Math.max(10, startDim.current.w + (dPctX * 2)),
                    h: Math.max(10, startDim.current.h + (dPctY * 2))
                }));
            }
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
        setActiveElement(null);
    };

    // --- UTILS ---
    const getSettingsObject = () => ({
        fontSize, textAlign, verticalAlign, color,
        textAnimation, textDuration, textDelay,
        textShadowEnabled, textShadowColor, textShadowX, textShadowY, textShadowBlur,
        textStrokeEnabled, textStrokeColor, textStrokeWidth,
        refAnimation, refDuration,
        refShadowEnabled, refShadowColor, refShadowX, refShadowY, refShadowBlur,
        refStrokeEnabled, refStrokeColor, refStrokeWidth,
        refBgEnabled, refBgColor, refBgRadius,
        backgroundColor, fontFamily, fontWeight: isBold ? 'bold' : 'normal', textTransform: isUppercase ? 'uppercase' : 'none',
        textBox, bgRect, refPos, refFontSize, refFontFamily, refColor, showRef,
        backgroundImage: background,
        bgVersion // CRITICAL: Forces GIF reset on remote screens when Play is clicked
    });

    // --- SLIDES SPLIT (GEOMÉTRICO) ---
    useEffect(() => {
        if (!verseText) return;
        // Calcula limites em pixels virtuais para o splitter
        // SYNC: Subtrai margens (40px W, 20px H) igual ao projection.tsx para garantir quebra idêntica
        const pxWidth = Math.max(10, ((textBox.w / 100) * VIRTUAL_WIDTH) - 40);
        const pxHeight = Math.max(10, ((textBox.h / 100) * VIRTUAL_HEIGHT) - 20);
        const fontStr = fontFamily.split(',')[0].replace(/"/g, '');

        // Usa Geometric (Canvas) split para precisão máxima
        const generatedSlides = splitTextGeometrically(
            verseText,
            pxWidth,
            pxHeight,
            fontSize,
            fontStr,
            isBold ? 'bold' : 'normal'
        );

        setSlides(generatedSlides);
        // Se o slide atual sumir (ex: tinha 3, agora tem 2), volta pro último
        if (currentSlideIndex >= generatedSlides.length) {
            setCurrentSlideIndex(Math.max(0, generatedSlides.length - 1));
        }
    }, [verseText, textBox.w, textBox.h, fontSize, fontFamily, isBold]);
    // ^ CRÍTICO: Recalcula slides se o box for redimensionado ou fonte mudar

    // --- PROJECTION SYNC ---
    // --- PROJECTION SYNC ---
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const sendProjection = () => {
        // CRITICAL FIX: Envia o TEXTO COMPLETO (verseText), não apenas o slide atual!
        const style = getSettingsObject();

        const payload = {
            verseText: verseText,
            reference,
            slides: slides, // NOVA PROPRIEDADE: Envia cortes exatos do editor
            style: {
                ...style,
                themeId: editingThemeId
            },
            slideIndex: currentSlideIndex,
            totalSlides: slides.length,
            source: 'desktop',
            senderId: 'editor',
            timestamp: Date.now()
        };

        // 1. FAST UPDATE (Live Preview) - Broadcast & Event (Low Latency)
        // Isso remove o "travamento" visual, pois não bloqueia a thread com I/O de disco
        try {
            const bc = new BroadcastChannel('projection_channel'); bc.postMessage(payload); bc.close();
        } catch (e) { }
        try { window.dispatchEvent(new CustomEvent('force-sync-settings', { detail: payload })); } catch (e) { }

        // 2. SLOW PERSIST (LocalStorage) - Debounced (500ms)
        // Grava no disco apenas quando o usuário "pausa" a edição, evitando lag
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const targetStorageKey = storageKey;

                // Clone payload to modify safely for storage optimization
                const finalPayload = JSON.parse(JSON.stringify(payload));

                // OTIMIZAÇÃO: Se background for muito grande (imagem > 50kb), salva no IndexedDB
                // Evita QuotaExceededError no localStorage
                const bg = finalPayload.style.backgroundImage;
                if (bg && bg.length > 50000 && bg.startsWith('data:')) {
                    try {
                        const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
                        if (isTauri) {
                            const { invoke } = await import('@tauri-apps/api/tauri');
                            const url = await invoke('save_image_to_app_data', {
                                filename: `projection_bg_${Date.now()}.png`,
                                base64Data: bg
                            });
                            if (url && typeof url === 'string') {
                                finalPayload.style.backgroundImage = url;
                                setBackground(url); // Updates UI to drop Base64
                            } else {
                                throw new Error("Upload returned no URL");
                            }
                        } else {
                            throw new Error("Not a Tauri environment");
                        }
                    } catch (uploadErr) {
                        console.error("Falha no upload para appData, usando IndexedDB local:", uploadErr);
                        try {
                            await StorageHelper.setBackground(targetStorageKey, bg);
                            finalPayload.style.backgroundImage = 'INDEXED_DB';
                        } catch (dbErr) {
                            console.error("Falha ao salvar no IndexedDB:", dbErr);
                        }
                    }
                }

                localStorage.setItem(targetStorageKey, JSON.stringify(finalPayload));
                // FORCE UPDATE SAME TAB
                window.dispatchEvent(new Event('local-storage-update'));
            } catch (e) {
                console.error("Erro Auto-Save:", e);
            }
        }, 500);
    };

    // Auto-envia
    useEffect(() => { sendProjection(); }, [
        fontSize, textAlign, verticalAlign, color, fontFamily, isBold, isUppercase,
        backgroundColor, background, textBox, bgRect, refPos,
        textShadowEnabled, textShadowColor, textShadowX, textShadowY, textShadowBlur,
        textStrokeEnabled, textStrokeColor, textStrokeWidth, textAnimation, textDuration, textDelay,
        showRef, refFontSize, refFontFamily, refColor, refShadowEnabled, refShadowColor, refShadowX, refShadowY, refShadowBlur,
        refStrokeEnabled, refStrokeColor, refStrokeWidth, refAnimation, refDuration,
        slides, currentSlideIndex, bgVersion
    ]);

    // --- RESIZE ---
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                const margin = 40;
                const scaleX = (width - margin) / VIRTUAL_WIDTH;
                const scaleY = (height - margin) / VIRTUAL_HEIGHT;
                setScale(Math.min(scaleX, scaleY));
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Revert to Base64 to ensure persistence across reloads (Blob URLs are temporary)
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setBackground(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // CLEANUP EFFECT REMOVED (Base64 doesn't need revoke)

    // --- TEMAS (HÍBRIDO: SUPABASE GLOBALS + LOCAL STORAGE CUSTOM) ---
    // --- TEMAS (HÍBRIDO: SUPABASE GLOBALS + INDEXED DB CUSTOM) ---
    const loadThemes = async () => {
        let globalThemes: any[] = [];
        let localThemes: any[] = [];

        // 1. Carrega Temas GLOBAIS do Supabase (Read-Only)
        if (supabase) {
            try {
                const { data } = await supabase.from('themes').select('*').order('created_at', { ascending: false });
                if (data) {
                    globalThemes = data.map(t => ({ ...t, is_global: true }));
                }
            } catch (e) {
                console.error("Erro ao carregar temas globais:", e);
            }
        }

        // 2. Carrega Temas LOCAIS do IndexedDB (Com Migração de LocalStorage)
        try {
            const legacyStored = localStorage.getItem('user_themes');
            if (legacyStored) {
                // MIGRATION: Se encontrar no LS, move para IDB e limpa o LS
                console.log("Migrando temas do LocalStorage para IndexedDB...");
                try {
                    const legacyData = JSON.parse(legacyStored);
                    if (Array.isArray(legacyData)) {
                        await StorageHelper.saveUserThemes(legacyData);
                        localThemes = legacyData;
                        localStorage.removeItem('user_themes'); // Remove do navegador p/ liberar memória
                        alert("Seus temas foram migrados para o novo sistema de armazenamento otimizado!");
                    }
                } catch (e) { console.error("Erro na migração:", e); }
            } else {
                // Carregamento Normal do IndexedDB
                localThemes = await StorageHelper.getUserThemes();
            }
        } catch (e) {
            console.error("Erro ao carregar temas locais:", e);
        }

        // Merge: Locais primeiro (User Custom)
        setThemes([...localThemes, ...globalThemes]);
    };

    // Carrega ao iniciar
    useEffect(() => { loadThemes(); }, []);

    // Função auxiliar para re-importar se o usuário quiser forçar atualização (Mantido como Refresh)
    const importFromSupabase = () => loadThemes();

    const applyTheme = (t: any) => {
        const s = t.settings; if (!s) return;
        setFontSize(Number(s.fontSize || 40));
        setTextAlign(s.textAlign || 'center');
        setVerticalAlign(s.verticalAlign || 'center');
        setColor(s.color || '#fff');
        setFontFamily(s.fontFamily || 'Inter, sans-serif');
        setIsBold(s.fontWeight === 'bold');
        setIsUppercase(s.textTransform === 'uppercase');
        setBackground(t.background_url || s.backgroundImage);
        setBackgroundColor(s.backgroundColor || '#000');

        // SAFETY FIX: Ensure older templates don't break layout with tiny text boxes
        const safeW = Math.max(Number(s.textBox?.w || 90), 30); // Min 30% width
        const safeH = Math.max(Number(s.textBox?.h || 50), 10); // Min 10% height
        setTextBox({ x: s.textBox?.x || 50, y: s.textBox?.y || 50, w: safeW, h: safeH });
        setBgRect(s.bgRect || { x: 50, y: 50, w: 100, h: 100 });
        setRefPos(s.refPos || { x: 50, y: 85 });
        setTextAnimation(s.textAnimation || 'none');
        setTextDuration(s.textDuration || 0.6);
        setTextDelay(s.textDelay || 0.1);
        setTextShadowEnabled(s.textShadowEnabled || false);
        setTextShadowColor(s.textShadowColor || '#000');
        setTextShadowBlur(s.textShadowBlur || 4);
        setTextStrokeEnabled(s.textStrokeEnabled || false);
        setTextStrokeColor(s.textStrokeColor || '#000');
        setTextStrokeWidth(s.textStrokeWidth || 1);
        setShowRef(s.showRef !== false);
        setRefFontSize(s.refFontSize || 20);
        setRefFontFamily(s.refFontFamily || 'Inter, sans-serif');
        setRefColor(s.refColor || '#fff');
        setRefAnimation(s.refAnimation || 'none');
        setRefDuration(s.refDuration || 0.6);
        setRefShadowEnabled(s.refShadowEnabled || false);
        setRefShadowColor(s.refShadowColor || '#000');
        setRefStrokeEnabled(s.refStrokeEnabled || false);
        setRefStrokeColor(s.refStrokeColor || '#000');

        // GARANTE CONSISTÊNCIA: Ao usar um tema, o editor assume que este é o tema ativo
        // GARANTE CONSISTÊNCIA: Ao usar um tema, o editor assume que este é o tema ativo
        // if (t.id) setEditingThemeId(t.id); // REMOVED: No more explicit "Edit Mode" with Save button

        // REMOVIDO: FORÇA SINCRONIZAÇÃO IMEDIATA (Causava Race Condition com Slides Antigos)
        // O useEffect([fontSize, ...]) já vai disparar sendProjection() assim que os estados atualizarem
        // e os slides forem recalculados corretamente.

        // Apenas forçamos um pequeno delay para garantir que a UI atualize antes de enviar
        setTimeout(() => {
            // O useEffect cuidará do resto
        }, 50);
    };



    const createNewTheme = async () => {
        const name = prompt("Nome do novo tema:");
        if (!name) return;

        const settings = getSettingsObject();

        try {
            const newTheme = {
                id: Date.now(),
                name,
                background_url: background, // Salva base64 (agora suporta arquivos grandes no IDB)
                settings,
                created_at: new Date().toISOString()
            };

            const currentThemes = await StorageHelper.getUserThemes();
            const updated = [newTheme, ...currentThemes];

            await StorageHelper.saveUserThemes(updated);
            alert("Tema criado com sucesso!");
            loadThemes();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar tema.");
        }
    };

    const handleSave = async (themeId: number) => {
        if (!themeId) return;

        const settings = getSettingsObject();
        const themeToEdit = themes.find(t => t.id === themeId);

        // LÓGICA INTELIGENTE: SE É GLOBAL, AUTO-FORK PARA LOCAL
        if (themeToEdit && themeToEdit.is_global) {
            const newName = `${themeToEdit.name} (Editado)`;
            const newTheme = {
                id: Date.now(),
                name: newName,
                background_url: background,
                settings,
                created_at: new Date().toISOString(),
                is_global: false
            };

            try {
                const currentThemes = await StorageHelper.getUserThemes();
                await StorageHelper.saveUserThemes([newTheme, ...currentThemes]);

                alert(`Alterações salvas em nova cópia local: "${newName}"`);
                await loadThemes();
                setEditingThemeId(newTheme.id);
            } catch (e) {
                alert("Erro ao criar cópia: " + e);
            }
            return;
        }

        // SALVAMENTO APENAS PARA TEMAS LOCAIS (IndexedDB)
        try {
            const currentThemes = await StorageHelper.getUserThemes();
            const updatedThemes = currentThemes.map((t: any) => {
                if (t.id === themeId) {
                    return {
                        ...t,
                        background_url: background,
                        name: t.name,
                        settings
                    };
                }
                return t;
            });

            await StorageHelper.saveUserThemes(updatedThemes);
            alert("Tema atualizado com sucesso!");
            loadThemes();
        } catch (e: any) {
            console.error(e);
            alert("Erro ao atualizar tema: " + e.message);
        }
    };
    const loadThemeForEdit = (t: any) => {
        applyTheme(t);
        setEditingThemeId(t.id);
        setActiveTab('text');
        // Força envio imediato para garantir que o preview da live mostre o que está sendo editado
        setTimeout(() => sendProjection(), 100);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-[#1a1a1a] text-gray-300 flex flex-col font-sans select-none overflow-hidden"
            onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} style={{ fontFamily: 'Inter, sans-serif' }}>

            {/* INJETANDO CSS PARA PREVIEW FIEL NO EDITOR */}
            <style jsx global>{`
                @font-face { font-family: 'Wondra'; src: url('/fonts/Wondra.woff'); }
                @font-face { font-family: 'Bigstage'; src: url('/fonts/Bigstage.otf'); }
                @font-face { font-family: 'CSCalebMono'; src: url('/fonts/CSCalebMono-Regular.otf'); }
                @font-face { font-family: 'NewBlackTypeface'; src: url('/fonts/NewBlackTypeface-Regular.otf'); }
                @font-face { font-family: 'Headless Typeface'; src: url('/fonts/NewBlackTypeface-Regular.otf'); }
                @font-face { font-family: 'SunnySide'; src: url('/fonts/SunnySide-Regular.otf'); }

                /* ANIMATIONS COPIED FROM PROJECTION */
                @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
                @keyframes slideLeft { 
                    from { opacity:0; transform: translate(calc(-50% - 50px), -50%); } 
                    to { opacity:1; transform: translate(-50%, -50%); } 
                }
                @keyframes slideRight { 
                    from { opacity:0; transform: translate(calc(-50% + 50px), -50%); } 
                    to { opacity:1; transform: translate(-50%, -50%); } 
                }
                @keyframes slideUp { 
                    from { opacity:0; transform: translate(-50%, calc(-50% + 50px)); } 
                    to { opacity:1; transform: translate(-50%, -50%); } 
                }
                @keyframes slideDown { 
                    from { opacity:0; transform: translate(-50%, calc(-50% - 50px)); } 
                    to { opacity:1; transform: translate(-50%, -50%); } 
                }

                .anim-enter { animation-duration: 0.6s; animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); animation-fill-mode: both; }
                .anim-delay { animation-delay: 0.15s; }

                .anim-fade { animation-name: fadeIn; }
                .anim-slide-left { animation-name: slideLeft; }
                .anim-slide-right { animation-name: slideRight; }
                .anim-slide-up { animation-name: slideUp; }
                .anim-slide-down { animation-name: slideDown; }
            `}</style>

            {/* TOP BAR */}
            <div className="h-14 bg-[#202020] border-b border-[#333] flex items-center justify-between px-6 shrink-0 shadow-sm z-50">
                <div className="flex items-center gap-4">
                    <label className="group flex items-center gap-2 text-[10px] font-bold text-gray-400 hover:text-white cursor-pointer transition-colors select-none uppercase tracking-wider">
                        CARREGAR FUNDO
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                    {background && (
                        <>
                            <div className="w-[1px] h-3 bg-[#444] mx-2"></div>
                            <button onClick={() => setBackground(null)} className="text-[10px] font-bold text-gray-500 hover:text-red-500 transition-colors uppercase tracking-wider" title="Apagar Fundo">
                                APAGAR FUNDO
                            </button>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowGuides(!showGuides)} className={`text-[10px] font-bold transition-colors uppercase tracking-wider ${showGuides ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
                        GUIAS {showGuides ? 'ON' : 'OFF'}
                    </button>
                    <div className="w-px h-4 bg-[#333]"></div>
                    <button onClick={onClose} className="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors tracking-wide px-2">FECHAR</button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col items-center justify-center bg-[#181818] relative overflow-hidden" ref={containerRef}>
                    <div className="shadow-2xl overflow-hidden relative" style={{
                        width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT, transform: `scale(${scale})`,
                        backgroundColor: backgroundColor === 'transparent' ? 'transparent' : backgroundColor,
                        backgroundImage: (backgroundColor === 'transparent') ?
                            'linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%, #222), linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%, #222)' : 'none',
                        backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px',
                        boxShadow: '0 0 50px rgba(0,0,0,0.5)'
                    }}>
                        {/* Background - DRAGGABLE & RESIZABLE with GIF RESET via URL param */}
                        {background && (
                            <div className="absolute" style={{
                                left: `${bgRect.x}%`, top: `${bgRect.y}%`, width: `${bgRect.w}%`, height: `${bgRect.h}%`,
                                transform: 'translate(-50%, -50%)',
                                border: (showGuides) ? '1px dashed #ffff00' : 'none'
                            }}>
                                <ManagedBackgroundImage
                                    src={background}
                                    resetTrigger={bgVersion}
                                    onMouseDown={(e) => handleMouseDown(e, 'bg', 'move')}
                                    className={`w-full h-full object-contain select-none ${showGuides ? 'cursor-move' : ''}`}
                                />
                                {/* Resize Handle */}
                                {showGuides && <div onMouseDown={(e) => handleMouseDown(e, 'bg', 'resize')} className="absolute bottom-[-5px] right-[-5px] w-4 h-4 bg-yellow-400 rounded-full cursor-se-resize border border-black z-50"></div>}
                            </div>
                        )}

                        {/* Verse Text - DRAGGABLE & RESIZABLE */}
                        <div
                            key={`text-${currentSlideIndex}-${textAnimation}-${textDuration}`}
                            className={`absolute z-10 ${showGuides ? 'hover:bg-blue-500/10' : ''} ${textAnimation !== 'none' ? `anim-enter anim-${textAnimation} anim-delay` : ''}`}
                            style={{
                                left: `${textBox.x}%`, top: `${textBox.y}%`, width: `${textBox.w}%`, height: `${textBox.h}%`,
                                transform: 'translate(-50%, -50%)',
                                fontFamily, fontSize: `${fontSize}px`, color,
                                fontWeight: isBold ? 'bold' : 'normal', textTransform: isUppercase ? 'uppercase' : 'none',
                                textShadow: textShadowEnabled ? `${textShadowX}px ${textShadowY}px ${textShadowBlur}px ${textShadowColor}` : 'none',
                                WebkitTextStroke: textStrokeEnabled ? `${textStrokeWidth}px ${textStrokeColor}` : '0px',
                                border: (showGuides) ? '1px dashed rgba(255, 255, 255, 0.5)' : 'none',
                                outline: (activeElement === 'text') ? '2px solid #3b82f6' : 'none',
                                animationDuration: `${textDuration}s`,
                                animationDelay: `${textDelay}s`
                            }}>
                            {/* Drag Handle (Move Area) - NOW HANDLES ALIGNMENT */}
                            <div onMouseDown={(e) => handleMouseDown(e, 'text', 'move')} className={`flex-1 w-full h-full select-none ${showGuides ? 'cursor-move' : ''}`}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: verticalAlign,
                                    textAlign: textAlign as any,
                                    whiteSpace: 'pre-wrap', // CRITICAL: Honor \n breaks from split logic
                                    lineHeight: 1.25,      // CRITICAL: Match Projection line-height
                                    overflow: 'hidden'     // Prevent spill
                                }}
                            >
                                {slides[currentSlideIndex] || verseText || "PREVIEW DO TEXTO"}
                            </div>
                            {/* Resize Handle */}
                            {showGuides && <div onMouseDown={(e) => handleMouseDown(e, 'text', 'resize')} className="absolute bottom-[-5px] right-[-5px] w-4 h-4 bg-blue-500 rounded-full cursor-se-resize border border-white z-50 shadow-sm"></div>}
                        </div>

                        {/* Reference - DRAGGABLE ONLY */}
                        {showRef && (
                            <div
                                key={`ref-${currentSlideIndex}-${refAnimation}-${refDuration}`}
                                onMouseDown={(e) => handleMouseDown(e, 'ref', 'move')}
                                className={`absolute z-20 font-bold tracking-wide select-none ${showGuides ? 'cursor-move hover:text-blue-300' : ''} ${refAnimation !== 'none' ? `anim-enter anim-${refAnimation} anim-delay` : ''}`}
                                style={{
                                    left: `${refPos.x}%`, top: `${refPos.y}%`, transform: 'translate(-50%, -50%)',
                                    fontSize: `${refFontSize}px`, color: refColor, fontFamily: refFontFamily,
                                    textShadow: refShadowEnabled ? `${refShadowX}px ${refShadowY}px ${refShadowBlur}px ${refShadowColor}` : 'none',
                                    WebkitTextStroke: refStrokeEnabled ? `${refStrokeWidth}px ${refStrokeColor}` : '0px',
                                    border: (showGuides) ? '1px dashed rgba(255, 255, 0, 0.5)' : 'none', padding: '5px',
                                    animationDuration: `${refDuration}s`,
                                    animationDelay: `${textDelay}s`
                                }}>
                                {reference || "REFERÊNCIA"}
                            </div>
                        )}

                        {/* Guide Lines: Center Cross + TV Safe Area (1920x1080 @ 90%) */}
                        {showGuides && (
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Center Cross */}
                                <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-500/20"></div>
                                <div className="absolute top-0 left-1/2 w-px h-full bg-cyan-500/20"></div>

                                {/* TV SAFE AREA (1920x1080 @ 90% = 5% margin) */}
                                <div
                                    className="absolute border-2 border-dashed border-yellow-500/40"
                                    style={{
                                        left: '5%',
                                        top: '5%',
                                        width: '90%',
                                        height: '90%'
                                    }}
                                >
                                    {/* Safe Area Label */}
                                    <div className="absolute -top-5 left-0 text-[9px] font-mono text-yellow-500/60 uppercase tracking-wider">
                                        Safe Area (1920x1080)
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Play Button - Always Visible as requested */}
                    {/* Play Button - Always Visible as requested */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
                        <button
                            onClick={() => {
                                console.log("Play clicked - Resetting GIF...");
                                // Reset via Key
                                setBgVersion(v => v + 1);
                                // Send projection data (Handled by Effect now)
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-full p-4 shadow-lg transition-transform active:scale-95 flex items-center justify-center group"
                            title="Reiniciar Mídia e Projetar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="translate-x-0.5 group-active:animate-ping">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* --- RIGHT SIDEBAR --- */}
                <div className="w-[340px] bg-[#202020] border-l border-[#333] flex flex-col shadow-xl z-20">
                    <div className="flex border-b border-[#333] bg-[#222]">
                        <button onClick={() => setActiveTab('text')} className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition ${activeTab === 'text' ? 'text-blue-400 border-b-2 border-blue-400 bg-[#252525]' : 'text-gray-500 hover:text-gray-300'}`}>TEXTO</button>
                        <button onClick={() => setActiveTab('templates')} className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition ${activeTab === 'templates' ? 'text-blue-400 border-b-2 border-blue-400 bg-[#252525]' : 'text-gray-500 hover:text-gray-300'}`}>TEMPLATES</button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                        {activeTab === 'text' && (
                            <>
                                <div>
                                    {/* Edit Mode Removed as per request */}
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block tracking-widest">Fundo</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setBackgroundColor('#00ff00')} className="w-8 h-6 rounded border border-transparent hover:border-white transition" style={{ backgroundColor: '#00ff00' }}></button>
                                        <button onClick={() => setBackgroundColor('#0000ff')} className="w-8 h-6 rounded border border-transparent hover:border-white transition" style={{ backgroundColor: '#0000ff' }}></button>
                                        <button onClick={() => setBackgroundColor('#000000')} className="w-8 h-6 rounded border border-transparent hover:border-white transition" style={{ backgroundColor: '#000000' }}></button>
                                        <button onClick={() => setBackgroundColor('transparent')} className={`h-6 px-2 rounded border text-[9px] font-bold transition ${backgroundColor === 'transparent' ? 'border-white text-white' : 'border-[#444] text-gray-500'}`}>VAZADO</button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block tracking-widest">Fonte</label>
                                    <div className="relative mb-2">
                                        <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full bg-[#111] border border-[#444] hover:border-[#555] rounded px-3 py-2.5 text-sm text-white appearance-none cursor-pointer transition-colors pr-8">
                                            {availableFonts.map(f => <option key={f.name} value={f.value}>{f.name}</option>)}
                                        </select>
                                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Fonte do sistema (ex: Arial)"
                                        value={fontFamily}
                                        onChange={(e) => setFontFamily(e.target.value)}
                                        className="w-full bg-[#111] border border-[#333] mb-3 rounded px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:border-blue-500 outline-none"
                                        title="Digite o nome da fonte instalada no Windows"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setIsBold(!isBold)} className={`py-1.5 rounded text-[10px] font-bold border transition ${isBold ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-400'}`}>NEGRITO</button>
                                        <button onClick={() => setIsUppercase(!isUppercase)} className={`py-1.5 rounded text-[10px] font-bold border transition ${isUppercase ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-400'}`}>MAIÚSCULAS</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block tracking-widest">Tamanho</label><input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-xs text-white" /></div>
                                    <div><label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block tracking-widest">Cor</label><div className="bg-[#111] border border-[#333] rounded px-2 py-1"><input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-6 bg-transparent border-none cursor-pointer" /></div></div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block tracking-widest">Alinhamento</label>
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-3 gap-1">{['left', 'center', 'right'].map(a => <button key={a} onClick={() => setTextAlign(a)} className={`py-1.5 rounded text-[9px] font-bold border uppercase ${textAlign === a ? 'bg-[#333] border-gray-500 text-white' : 'bg-[#1a1a1a] border-[#222] text-gray-600'}`}>{a}</button>)}</div>
                                        <div className="grid grid-cols-3 gap-1">{[{ v: 'flex-start', l: 'TOP' }, { v: 'center', l: 'CENTER' }, { v: 'flex-end', l: 'BOT' }].map(o => <button key={o.v} onClick={() => setVerticalAlign(o.v)} className={`py-1.5 rounded text-[9px] font-bold border uppercase ${verticalAlign === o.v ? 'bg-[#333] border-gray-500 text-white' : 'bg-[#1a1a1a] border-[#222] text-gray-600'}`}>{o.l}</button>)}</div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-[#333]">
                                    <div className="flex items-center gap-2 mb-3"><svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg><label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Animações</label></div>
                                    <div className="pl-3 border-l-2 border-[#333] space-y-4">
                                        <div>
                                            <label className="text-[9px] font-bold text-blue-400 uppercase block mb-1">Versículo</label>
                                            <div className="relative mb-2">
                                                <select value={textAnimation} onChange={e => setTextAnimation(e.target.value)} className="w-full bg-[#111] border border-[#444] hover:border-[#555] rounded px-3 py-2 text-sm text-white appearance-none cursor-pointer transition-colors pr-8">
                                                    {ANIMATION_EFFECTS.map(ef => <option key={ef.value} value={ef.value}>{ef.name}</option>)}
                                                </select>
                                                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2"><div><label className="text-[8px] text-gray-500 uppercase">Duração (s)</label><input type="number" step="0.1" value={textDuration} onChange={e => setTextDuration(Number(e.target.value))} className="w-full bg-[#111] border border-[#333] rounded p-1 text-xs text-secondary text-white text-center" /></div><div><label className="text-[8px] text-gray-500 uppercase">Delay (s)</label><input type="number" step="0.1" value={textDelay} onChange={e => setTextDelay(Number(e.target.value))} className="w-full bg-[#111] border border-[#333] rounded p-1 text-xs text-center text-white" /></div></div>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-amber-400 uppercase block mb-1">Referência</label>
                                            <div className="relative mb-2">
                                                <select value={refAnimation} onChange={e => setRefAnimation(e.target.value)} className="w-full bg-[#111] border border-[#444] hover:border-[#555] rounded px-3 py-2 text-sm text-white appearance-none cursor-pointer transition-colors pr-8">
                                                    {ANIMATION_EFFECTS.map(ef => <option key={ef.value} value={ef.value}>{ef.name}</option>)}
                                                </select>
                                                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                            <div><label className="text-[8px] text-gray-500 uppercase">Duração (s)</label><input type="number" step="0.1" value={refDuration} onChange={e => setRefDuration(Number(e.target.value))} className="w-full bg-[#111] border border-[#333] rounded p-1 text-xs text-center text-white" /></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-[#333] space-y-3">
                                    <div className="bg-[#1a1a1a] border border-[#333] rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-3 w-3 bg-gray-600 rounded-sm"></div><label className="text-[11px] font-bold text-gray-300 uppercase">Sombra</label></div><input type="checkbox" checked={textShadowEnabled} onChange={e => setTextShadowEnabled(e.target.checked)} className="accent-blue-500 w-4 h-4 cursor-pointer" /></div>
                                        {textShadowEnabled && <div className="grid grid-cols-2 gap-2 pl-5"><div><label className="text-[9px] text-gray-500 uppercase block mb-1">Cor</label><input type="color" value={textShadowColor} onChange={e => setTextShadowColor(e.target.value)} className="w-full h-8 bg-transparent cursor-pointer rounded border border-[#333]" /></div><div><label className="text-[9px] text-gray-500 uppercase block mb-1">Blur</label><input type="number" placeholder="Blur" value={textShadowBlur} onChange={e => setTextShadowBlur(Number(e.target.value))} className="w-full bg-[#111] text-sm border border-[#444] hover:border-[#555] rounded px-2 py-1.5 text-white transition-colors" /></div></div>}
                                    </div>
                                    <div className="bg-[#1a1a1a] border border-[#333] rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-3 w-3 bg-gray-600 rounded-sm"></div><label className="text-[11px] font-bold text-gray-300 uppercase">Borda</label></div><input type="checkbox" checked={textStrokeEnabled} onChange={e => setTextStrokeEnabled(e.target.checked)} className="accent-blue-500 w-4 h-4 cursor-pointer" /></div>
                                        {textStrokeEnabled && <div className="grid grid-cols-2 gap-2 pl-5"><div><label className="text-[9px] text-gray-500 uppercase block mb-1">Cor</label><input type="color" value={textStrokeColor} onChange={e => setTextStrokeColor(e.target.value)} className="w-full h-8 bg-transparent cursor-pointer rounded border border-[#333]" /></div><div><label className="text-[9px] text-gray-500 uppercase block mb-1">Largura</label><input type="number" step="0.5" placeholder="Width" value={textStrokeWidth} onChange={e => setTextStrokeWidth(Number(e.target.value))} className="w-full bg-[#111] text-sm border border-[#444] hover:border-[#555] rounded px-2 py-1.5 text-white transition-colors" /></div></div>}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-[#333]">
                                    <div className="mb-3 flex items-center gap-2"><svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg><span className="text-[11px] font-bold text-purple-400 uppercase tracking-widest">Referência</span></div>
                                    <div className="bg-[#1a1a1a] border border-[#333] rounded p-3 space-y-3">
                                        <div className="flex items-center gap-3"><input type="checkbox" checked={showRef} onChange={e => setShowRef(e.target.checked)} className="accent-blue-500 w-4 h-4" /><span className="text-[11px] font-medium text-gray-200">Mostrar</span></div>
                                        {showRef && (
                                            <>
                                                <div>
                                                    <label className="text-[10px] text-gray-400 uppercase block mb-1.5 font-semibold">Fonte</label>
                                                    <div className="relative">
                                                        <select value={refFontFamily} onChange={e => setRefFontFamily(e.target.value)} className="w-full bg-[#111] border border-[#444] hover:border-[#555] rounded px-3 py-2.5 text-sm text-white appearance-none cursor-pointer transition-colors pr-8">
                                                            {availableFonts.map(f => <option key={f.name} value={f.value}>{f.name}</option>)}
                                                        </select>
                                                        <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-gray-400 uppercase block mb-1.5 font-semibold">Tam</label><input type="number" value={refFontSize} onChange={e => setRefFontSize(Number(e.target.value))} className="w-full bg-[#111] border border-[#444] hover:border-[#555] rounded px-2 py-2 text-sm text-white transition-colors" /></div><div><label className="text-[10px] text-gray-400 uppercase block mb-1.5 font-semibold">Cor</label><div className="bg-[#111] border border-[#444] hover:border-[#555] rounded px-1 py-1 transition-colors"><input type="color" value={refColor} onChange={e => setRefColor(e.target.value)} className="w-full h-7 bg-transparent border-none cursor-pointer" /></div></div></div>
                                                <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
                                                    <div className="flex items-center justify-between bg-[#111] rounded p-2.5 border border-[#2a2a2a]"><label className="text-[11px] text-gray-300 font-medium">Sombra</label><input type="checkbox" checked={refShadowEnabled} onChange={e => setRefShadowEnabled(e.target.checked)} className="accent-blue-500 h-4 w-4 cursor-pointer" /></div>
                                                    {refShadowEnabled && <div className="grid grid-cols-2 gap-2 pl-3"><div><label className="text-[9px] text-gray-500 uppercase block mb-1">Cor</label><input type="color" value={refShadowColor} onChange={e => setRefShadowColor(e.target.value)} className="h-8 w-full cursor-pointer rounded border border-[#333]" /></div><div><label className="text-[9px] text-gray-500 uppercase block mb-1">Blur</label><input type="number" value={refShadowBlur} onChange={e => setRefShadowBlur(Number(e.target.value))} className="bg-[#111] text-sm border border-[#444] hover:border-[#555] w-full rounded px-2 py-1.5 text-white transition-colors" /></div></div>}
                                                </div>
                                                <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
                                                    <div className="flex items-center justify-between bg-[#111] rounded p-2.5 border border-[#2a2a2a]"><label className="text-[11px] text-gray-300 font-medium">Borda</label><input type="checkbox" checked={refStrokeEnabled} onChange={e => setRefStrokeEnabled(e.target.checked)} className="accent-blue-500 h-4 w-4 cursor-pointer" /></div>
                                                    {refStrokeEnabled && <div className="grid grid-cols-2 gap-2 pl-3"><div><label className="text-[9px] text-gray-500 uppercase block mb-1">Cor</label><input type="color" value={refStrokeColor} onChange={e => setRefStrokeColor(e.target.value)} className="h-8 w-full cursor-pointer rounded border border-[#333]" /></div><div><label className="text-[9px] text-gray-500 uppercase block mb-1">Largura</label><input type="number" step="0.5" value={refStrokeWidth} onChange={e => setRefStrokeWidth(Number(e.target.value))} className="bg-[#111] text-sm border border-[#444] hover:border-[#555] w-full rounded px-2 py-1.5 text-white transition-colors" /></div></div>}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        {activeTab === 'templates' && (
                            <div className="space-y-4 pb-20">
                                {/* REMOVED: Create New Theme Button as requested */}

                                {themes.length === 0 && (
                                    <div className="text-gray-500 text-xs text-center py-10 flex flex-col gap-2">
                                        <span>Nenhum tema disponível.</span>
                                        <button onClick={importFromSupabase} className="mt-2 text-blue-400 hover:text-white underline text-[10px]">
                                            Recarregar Temas
                                        </button>
                                    </div>
                                )}

                                {themes.map(theme => {
                                    const s = theme.settings || {};
                                    const isGlobal = theme.is_global;

                                    return (
                                        <div key={theme.id} className={`rounded overflow-hidden border transition shadow-lg flex flex-col ${isGlobal ? 'bg-[#151515] border-blue-900/30' : 'bg-[#1a1a1a] border-[#333] hover:border-gray-500'}`}>
                                            {/* Mini Preview Estático */}
                                            <div className="h-24 w-full relative overflow-hidden bg-black flex items-center justify-center border-b border-[#333]">
                                                {theme.background_url || s.backgroundImage ?
                                                    <img src={theme.background_url || s.backgroundImage} className="w-full h-full object-cover opacity-60" /> :
                                                    <div className="w-full h-full" style={{ backgroundColor: s.backgroundColor || '#000' }}></div>
                                                }
                                                <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                                                    <span className="text-[10px] text-white line-clamp-2" style={{
                                                        fontFamily: s.fontFamily || 'Inter',
                                                        fontWeight: s.fontWeight === 'bold' ? 'bold' : 'normal',
                                                        color: s.color || '#fff'
                                                    }}>
                                                        {theme.name || "Sem título"}
                                                    </span>
                                                    {isGlobal && <span className="absolute top-1 right-1 px-1 bg-blue-600 text-[8px] text-white rounded font-bold uppercase">GLOBAL</span>}
                                                </div>
                                            </div>

                                            {/* Actions Footer - SIMPLIFIED: USAR + VIEW */}
                                            <div className="p-2 grid grid-cols-2 gap-2 bg-[#222]">
                                                <button onClick={() => { applyTheme(theme); setActiveTab('text'); }} className="py-2 bg-green-700 hover:bg-green-600 text-white text-[10px] font-bold rounded uppercase col-span-1 border border-green-800">
                                                    USAR
                                                </button>
                                                <button onClick={() => setViewingTheme(theme)} className="py-2 bg-[#333] hover:bg-[#444] text-gray-300 hover:text-white text-[10px] font-bold rounded uppercase col-span-1 border border-[#444]">
                                                    VIEW
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* --- MODAL VIEW THEME (SCALED VIRTUAL CONTAINER STRATEGY) --- */}
            {viewingTheme && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-10 backdrop-blur-sm" onClick={() => setViewingTheme(null)}>

                    {/* WRAPPER: Controla o layout do modal (Header/Footer + Preview Scaled) */}
                    <div className="bg-[#1a1a1a] rounded-lg shadow-2xl flex flex-col items-center relative border border-[#333] overflow-hidden"
                        style={{ maxWidth: '90vw', maxHeight: '90vh' }}
                        onClick={e => e.stopPropagation()}>

                        {/* HEADER */}
                        <div className="w-full p-3 bg-[#111] border-b border-[#333] flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">PREVIEW DO TEMA</span>
                            <span className="text-[10px] text-gray-600 font-mono">{viewingTheme.id ? `#${viewingTheme.id.toString().substring(0, 8)}` : 'LOCAL'}</span>
                        </div>

                        {/* PREVIEW CONTAINER - SCALED 1024x576 */}
                        <div className="relative bg-black overflow-hidden select-none"
                            style={{
                                width: '1024px',
                                height: '576px',
                                transform: 'scale(0.8)',
                                transformOrigin: 'top center',
                                marginBottom: '-115px'
                            }}>

                            {/* 1. BACKGROUND LAYER - HARD RESET LOGIC */}
                            {(viewingTheme.background_url || viewingTheme.settings?.backgroundImage) ? (
                                <img
                                    src={getCacheBustedUrl(viewingTheme.background_url || viewingTheme.settings?.backgroundImage, previewBgVersion)}
                                    className="absolute inset-0 w-full h-full object-cover z-0"
                                    key={previewBgVersion} // React Key force re-render
                                    alt="bg"
                                />
                            ) : (
                                <div className="absolute inset-0 w-full h-full z-0" style={{ backgroundColor: viewingTheme.settings?.backgroundColor || '#000' }}></div>
                            )}

                            {/* PLAY/REPLAY BUTTON OVERLAY */}
                            <div className="absolute inset-0 z-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20 group cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // V94 Strategy: Force reload via URL change + React Key
                                    setPreviewBgVersion(v => v + 1);
                                }}>
                                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/50 group-hover:scale-110 transition-transform">
                                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6V4z" /></svg>
                                </div>
                            </div>

                            {/* 2. TEXT LAYER */}
                            <div className={`absolute flex flex-col z-10 ${viewingTheme.settings?.textAnimation && viewingTheme.settings?.textAnimation !== 'none' ? `anim-${viewingTheme.settings.textAnimation}` : ''}`}
                                style={{
                                    left: `${viewingTheme.settings?.textBox?.x ?? 50}%`,
                                    top: `${viewingTheme.settings?.textBox?.y ?? 50}%`,
                                    width: `${viewingTheme.settings?.textBox?.w ?? 80}%`,
                                    height: `${viewingTheme.settings?.textBox?.h ?? 40}%`,
                                    transform: 'translate(-50%, -50%)',
                                    // Flex alignment logic to match textAlign
                                    alignItems: viewingTheme.settings?.textAlign === 'left' ? 'flex-start' :
                                        viewingTheme.settings?.textAlign === 'right' ? 'flex-end' : 'center',
                                    justifyContent: viewingTheme.settings?.verticalAlign || 'center',
                                    textAlign: viewingTheme.settings?.textAlign || 'center',

                                    color: viewingTheme.settings?.color || '#ffffff',
                                    fontFamily: viewingTheme.settings?.fontFamily || 'Inter',
                                    fontWeight: viewingTheme.settings?.fontWeight === 'bold' ? 'bold' : 'normal',
                                    fontSize: `${viewingTheme.settings?.fontSize || 50}px`,
                                    textTransform: viewingTheme.settings?.textTransform || 'none',
                                    textShadow: viewingTheme.settings?.textShadowEnabled ?
                                        `${viewingTheme.settings?.textShadowX || 2}px ${viewingTheme.settings?.textShadowY || 2}px ${viewingTheme.settings?.textShadowBlur || 4}px ${viewingTheme.settings?.textShadowColor || '#000'}` : 'none',
                                    WebkitTextStroke: viewingTheme.settings?.textStrokeEnabled ?
                                        `${viewingTheme.settings?.textStrokeWidth || 1}px ${viewingTheme.settings?.textStrokeColor || '#000'}` : undefined,
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.25,
                                    overflow: 'hidden',
                                    animationDuration: '1s',
                                    animationFillMode: 'both'
                                }}
                            >
                                "No princípio criou Deus o céu e a terra."
                            </div>

                            {/* 3. REFERENCE LAYER */}
                            <div className={`absolute z-20 ${viewingTheme.settings?.refAnimation && viewingTheme.settings?.refAnimation !== 'none' ? `anim-${viewingTheme.settings.refAnimation}` : ''}`}
                                style={{
                                    left: `${viewingTheme.settings?.refPos?.x ?? 50}%`,
                                    top: `${viewingTheme.settings?.refPos?.y ?? 80}%`,
                                    transform: 'translate(-50%, -50%)',
                                    // Flexbox for Reference to ensure content is centered in the box
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',

                                    color: viewingTheme.settings?.refColor || viewingTheme.settings?.color || '#ffffff',
                                    fontFamily: viewingTheme.settings?.refFontFamily || viewingTheme.settings?.fontFamily || 'Inter',
                                    fontWeight: 'bold',
                                    fontSize: `${viewingTheme.settings?.refFontSize || 30}px`,
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    textTransform: viewingTheme.settings?.textTransform || 'uppercase',
                                    textShadow: viewingTheme.settings?.refShadowEnabled ?
                                        `${viewingTheme.settings?.refShadowX || 2}px ${viewingTheme.settings?.refShadowY || 2}px ${viewingTheme.settings?.refShadowBlur || 4}px ${viewingTheme.settings?.refShadowColor || '#000'}` : 'none',
                                    WebkitTextStroke: viewingTheme.settings?.refStrokeEnabled ?
                                        `${viewingTheme.settings?.refStrokeWidth || 1}px ${viewingTheme.settings?.refStrokeColor || '#000'}` : undefined,

                                    // Highlight Box Logic
                                    backgroundColor: viewingTheme.settings?.refBgEnabled ? (viewingTheme.settings?.refBgColor || 'rgba(0,0,0,0.5)') : 'transparent',
                                    padding: viewingTheme.settings?.refBgEnabled ? '4px 12px' : '0',
                                    borderRadius: viewingTheme.settings?.refBgRadius ?? 4,

                                    animationDuration: '1s',
                                    animationDelay: '0.2s',
                                    animationFillMode: 'both'
                                }}
                            >
                                Gênesis 1:1
                            </div>
                        </div>

                        {/* FOOTER ACTIONS */}
                        <div className="w-full p-4 flex justify-between items-center bg-[#222] border-t border-[#333] z-10">
                            <div className="text-white">
                                <h3 className="font-bold text-lg">{viewingTheme.name || 'Sem Título'}</h3>
                                <p className="text-xs text-gray-400">Verifique se o layout agrada antes de usar.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setViewingTheme(null)} className="px-5 py-2.5 bg-[#333] hover:bg-[#444] text-white rounded font-bold uppercase transition border border-[#444] text-xs tracking-wider">FECHAR</button>
                                <button onClick={() => { applyTheme(viewingTheme); setViewingTheme(null); setActiveTab('text'); }} className="px-6 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded font-bold uppercase transition shadow-lg shadow-green-900/20 border border-green-600 text-xs tracking-wider flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    USAR TEMA
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SLIDES BAR */}
            <div className="h-28 bg-[#181818] border-t border-[#333] flex items-center gap-4 px-4 overflow-x-auto custom-scrollbar z-40">
                <div className="sticky left-0 bg-[#181818]/95 backdrop-blur-sm px-3 flex flex-col justify-center shrink-0 border-r border-[#333] h-full z-10 min-w-[100px]">
                    <span className="text-xs font-bold text-blue-400 uppercase leading-tight mb-1">{reference}</span>
                    <span className="text-[9px] font-medium text-gray-600 uppercase tracking-widest">{slides.length} SLIDES</span>
                </div>
                {slides.map((s, idx) => (
                    <div key={idx} onClick={() => setCurrentSlideIndex(idx)} className={`shrink-0 w-40 h-20 rounded border-2 cursor-pointer relative overflow-hidden transition ${currentSlideIndex === idx ? 'border-blue-500' : 'border-[#333]'}`}>
                        <div className="absolute inset-0 bg-black" style={{ backgroundColor }}>{background && <img src={background} className="w-full h-full object-cover opacity-60" />}</div>
                        <div className="absolute inset-0 flex items-center justify-center p-2 text-center"><span className="text-[8px] text-white font-bold line-clamp-3" style={{ fontFamily }}>{s}</span></div>
                    </div>
                ))}
            </div>
        </div>
    );
}
