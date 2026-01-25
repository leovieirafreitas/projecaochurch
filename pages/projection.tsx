import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { splitTextIdeally } from '../lib/text-utils';

export default function ProjectionPage() {
    const [state, setState] = useState({
        verseText: '',
        reference: '',
        slideIndex: 0,
        style: null as any
    });

    const VIRTUAL_WIDTH = 1024;
    const VIRTUAL_HEIGHT = 576; // 16:9

    const [scale, setScale] = useState(1);
    const textRef = useRef<HTMLDivElement>(null);

    // Ajusta o scale para caber na janela do projetor/vMix
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

    // 1. BROADCAST INSTANTÂNEO (Zero Latência)
    useEffect(() => {
        const bc = new BroadcastChannel('bible_channel');
        bc.onmessage = (ev) => {
            if (ev.data) {
                setState(prev => ({
                    ...ev.data,
                    // Mantém estilo antigo se o novo for undefined (otimização)
                    style: ev.data.style === undefined ? prev.style : ev.data.style
                }));
            }
        };
        return () => bc.close();
    }, []);

    // 2. POLLING VIA REDE (Para vMix e Externos)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                // Adiciona timestamp para evitar cache do navegador do vMix e proxies
                const res = await fetch(`/api/status?t=${Date.now()}`);
                if (!res.ok) return;

                const data = await res.json();
                setState(prev => {
                    // Deep compare simples para evitar re-render desnecessário e flicker
                    if (prev.verseText === data.verseText &&
                        prev.reference === data.reference &&
                        prev.slideIndex === data.slideIndex &&
                        JSON.stringify(prev.style) === JSON.stringify(data.style)) {
                        return prev;
                    }
                    return { ...prev, ...data };
                });
            } catch (err) { }
        }, 200); // 200ms = 5 updates/segundo (Rápido o suficiente para projeção)
        return () => clearInterval(interval);
    }, []);

    // AUTO-FIT (Ajuste Automático de Tamanho)
    // Se o texto estourar a caixa no vMix (por renderização diferente), diminui a fonte até caber.
    useEffect(() => {
        if (textRef.current && state.style?.fontSize) {
            const el = textRef.current;
            const targetSize = parseInt(state.style.fontSize);

            // Reseta para o tamanho original antes de medir
            el.style.fontSize = `${targetSize}px`;

            let currentSize = targetSize;

            // Reduz enquanto houver overflow vertical (scrollHeight > clientHeight)
            // Tolerância de 1px
            while (el.scrollHeight > el.clientHeight + 1 && currentSize > 10) {
                currentSize--;
                el.style.fontSize = `${currentSize}px`;
            }
        }
    }, [state.verseText, state.style, state.slideIndex, scale]); // Roda sempre que mudar algo

    const slides = splitTextIdeally(state.verseText || '', 180);
    const currentText = slides[state.slideIndex] || slides[0] || "";

    const bgImage = state.style?.backgroundImage || state.style?.background;
    const bgColor = state.style?.backgroundColor || '#000';
    const isAdvanced = state.style?.isAdvancedLayout || state.style?.textBox;

    if (!state.verseText) {
        return (
            <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontFamily: 'sans-serif' }}>
                <Head><title>Projeção Offline</title></Head>
                Aguardando sinal...
            </div>
        );
    }

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: '#000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <Head>
                <title>{state.reference}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <link rel="preload" href="/fonts/Wondra.woff" as="font" type="font/woff" crossOrigin="anonymous" />
                <style>{`
                    @font-face {
                        font-family: 'Wondra';
                        src: url('/fonts/Wondra.woff') format('woff'),
                             url('/fonts/Wondra.ttf') format('truetype');
                        font-weight: normal;
                        font-style: normal;
                        font-display: block;
                    }
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&family=Lora:wght@400;700&family=Montserrat:wght@400;700&display=swap');
                    body { margin: 0; background: #000; overflow: hidden; }
                `}</style>
            </Head>

            <div
                id="virtual-canvas"
                style={{
                    width: `${VIRTUAL_WIDTH}px`,
                    height: `${VIRTUAL_HEIGHT}px`,
                    position: 'relative',
                    backgroundColor: bgColor,
                    backgroundImage: bgImage ? `url(${bgImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    flexShrink: 0,
                    boxShadow: '0 0 50px rgba(0,0,0,0.5)'
                }}
            >
                {isAdvanced ? (
                    <>
                        {/* Texto Versículo */}
                        <div
                            ref={textRef}
                            style={{
                                position: 'absolute',
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
                                fontFamily: state.style?.fontFamily || 'Inter, sans-serif',
                                fontSize: `${state.style?.fontSize || 30}px`,
                                fontWeight: state.style?.fontWeight || 'normal',
                                textTransform: (state.style as any)?.textTransform || 'none',
                                textShadow: 'none', // Sombra removida para respeitar o editor
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.25,
                                maxWidth: '100%',
                                maxHeight: '100%',
                                overflow: 'hidden'
                            }}
                        >
                            {currentText}
                        </div>

                        {/* Referência */}
                        <div
                            style={{
                                position: 'absolute',
                                left: `${(state.style?.refPos?.x || 50)}%`,
                                top: `${(state.style?.refPos?.y || 80)}%`,
                                transform: 'translate(-50%, -50%)',
                                color: state.style?.refColor || state.style?.color || '#ffffff',
                                fontFamily: state.style?.fontFamily || 'Inter, sans-serif',
                                fontSize: `${state.style?.refFontSize || 20}px`,
                                fontWeight: 'bold',
                                textShadow: 'none',
                                opacity: 0.9,
                                textTransform: (state.style as any)?.textTransform || 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {state.reference}
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px' }}>
                        <div style={{ color: state.style?.color || '#ffffff', fontSize: '50px', textAlign: 'center' }}>
                            {currentText}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
