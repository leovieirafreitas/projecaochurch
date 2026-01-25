
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// --- CONFIGURAÇÃO GLOBAL ---
const CHANNEL_NAME = 'music_channel';
const API_ENDPOINT = '/api/status-music';
// ----------------------------

export default function MusicProjectionPage() {
    const [state, setState] = useState<any>({
        verseText: '',
        reference: '',
        slideIndex: 0,
        version: 'MUSIC',
        style: null
    });

    const [isLoaded, setIsLoaded] = useState(false);

    // Scale para caber na tela
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

    // 1. BROADCAST INSTANTÂNEO (Zero Latência)
    useEffect(() => {
        const bc = new BroadcastChannel(CHANNEL_NAME);
        bc.onmessage = (ev) => {
            if (ev.data) {
                setState((prev: any) => ({
                    ...ev.data,
                    // Mantém estilo antigo se o novo for undefined (otimização)
                    style: ev.data.style === undefined ? prev.style : ev.data.style
                }));
            }
        };
        return () => bc.close();
    }, []);

    // 2. POLLING VIA REDE (Para uso remoto / Fallback)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(API_ENDPOINT);
                const data = await res.json();
                setState((prev: any) => {
                    // Evita re-render se for igual
                    if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
                    return data;
                });
                setIsLoaded(true);
            } catch (err) { }
        }, 1000); // 1s
        return () => clearInterval(interval);
    }, []);

    // Renderização
    const currentText = state.verseText || '';
    const reference = state.reference || '';

    // Estilo Default (Caso style venha nulo no inicio)
    const style = state.style || {};

    const VIRTUAL_WIDTH = 1024;
    const VIRTUAL_HEIGHT = 576;

    // Calcular Posições com base no Style
    const bgColor = style.backgroundColor || '#000000';
    const bgImage = style.backgroundImage || null;

    // Guias não aparecem na projeção

    // Fontes
    const fontFamily = style.fontFamily || 'Inter, sans-serif';

    // Box Texto
    const textBox = style.textBox || { x: 50, y: 50, w: 80, h: 40 };
    // Box Ref
    const refPos = style.refPos || { x: 50, y: 80 };

    return (
        <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center">
            <Head>
                <title>Projeção de Música</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                {/* Fontes */}
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Lora:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Roboto:wght@400;700;900&display=swap" rel="stylesheet" />
            </Head>

            {/* CONTAINER ESCALÁVEL */}
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
                {/* Fundo Imagem */}
                {bgImage && <img src={bgImage} alt="bg" className="absolute inset-0 w-full h-full object-cover" />}

                {/* --- CONTEÚDO (TEXTO + REF) --- */}
                {/* Se não tiver texto, não renderiza nada para ficar limpo (Black) */}
                {currentText && (
                    <>
                        {/* Texto Principal */}
                        <div
                            style={{
                                position: 'absolute',
                                left: `${textBox.x}%`,
                                top: `${textBox.y}%`,
                                width: `${textBox.w}%`,
                                height: `${textBox.h}%`,
                                transform: 'translate(-50%, -50%)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: style.verticalAlign || 'center',
                                alignItems: 'normal',
                                textAlign: style.textAlign || 'center',
                                color: style.color || '#ffffff',
                                fontFamily: fontFamily,
                                fontSize: `${style.fontSize || 40}px`,
                                fontWeight: style.fontWeight || '700', // Música geralmente é bold
                                textTransform: style.textTransform || 'uppercase', // Música fica melhor uppercase
                                textShadow: '2px 2px 4px rgba(0,0,0,0.8)', // Sombra padrão se não tiver chroma
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.2,
                                maxWidth: '100%',
                                maxHeight: '100%',
                                overflow: 'hidden'
                            }}
                        >
                            {currentText}
                        </div>

                        {/* Referência (Nome da Música) */}
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
