import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useProjectionSync } from '../hooks/useProjectionSync';
import { StorageHelper } from '../lib/storage-helper';

// --- CONFIGURAÇÃO GLOBAL ---
const CHANNEL_NAME = 'music_channel';
const API_ENDPOINT = '/api/status-music';
// ----------------------------

// COMPONENTE TYPEWRITER (EFEITO ESCREVENDO)
const Typewriter = ({ text }: { text: string }) => {
    const [d, setD] = useState('');
    useEffect(() => {
        setD('');
        let i = 0;
        // Velocidade da digitação
        const interval = setInterval(() => {
            setD(prev => text.substring(0, i));
            i++;
            if (i > text.length + 1) clearInterval(interval);
        }, 30); // 30ms por letra
        return () => clearInterval(interval);
    }, [text]);
    return <span style={{ whiteSpace: 'pre-wrap' }}>{d}</span>;
};

export default function MusicProjectionPage() {
    const [state, setState] = useState<any>({
        verseText: '',
        reference: '',
        slideIndex: 0,
        version: 'MUSIC',
        style: null
    });

    const [isLoaded, setIsLoaded] = useState(false);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Resize Handler
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const targetW = 1024;
                const targetH = 576;
                const scaleW = vw / targetW;
                const scaleH = vh / targetH;
                setScale(Math.min(scaleW, scaleH));
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);


    // --- SINCRONIZAÇÃO UNIFICADA (Supabase + Broadcast) ---
    useProjectionSync('receiver', async (data: any) => {
        if (!data) return;

        // Tenta recuperar background do IndexedDB se estiver faltando no payload
        if (data.style && (!data.style.backgroundImage || data.style.backgroundImage.length < 100)) {
            const indexedBg = await StorageHelper.getBackground('music_settings');
            if (indexedBg) {
                data.style = { ...data.style, backgroundImage: indexedBg };
            }
        }

        setState((prev: any) => {
            // Verifica se o dado é realmente novo (deep compare simplificado)
            if (JSON.stringify(prev) === JSON.stringify({ ...prev, ...data })) return prev;

            return {
                ...prev,
                ...data,
                style: data.style === undefined ? prev.style : data.style
            };
        });
        setIsLoaded(true);
    });

    const currentText = state.verseText || '';
    const reference = state.reference || '';
    const style = state.style || {};
    const animation = style.animation || 'none';

    // RENDERIZAÇÃO CONDICIONAL DA ANIMAÇÃO
    const renderTextContent = () => {
        if (animation === 'typewriter') {
            return <Typewriter text={currentText} />;
        }
        return currentText;
    };

    // CLASSES DE ANIMAÇÃO CSS
    const getAnimationClass = () => {
        if (!currentText) return '';
        switch (animation) {
            case 'fade': return 'animate-fade';
            case 'slide': return 'animate-slide-up';
            case 'zoom': return 'animate-zoom';
            default: return '';
        }
    };

    const VIRTUAL_WIDTH = 1024;
    const VIRTUAL_HEIGHT = 576;
    const bgColor = style.backgroundColor || '#000000';
    const bgImage = style.backgroundImage || null;
    const fontFamily = style.fontFamily || 'Inter, sans-serif';
    const textBox = style.textBox || { x: 50, y: 50, w: 80, h: 40 };
    const refPos = style.refPos || { x: 50, y: 80 };

    return (
        <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center">
            <Head>
                <title>Projeção de Música</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Lora:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Roboto:wght@400;700;900&display=swap" rel="stylesheet" />
                {/* CSS DAS ANIMAÇÕES */}
                <style>{`
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
                        font-family: 'SunnySide';
                        src: url('/fonts/SunnySide-Regular.otf') format('opentype'),
                                url('/fonts/SunnySide-Regular.ttf') format('truetype');
                        font-weight: normal;
                        font-style: normal;
                        font-display: block;
                    }

                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    .animate-fade {
                        animation: fadeIn 0.6s ease-out forwards;
                    }

                    @keyframes slideUp { 
                        from { opacity: 0; transform: translate(-50%, -40%); } 
                        to { opacity: 1; transform: translate(-50%, -50%); } 
                    }
                    .animate-slide-up {
                        animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }

                    @keyframes zoomIn { 
                        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); } 
                        70% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
                        100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 
                    }
                    .animate-zoom {
                        animation: zoomIn 0.5s ease-out forwards;
                    }
                `}</style>
            </Head>

            <div
                ref={containerRef}
                style={{
                    width: `${VIRTUAL_WIDTH}px`,
                    height: `${VIRTUAL_HEIGHT}px`,
                    backgroundColor: bgColor,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {(bgImage && bgImage !== 'INDEXED_DB') && (
                    <img src={bgImage} alt="bg" className="absolute inset-0 w-full h-full object-cover" />
                )}

                {currentText && (
                    <>
                        <div
                            // KEY: Força o React a recriar o elemento quando o texto muda, disparando a animação CSS do zero
                            key={`${currentText}-${animation}`}
                            className={getAnimationClass()}
                            style={{
                                position: 'absolute',
                                left: `${textBox.x}%`,
                                top: `${textBox.y}%`,
                                width: `${textBox.w}%`,
                                height: `${textBox.h}%`,
                                transform: 'translate(-50%, -50%)', // Importante para centralizar, mas as animações sobrescrevem isso nos keyframes slideUp e Zoom
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: style.verticalAlign || 'center',
                                alignItems: 'center',
                                textAlign: style.textAlign || 'center',
                                color: style.color || '#ffffff',
                                fontFamily: fontFamily,
                                fontSize: `${style.fontSize || 40}px`,
                                fontWeight: style.fontWeight || '700',
                                textTransform: style.textTransform || 'uppercase',
                                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.2,
                                maxWidth: '100%',
                                maxHeight: '100%',
                                overflow: 'visible'
                            }}
                        >
                            {renderTextContent()}
                        </div>

                        {/* Referência (Nome da Música) - Sem animação de entrada para não distrair */}
                        {reference && (style.showRef !== false) && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${refPos.x}%`,
                                    top: `${refPos.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                    fontFamily: fontFamily,
                                    fontSize: `${style.refFontSize || 20}px`,
                                    color: style.refColor || '#cccccc',
                                    fontWeight: 'bold',
                                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                                    whiteSpace: 'nowrap',
                                    opacity: 0.8
                                }}
                            >
                                {reference}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
