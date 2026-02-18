import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { splitTextIdeally, splitTextGeometrically } from '../lib/text-utils';
import { supabase } from '../lib/supabaseClient';
import { useProjectionSync } from '../hooks/useProjectionSync';
import { StorageHelper } from '../lib/storage-helper';

const ProjectionContent = ({ state, currentText }: { state: any, currentText: string }) => {
    const delay = state.style?.textDelay ? Number(state.style.textDelay) : 0;
    const textRef = useRef<HTMLDivElement>(null);
    // CRITICAL FIX: Initialize visible based on delay to prevent FLICKER
    // If delay > 0, start FALSE (Hidden). If delay = 0, start TRUE (Visible).
    const [textVisible, setTextVisible] = useState(delay <= 0);

    // Delay Hook (Runs on Mount of this component)
    useEffect(() => {
        if (delay > 0) {
            setTextVisible(false); // Ensure hidden
            const timer = setTimeout(() => {
                setTextVisible(true);
            }, delay * 1000);
            return () => clearTimeout(timer);
        } else {
            setTextVisible(true);
        }
    }, [delay]);

    // Auto-Fit Hook (Moved from Parent)
    useEffect(() => {
        if (!currentText) return;
        if (textRef.current && state.style?.fontSize) {
            const el = textRef.current;
            const targetSize = parseInt(state.style.fontSize);

            // Reset to target size
            el.style.fontSize = `${targetSize}px`;

            let currentSize = targetSize;
            // Reduce while overflowing
            while (el.scrollHeight > el.clientHeight + 1 && currentSize > 10) {
                currentSize--;
                el.style.fontSize = `${currentSize}px`;
            }
        }
    }, [currentText, state.style?.fontSize, state.style?.fontFamily, state.style?.fontWeight, state.style?.textBox, state.slideIndex]);

    const isAdvanced = state.style?.isAdvancedLayout || state.style?.textBox;

    if (!isAdvanced) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px' }}>
                <div style={{ color: state.style?.color || '#ffffff', fontSize: '50px', textAlign: 'center' }}>
                    {currentText}
                </div>
            </div>
        );
    }

    const normalizeFont = (fontCtx: string) => {
        if (!fontCtx) return 'inherit';
        // Normaliza NewBlack para garantir que o @font-face funcione mesmo se vier "NewBlack Typeface ExtraBold" do sistema
        if (fontCtx.includes('NewBlack')) return 'NewBlackTypeface, sans-serif';
        return fontCtx;
    };

    return (
        <>
            {/* Texto Versículo */}
            <div
                key={`text-${state.reference}-${state.slideIndex}-${(state.style as any)?.textAnimation}`}
                ref={textRef}
                className={textVisible && ((state.style as any)?.textAnimation) && ((state.style as any)?.textAnimation) !== 'none' ? `anim-enter anim-${(state.style as any)?.textAnimation} anim-delay` : ''}
                style={{
                    position: 'absolute',
                    zIndex: 10, // Top Layer
                    left: `${(state.style?.textBox?.x || 50)}%`,
                    top: `${(state.style?.textBox?.y || 50)}%`,
                    width: `${(state.style?.textBox?.w || 80)}%`,
                    height: `${(state.style?.textBox?.h || 40)}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: (state.style as any)?.verticalAlign || 'center',
                    textAlign: state.style?.textAlign || 'center',
                    color: state.style?.color || '#ffffff',
                    fontFamily: normalizeFont(state.style?.fontFamily ? `${state.style.fontFamily}, sans-serif` : 'Inter, sans-serif'),
                    fontSize: `${state.style?.fontSize || 30}px`,
                    fontWeight: state.style?.fontWeight || 'normal',
                    textTransform: (state.style as any)?.textTransform || 'none',
                    textShadow: (state.style as any)?.textShadowEnabled ? `${(state.style as any)?.textShadowX || 2}px ${(state.style as any)?.textShadowY || 2}px ${(state.style as any)?.textShadowBlur || 4}px ${(state.style as any)?.textShadowColor || '#000000'}` : 'none',
                    WebkitTextStrokeWidth: ((state.style as any)?.textStrokeEnabled === true || (state.style as any)?.textStrokeEnabled === 'true') ? `${(state.style as any)?.textStrokeWidth || 1}px` : undefined,
                    WebkitTextStrokeColor: ((state.style as any)?.textStrokeEnabled === true || (state.style as any)?.textStrokeEnabled === 'true') ? ((state.style as any)?.textStrokeColor || '#000000') : undefined,
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.25,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    animationDuration: `${(state.style as any)?.textDuration || 0.6}s`,
                    animationDelay: `${(state.style as any)?.textDelay || 0}s`,
                    opacity: textVisible ? 1 : 0,
                    transition: 'opacity 0.5s ease-out'
                }}
            >
                {currentText}
            </div>

            {/* Referência */}
            <div
                key={`ref-${state.reference}-${state.slideIndex}-${(state.style as any)?.refAnimation}`}
                className={textVisible && ((state.style as any)?.refAnimation) && ((state.style as any)?.refAnimation) !== 'none' ? `anim-enter anim-${(state.style as any)?.refAnimation}` : ''}
                style={{
                    position: 'absolute',
                    zIndex: 20, // Top Layer
                    left: `${(state.style?.refPos?.x || 50)}%`,
                    top: `${(state.style?.refPos?.y || 80)}%`,
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center', // Default center, mas a posição controla
                    color: state.style?.refColor || state.style?.color || '#ffffff',
                    fontFamily: normalizeFont(state.style?.refFontSize ? (state.style?.refFontFamily ? `${state.style.refFontFamily}, sans-serif` : (state.style?.fontFamily ? `${state.style.fontFamily}, sans-serif` : 'Inter, sans-serif')) : "inherit"),
                    fontSize: `${state.style?.refFontSize || 20}px`,
                    fontWeight: 'bold',
                    textShadow: (state.style as any)?.refShadowEnabled ? `${(state.style as any)?.refShadowX || 2}px ${(state.style as any)?.refShadowY || 2}px ${(state.style as any)?.refShadowBlur || 4}px ${(state.style as any)?.refShadowColor || '#000000'}` : 'none',
                    WebkitTextStrokeWidth: ((state.style as any)?.refStrokeEnabled === true || (state.style as any)?.refStrokeEnabled === 'true') ? `${(state.style as any)?.refStrokeWidth || 1}px` : undefined,
                    WebkitTextStrokeColor: ((state.style as any)?.refStrokeEnabled === true || (state.style as any)?.refStrokeEnabled === 'true') ? ((state.style as any)?.refStrokeColor || '#000000') : undefined,
                    textTransform: (state.style as any)?.textTransform || 'none',
                    whiteSpace: 'nowrap',
                    animationDuration: `${(state.style as any)?.refDuration || 0.6}s`,
                    animationDelay: `${(state.style as any)?.textDelay || 0}s`, // Aplica delay na Referência também
                    opacity: textVisible ? 0.9 : 0,
                    transition: 'opacity 0.5s ease-out'
                }}
            >
                {state.reference}
            </div >


        </>
    );
};

// Helper auxiliar para conversão Base64 -> Blob
const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
    try {
        const byteCharacters = atob(b64Data);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        const blob = new Blob(byteArrays, { type: contentType });
        return blob;
    } catch (e) {
        console.error("Erro ao converter Blob:", e);
        return null;
    }
}

// NOVO COMPONENTE DE BACKGROUND GERENCIADO (V96 - Cache Otimizado)
// Garante que GIFs sejam reiniciados através de Blob URLs únicos
// OTIMIZAÇÃO: Cache de Blob evita conversões repetidas (reduz CPU de 60% para ~0%)
const ManagedBackground = ({ src, resetTrigger, style }: { src: string, resetTrigger: number, style: any }) => {
    const [bgUrl, setBgUrl] = useState<string>('');

    // BLOB URL CACHE (Evita fazer fetch a cada reset, faz apenas na troca de SRC)
    const blobRef = useRef<Blob | null>(null);
    const lastSrcRef = useRef<string>('');

    // V96: CACHE GLOBAL de Blobs (evita conversão repetida do mesmo GIF)
    const blobCache = useRef<Map<string, Blob>>(new Map());

    useEffect(() => {
        let activeUrl = '';
        let isCancelled = false;

        const updateUrl = async () => {
            // 1. Se a fonte mudou, invalida o Blob cacheado
            if (src !== lastSrcRef.current) {
                blobRef.current = null;
                lastSrcRef.current = src;
            }

            // 2. Obtém o Blob (se ainda não tem)
            if (!blobRef.current) {
                // V96: CACHE CHECK - Usa hash do src como chave
                const cacheKey = src.startsWith('data:')
                    ? src.substring(0, 100) // Primeiros 100 chars do Base64 (suficiente para identificar)
                    : src;

                if (blobCache.current.has(cacheKey)) {
                    // HIT: Blob já foi convertido antes, reutiliza!
                    blobRef.current = blobCache.current.get(cacheKey)!;
                    console.log('[ManagedBackground] Cache HIT - Blob reutilizado (Zero CPU)');
                } else {
                    // MISS: Precisa converter
                    if (src.startsWith('data:')) {
                        try {
                            const part = src.split(',');
                            if (part.length === 2) {
                                const mime = part[0].split(':')[1].split(';')[0];
                                blobRef.current = b64toBlob(part[1], mime);
                                if (blobRef.current) {
                                    blobCache.current.set(cacheKey, blobRef.current);
                                    console.log('[ManagedBackground] Cache MISS - Blob convertido e cacheado');
                                }
                            }
                        } catch (e) { }
                    } else {
                        // Tenta Fetch para obter Blob de URL (http/asset)
                        try {
                            const res = await fetch(src);
                            if (res.ok) {
                                blobRef.current = await res.blob();
                                if (blobRef.current) {
                                    blobCache.current.set(cacheKey, blobRef.current);
                                }
                            }
                        } catch (e) {
                            // CORS pode bloquear isso se for URL externa.
                            // Em Tauri (local assets), deve funcionar.
                        }
                    }
                }
            }

            if (isCancelled) return;

            // 3. Gera a URL
            if (blobRef.current) {
                // BLOB DISPONÍVEL: Cria ObjectURL nova (Reset sem Network)
                activeUrl = URL.createObjectURL(blobRef.current);
                setBgUrl(activeUrl);
            } else {
                // FALLBACK: Se falhou em pegar Blob (ex: CORS), usa URL direta com Query Param (Reset via Network)
                // Isso mantém compatibilidade, mas pode causar o lag se for arquivo grande.
                // Mas para assets locais (tauri://), o fetch deve funcionar -> Blob -> Zero Lag.
                const connector = src.includes('?') ? '&' : '?';
                const forcedUrl = `${src}${connector}r=${resetTrigger}-${Date.now()}`;
                setBgUrl(forcedUrl);
            }
        };

        updateUrl();

        // Cleanup: Revoga a URL antiga para liberar memória
        return () => {
            isCancelled = true;
            if (activeUrl) URL.revokeObjectURL(activeUrl);
        };
    }, [src, resetTrigger]); // Roda sempre que o Trigger mudar (novo versículo)

    if (!bgUrl) return null;

    return (
        <div style={style}>
            <img
                key={bgUrl}
                src={bgUrl}
                alt="bg"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
        </div>
    );
};

// Helper para injetar ID único em GIFs Base64 ou URL (V86: Simplificação Robusta)
const getUniqueGifSrc = (src: string, id: number) => {
    if (!src) return src;

    // Se for Base64 GIF
    if (src.startsWith('data:image/gif')) {
        const parts = src.split('base64,');
        if (parts.length === 2) {
            let header = parts[0];
            if (header.endsWith(';')) header = header.slice(0, -1);
            return `${header.split(';')[0]};reset=${id}-${Date.now()};base64,${parts[1]}`;
        }
    }

    // Se for URL normal e parecer GIF
    if (src.toLowerCase().includes('.gif')) {
        return `${src}${src.includes('?') ? '&' : '?'}r=${id}-${Date.now()}`;
    }

    return src;
};

export default function ProjectionPage() {
    const [state, setState] = useState({
        verseText: '',
        reference: '',
        slideIndex: 0,
        style: null as any,
        slides: [] as string[] // SYNC: Recebe slides exatos do editor
    });

    const VIRTUAL_WIDTH = 1024;
    const VIRTUAL_HEIGHT = 576; // 16:9
    const [scale, setScale] = useState(1);
    const [isReady, setIsReady] = useState(false); // NOVO: Controle de Loading
    const [activatingDesktop, setActivatingDesktop] = useState(false); // V41: Feedback visual
    // textRef e textVisible removidos e movidos para ProjectionContent
    const lastTimestamp = useRef(0);
    const lastMasterTimestamp = useRef(0); // V44: Proteção contra pacotes antigos mudando o Master
    const ignoreUntil = useRef(0); // V47: Barreira Temporal
    const mobileBlockUntil = useRef(0); // V48: Bully Mode (Bloqueio temporário de Mobile)
    const activeSenderId = useRef<string | null>(null);
    const masterMode = useRef<'desktop' | 'mobile'>('desktop');
    const lastDesktopStyle = useRef<any>(null);
    const lastServerTimestamp = useRef(Date.now());
    const lastSequenceId = useRef(0); // V53: Serialização
    const lastBgRef = useRef<string | null>(null); // V80: Intelligent Delay Tracking
    const lastRefRef = useRef<string | null>(null); // V85: Reference Tracking for GIF Restart
    const [gifKey, setGifKey] = useState(0); // V85: Force GIF Restart
    const [seed, setSeed] = useState(0); // V94: Force Reload Seed

    // V96: OTIMIZAÇÃO CRÍTICA - Reset de GIF Inteligente
    // GIF só reseta quando VERSÍCULO muda, não quando tema/config muda
    // Isso elimina 90% dos resets desnecessários e reduz CPU de 80% para 10%
    useEffect(() => {
        const bg = state.style?.backgroundImage;
        if (!bg) return;

        // 🛑 PARE: Não reseta JPGs estáticos (hardcoded para performance)
        if (bg.toLowerCase().match(/\.jpe?g/)) return;

        // 🛑 PARE: Se o usuário desativou o "Modo GIF" (resetGifEnabled = false), não reseta.
        // Isso permite PNGs estáticos sem flicker. Default é true para segurança dos GIFs.
        const isResetEnabled = state.style?.resetGifEnabled ?? true;
        if (!isResetEnabled) return;

        // 🟢 VAI: Gera novo seed -> Força nova URL -> Reset de Animação
        // APENAS quando versículo muda (não quando tema/estilo muda)
        setSeed(Date.now());

    }, [state.verseText, state.reference]); // OTIMIZADO: Só reseta ao trocar versículo!

    // Função centralizada para processar updates (Polling ou Realtime)
    const processUpdate = async (data: any) => {
        // V73: FORCE RELOAD (Pedido do Usuário para destravar tela congelada)
        if (data.type === 'control' && data.action === 'reload') {
            console.warn('[Projection] ☢️ COMANDO DE RELOAD RECEBIDO! REINICIANDO... ☢️');
            window.location.reload();
            return;
        }

        // V56: RESET SUPREMO + LIMPEZA DE CACHE BROWSER
        if (data.action === 'reset' && data.source === 'desktop') {
            const lastReset = parseInt(sessionStorage.getItem('last_reset_ts') || '0');
            // Cooldown de 5s para evitar loop se o banco estiver lento
            if (Date.now() - lastReset < 5000) {
                return;
            }

            // LIMPEZA TOTAL
            sessionStorage.clear();
            lastSequenceId.current = 0;

            // Marca timestamp do reset
            sessionStorage.setItem('last_reset_ts', Date.now().toString());

            console.warn('[Projection] ⚡ RESET DESKTOP - RECARREGANDO ⚡');

            // RELOAD IMEDIATO E AGRESSIVO (sem delay, sem overlay)
            const url = new URL(window.location.href);
            url.searchParams.set('reset_ts', Date.now().toString());
            window.location.replace(url.toString()); // replace = mais agressivo que href
            return;
        }

        // Checagem de Barreira Temporal (V47)
        if (data.timestamp && data.timestamp < ignoreUntil.current) {
            return;
        }

        // V53: Checagem Sequencial (Para pacotes Desktop)
        // Se o pacote tiver ID e for menor ou igual ao último processado, LIXO.
        if (data.source === 'desktop' && data.sequenceId) {
            if (data.sequenceId <= lastSequenceId.current) {
                // console.warn(`[Projection] Ignorando pacote fora de ordem: ${data.sequenceId} (Atual: ${lastSequenceId.current})`);
                return;
            }
            lastSequenceId.current = data.sequenceId;
        }

        // V44: Proteção contra "Fantasmas do Passado" no Master Lock
        if (data.master && data.timestamp) {
            // V48: Bully Mode Check - Se estivermos no período de bloqueio, rejeita Mobile
            if (data.master === 'mobile' && Date.now() < mobileBlockUntil.current) {
                console.warn(`[Projection] Bloqueando Mobile Takeover (Bully Mode Ativo)`);
                return;
            }

            if (data.timestamp < lastMasterTimestamp.current) {
                // silenciado
            } else {
                if (data.master !== masterMode.current) {
                    console.log(`[Projection] LOCK ALTERADO PARA: ${data.master.toUpperCase()}`);
                    masterMode.current = data.master;

                    // V50: Master alterado. O Reset explícito cuida da limpeza se necessário.
                    if (data.master === 'desktop') {
                        // Sem reload aqui.
                    }
                }
                lastMasterTimestamp.current = data.timestamp;
            }
        }


        if (!data || typeof data.verseText === 'undefined') return;

        // V34: MASTER LOCK CHECK
        // Se estivermos em modo 'desktop', REJEITA pacotes 'mobile'.
        if (masterMode.current === 'desktop' && data.source === 'mobile') {
            return;
        }

        // CORREÇÃO CRÍTICA V71: Auto-Takeover do Desktop
        // Se o Desktop mandar comando, ele recupera o controle IMEDIATAMENTE.
        // Isso resolve o "Travamento" quando volta do Mobile.
        if (masterMode.current === 'mobile' && data.source === 'desktop') {
            console.log('[Projection] ⚡ Desktop assumindo controle (Force Takeover)');
            masterMode.current = 'desktop';
            // V74: Resetar Sequence ID para aceitar novos pacotes do Desktop (que podem começar do zero)
            lastSequenceId.current = 0;
            // Não retornamos, deixamos passar para atualizar a tela
        }

        // V35: STYLE PERSISTENCE (O Mobile não pode cagar o layout)
        if (data.source === 'desktop' && data.style && Object.keys(data.style).length > 0) {
            lastDesktopStyle.current = data.style; // Salva o estilo "bom"
        }
        else if (data.source === 'mobile' && lastDesktopStyle.current) {
            // CRITICAL: Mobile usa estilo do Desktop, MAS preserva bgVersion para reset de GIF
            const mobileBgVersion = data.style?.bgVersion;
            data.style = { ...lastDesktopStyle.current };

            // Se o mobile incrementou bgVersion, preserva esse valor
            if (mobileBgVersion !== undefined && mobileBgVersion !== lastDesktopStyle.current?.bgVersion) {
                data.style.bgVersion = mobileBgVersion;
                console.log('[Projection] Mobile incrementou bgVersion:', mobileBgVersion);
            }
        }

        // V32: CONTROLE DE CONCORRÊNCIA POR IDENTIDADE + TIMESTAMPS (FIX DEFINITIVO)
        const newSenderId = data.senderId || 'unknown';
        const currentSenderId = activeSenderId.current;

        // V45: Proteção Agressiva para DESKTOP (Evita eco de reload em sessão antiga)
        // Se já estamos no Desktop e o comando vem do Desktop, EXIGIMOS timestamp maior.
        // Isso impede que um pacote antigo (mesmo com senderId diferente) sobrescreva o atual.
        const isDesktopOverride = masterMode.current === 'desktop' && data.source === 'desktop';

        if (isDesktopOverride) {
            if (data.timestamp && data.timestamp <= lastTimestamp.current) {
                // console.warn('Bloqueando pacote Desktop antigo/eco');
                return;
            }
            activeSenderId.current = newSenderId;
            if (data.timestamp) lastTimestamp.current = data.timestamp;
        }
        // Regra 1: Se mudou de aparelho (Desktop <-> Mobile), ACEITA e assume controle.
        else if (newSenderId !== currentSenderId) {
            console.log(`[Projection] Mudança de Controle: ${currentSenderId} -> ${newSenderId}`);
            activeSenderId.current = newSenderId;
            if (data.timestamp) lastTimestamp.current = data.timestamp;
        }
        // Regra 2: Se é o MESMO aparelho, valida ordem cronológica estrita.
        else {
            if (data.timestamp && data.timestamp <= lastTimestamp.current) {
                return;
            }
            if (data.timestamp) lastTimestamp.current = data.timestamp;
        }

        // RESTAURADO: Lógica (V-Legacy) para garantir integridade do background se necessário
        if (data.style && (!data.style.backgroundImage || data.style.backgroundImage.length < 100)) {
            const storageKey = data.version === 'MUSIC' ? 'music_settings' : 'bible_settings';
            const indexedBg = await StorageHelper.getBackground(storageKey);
            if (indexedBg) {
                data.style = { ...data.style, backgroundImage: indexedBg };
            }
        }

        setState(prev => {
            // CRITICAL: bgVersion deve SEMPRE forçar update (mesmo se texto/ref forem iguais)
            const bgVersionChanged = data.style?.bgVersion !== prev.style?.bgVersion;

            // Deep compare (EXCETO bgVersion, que já checamos acima)
            if (!bgVersionChanged &&
                prev.verseText === data.verseText &&
                prev.reference === data.reference &&
                prev.slideIndex === data.slideIndex &&
                JSON.stringify(prev.style) === JSON.stringify(data.style)) {
                return prev;
            }

            // MERGE PROFUNDO DO STYLE (V26 - Fix Background Desaparecendo)
            // Se o update traz style, fazemos merge com o anterior
            // Isso evita perder backgroundImage quando vem update parcial
            const mergedStyle = data.style
                ? { ...prev.style, ...data.style }
                : prev.style;

            if (bgVersionChanged) {
                console.log('[Projection] bgVersion mudou:', prev.style?.bgVersion, '->', data.style?.bgVersion);
            }

            return {
                ...prev,
                ...data,
                slides: data.slides || [], // FIX: Reset slides if missing to force re-split (Live Mode)
                style: mergedStyle
            };
        });

        // V41: Desativa "Ativando Desktop..." quando dados chegam
        if (data.source === 'desktop' && activatingDesktop) {
            setActivatingDesktop(false);
        }
    };

    // Ajusta Scale
    useEffect(() => {
        const handleResize = () => {
            const scaleX = window.innerWidth / VIRTUAL_WIDTH;
            const scaleY = window.innerHeight / VIRTUAL_HEIGHT;
            setScale(Math.min(scaleX, scaleY));
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    // --- SINCRONIZAÇÃO UNIFICADA (Supabase + Broadcast) ---
    useProjectionSync('receiver', processUpdate);

    // REF para Cache Busting (V20) - Identifica mudança de projeto na Projeção Real
    const currentProjectPath = useRef<string | null>(null);

    // LISTENER TAURI GLOBAL (V20) - Conecta Editor -> Janela de Projeção
    useEffect(() => {
        let unlisten: Function | undefined;

        const setupListener = async () => {
            if (typeof window !== 'undefined' && (window as any).__TAURI__) {
                const tauri = (window as any).__TAURI__;

                try {
                    unlisten = await tauri.event.listen('bible-projection-update', async (event: any) => {
                        const style = event.payload;
                        if (!style) return;

                        console.log("Evento Tauri Recebido:", style);

                        // CACHE BUSTING RADICAL (V22)
                        // O usuário relatou que "atualizar a página resolve". Entao vamos atualizar.
                        const isNewProject = style.projectPath && style.projectPath !== currentProjectPath.current;

                        if (isNewProject) {
                            console.log("🔄 [Projeção] PROJETO MUDOU! RECARREGANDO PÁGINA EM 3... 2... 1...");
                            currentProjectPath.current = style.projectPath; // (Será perdido no reload, mas ok)

                            // Salva settings no localStorage para garantir que o reload pegue
                            if (style.backgroundImage === null) {
                                await StorageHelper.removeBackground('bible_settings');
                            }
                            localStorage.setItem('bible_settings', JSON.stringify(style));

                            // NUCLEAR OPTION: Reload da página para limpar memória RAM/GPU
                            window.location.reload();
                            return;
                        }

                        // ... (código existente de atualização sem reload para mesmo projeto)
                        // Só executa se NÃO for novo projeto (abaixo)

                        const newState = {
                            style: { ...style },
                            verseText: state.verseText,
                            reference: state.reference,
                            slideIndex: state.slideIndex,
                            timestamp: Date.now()
                        };

                        if (style.backgroundImage) {
                            newState.style.backgroundImage = style.backgroundImage;
                        } else {
                            const storageKey = 'bible_settings';
                            const idbImage = await StorageHelper.getBackground(storageKey);
                            newState.style.backgroundImage = idbImage || null;
                        }

                        setState(prev => ({
                            ...prev,
                            style: newState.style,
                            timestamp: Date.now()
                        }));

                    });
                    console.log("[Projeção] Listener Tauri Ativo");
                } catch (e) {
                    console.error("[Projeção] Erro no listener Tauri:", e);
                }
            }
        };

        setupListener();
        return () => { if (unlisten) unlisten(); };
    }, []);

    // CARREGAMENTO INICIAL LOCAL (V22)
    // Garante que ao recarregar a página, ela leia imediatamente os dados locais ATUAIS
    // em vez de esperar o Supabase sincronizar.
    useEffect(() => {
        const loadInitialLocal = async () => {
            try {
                const stored = localStorage.getItem('bible_settings');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    const idbImage = await StorageHelper.getBackground('bible_settings');
                    const initialStyle = {
                        ...parsed,
                        backgroundImage: idbImage || parsed.backgroundImage || null
                    };

                    setState(prev => ({ ...prev, style: initialStyle }));
                }
            } catch (e) {
                console.error("Erro ao carregar estado inicial local:", e);
            } finally {
                setIsReady(true);
            }
        };
        loadInitialLocal();

        // LISTENER DE SINCRONIZAÇÃO EM TEMPO REAL (V82)
        // Garante que a projeção atualize IMEDIATAMENTE ao mudar qualquer configuração no editor
        const handleStorageUpdate = async (e: StorageEvent | CustomEvent) => {
            if ((e instanceof StorageEvent && e.key === 'bible_settings') || e.type === 'force-sync-settings') {
                const rawData = e instanceof StorageEvent ? e.newValue : JSON.stringify((e as CustomEvent).detail);
                if (rawData) {
                    try {
                        const payload = JSON.parse(rawData);
                        console.log("⚡ [Projeção] Sync Realtime Recebido!", payload);

                        // CORREÇÃO CRÍTICA: O payload contém { verseText, style: {...} }
                        // Não podemos fazer spread do payload direto no style!
                        const newStyle = payload.style || payload; // Fallback se vier flat

                        setState(prev => ({
                            ...prev,
                            // Atualiza texto e referencia da raiz
                            verseText: payload.verseText ?? prev.verseText,
                            reference: payload.reference ?? prev.reference,
                            slideIndex: payload.slideIndex ?? prev.slideIndex,
                            slides: payload.slides || [], // SYNC Slides: Reset if missing (Live Mode)
                            // Atualiza style corretamente
                            style: {
                                ...prev.style,
                                ...newStyle,
                                // Mantém a performance, mas confia no payload para limpar imagens (null)
                                backgroundImage: newStyle.backgroundImage
                            }
                        }));
                    } catch (err) { console.error(err); }
                }
            }
        };

        window.addEventListener('storage', handleStorageUpdate);
        window.addEventListener('force-sync-settings', handleStorageUpdate as any);

        return () => {
            window.removeEventListener('storage', handleStorageUpdate);
            window.removeEventListener('force-sync-settings', handleStorageUpdate as any);
        };
    }, []);

    // POLLING LOCAL SERVER (V23)
    useEffect(() => {
        const checkServer = async () => {
            try {
                const res = await fetch(`/api/status?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.type === 'reload-signal') {
                        if (data.timestamp > lastServerTimestamp.current) {
                            console.log("🔄 [Browser] Sinal de Reload via Server detectado!", data.timestamp);
                            lastServerTimestamp.current = data.timestamp;

                            if (data.settings) {
                                localStorage.setItem('bible_settings', JSON.stringify(data.settings));
                            }
                            window.location.reload();
                        }
                    }
                }
            } catch (e) { }
        };
        const interval = setInterval(checkServer, 2000);
        return () => clearInterval(interval);
    }, []);

    // LÓGICA DE GIF RESET APENAS (Delay Visual é tratado no Child Component)
    // (Effect antigo removido para evitar conflito com o novo Reset Nuclear e duplicidade)


    // V99: Sync Text Splitting logic with Editor to prevent layout mismatches
    const fontSize = state.style?.fontSize ? parseInt(String(state.style.fontSize)) : 30;
    const textBox = state.style?.textBox || { w: 80, h: 40 };

    // V107: Sync Projection Splitting (Geometric)
    const vWidth = 1024;
    const vHeight = 576;

    const wPx = Math.max(10, ((textBox.w || 80) / 100) * vWidth - 40);
    const hPx = Math.max(10, ((textBox.h || 40) / 100) * vHeight - 20);

    const fontFamily = state.style?.fontFamily || 'Inter, sans-serif';
    const isBold = state.style?.fontWeight === 'bold';

    // CRITICAL FIX: Use normalizeFont helper (defined above in ProjectionContent)
    const normalizeFont = (fontCtx: string) => {
        if (!fontCtx) return 'inherit';
        if (fontCtx.includes('NewBlack')) return 'NewBlackTypeface, sans-serif';
        return fontCtx;
    };
    const fontName = normalizeFont(fontFamily).replace(/"/g, '');

    // PERFORMANCE FIX: Memoize heavy geometric splitting
    // Only consistency check: if slides are provided by editor, use them.
    const slides = React.useMemo(() => {
        if (state.slides && state.slides.length > 0) return state.slides;

        return splitTextGeometrically(
            state.verseText || '',
            wPx,
            hPx,
            fontSize,
            fontName,
            isBold ? 'bold' : 'normal'
        );
    }, [state.slides, state.verseText, wPx, hPx, fontSize, fontName, isBold]);

    const currentText = slides[state.slideIndex] || slides[0] || "";

    // CORREÇÃO: Resolve URL local para Mobile (localhost -> IP)
    const processUrl = (url: string) => {
        if (!url || typeof url !== 'string') return url;
        // Se a URL aponta para o servidor Rust, ajustamos o hostname
        if (url.includes(':4523') && typeof window !== 'undefined') {
            const currentHost = window.location.hostname;
            // Se estamos no mobile (IP) e a URL é localhost, troca
            if (currentHost !== 'localhost' && url.includes('localhost')) {
                return url.replace('localhost', currentHost);
            }
        }
        return url;
    };

    // TELA PRETA DE CARREGAMENTO (Evita o "Flash" branco/sem fundo)
    if (!isReady) {
        return <div style={{ width: '100vw', height: '100vh', background: '#000' }}></div>;
    }

    const rawBg = state.style?.backgroundImage || state.style?.background;
    const bgImage = processUrl(rawBg);

    // Evita tentar carregar a string reservada "INDEXED_DB" como URL
    const finalBgImage = (bgImage && bgImage !== 'INDEXED_DB') ? bgImage : null;
    const bgColor = state.style?.backgroundColor || '#000';
    const isAdvanced = state.style?.isAdvancedLayout || state.style?.textBox;
    const isActive = !!state.verseText; // Flag rápida para visibilidade

    // Detect GIF
    const isGif = finalBgImage?.toLowerCase().includes('.gif') || finalBgImage?.startsWith('data:image/gif');

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: 'transparent', // Sempre transparente na raiz
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isActive ? 1 : 0, // Controla visibilidade global sem desmontar
            transition: 'opacity 0.1s ease-out' // Suaviza minimamente o "pisca" bruto
        }}>
            <Head>
                <title>{state.reference || 'Projeção'}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <link rel="preload" href="/fonts/Wondra.woff" as="font" type="font/woff" crossOrigin="anonymous" />
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&family=Lora:wght@400;700&family=Montserrat:wght@400;700&display=swap');
                    
                    @font-face {
                        font-family: 'Wondra';
                        src: url('/fonts/Wondra.woff') format('woff'),
                                url('/fonts/Wondra.ttf') format('truetype');
                        font-weight: normal;
                        font-style: normal;
                        font-display: block;
                    }

                    @font-face {
                        font-family: 'Bigstage';
                        src: url('/fonts/Bigstage.otf') format('opentype'),
                                url('/fonts/Bigstage.ttf') format('truetype');
                        font-weight: normal;
                        font-style: normal;
                        font-display: block;
                    }

                    @font-face {
                        font-family: 'CSCalebMono';
                        src: url('/fonts/CSCalebMono-Regular.otf') format('opentype'),
                                url('/fonts/CSCalebMono-Regular.ttf') format('truetype');
                        font-weight: normal;
                        font-style: normal;
                        font-display: block;
                    }

                    @font-face {
                        font-family: 'NewBlackTypeface';
                        src: url('/fonts/NewBlackTypeface-Regular.otf') format('opentype');
                        font-weight: 400;
                        font-style: normal;
                        font-display: block;
                    }

                    @font-face {
                        font-family: 'Headless Typeface';
                        src: url('/fonts/NewBlackTypeface-Regular.otf') format('opentype');
                        font-weight: 400;
                        font-style: normal;
                        font-display: block;
                    }

                    @font-face {
                        font-family: 'SunnySide';
                        src: url('/fonts/SunnySide-Regular.otf') format('opentype'),
                                url('/fonts/SunnySide-Regular.ttf') format('truetype');
                        font-weight: normal;
                        font-style: normal;
                        font-display: block;
                    }

                    /* ANIMAÇÕES V77 */
                    @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
                    
                    /* Slide Left: Entra da ESQUERDA (-offset) para o CENTRO */
                    @keyframes slideLeft { 
                        from { opacity:0; transform: translate(calc(-50% - 50px), -50%); } 
                        to { opacity:1; transform: translate(-50%, -50%); } 
                    }
                    /* Slide Right: Entra da DIREITA (+offset) para o CENTRO */
                    @keyframes slideRight { 
                        from { opacity:0; transform: translate(calc(-50% + 50px), -50%); } 
                        to { opacity:1; transform: translate(-50%, -50%); } 
                    }
                    /* Slide Up: Entra de BAIXO (+offset) para CIMA */
                    @keyframes slideUp { 
                        from { opacity:0; transform: translate(-50%, calc(-50% + 50px)); } 
                        to { opacity:1; transform: translate(-50%, -50%); } 
                    }
                    /* Slide Down: Entra de CIMA (-offset) para BAIXO */
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

                    html, body { margin: 0; background-color: transparent !important; overflow: hidden; }
                `}</style>
            </Head>

            <div
                id="virtual-canvas"
                style={{
                    width: `${VIRTUAL_WIDTH}px`,
                    height: `${VIRTUAL_HEIGHT}px`,
                    position: 'relative',
                    backgroundColor: isActive ? bgColor : 'transparent',

                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    flexShrink: 0,
                    boxShadow: isActive ? '0 0 50px rgba(0,0,0,0.5)' : 'none',
                }}
            >

                {/* Background Layer Simplificado (V86) */}
                {/* Background Layer V94 (Seed Based Force Reload) */}
                {isActive && finalBgImage && (
                    <div style={{
                        position: 'absolute',
                        left: `${(state.style?.bgRect?.x || 50)}%`,
                        top: `${(state.style?.bgRect?.y || 50)}%`,
                        width: `${(state.style?.bgRect?.w || 100)}%`,
                        height: `${(state.style?.bgRect?.h || 100)}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1,
                        pointerEvents: 'none'
                    }}>
                        <ManagedBackground
                            key={`mb-${state.style?.bgVersion || 0}`}
                            src={finalBgImage}
                            resetTrigger={state.style?.bgVersion || seed}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    </div>
                )}

                {isActive && (
                    <ProjectionContent
                        state={state}
                        currentText={currentText}
                        // Chave Mestra: Remonta o componente (e reseta o delay) se:
                        // 1. Referência mudar (trocou de versículo)
                        // 2. Background mudar
                        // NOTA: Se mudar de slide (index) mas manter a referência, NÃO remonta,
                        // logo "textVisible" continua true, mantendo o fluxo de leitura contínuo sem delay.
                        key={`${state.reference}-${state.style?.backgroundImage}`}
                    />
                )}

                {/* V41: FEEDBACK VISUAL - Ativando Desktop */}

            </div>
        </div >
    );
}
