import React, { useState, useEffect, useRef } from 'react';

export default function ProjectionRenderer({ state, currentText }: { state: any, currentText: string }) {
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
    const [fontLoaded, setFontLoaded] = useState(0);
    useEffect(() => {
        if (typeof document !== 'undefined' && (document as any).fonts) {
            (document as any).fonts.ready.then(() => {
                setFontLoaded(prev => prev + 1);
            });
        }
    }, [state.style?.fontFamily]);

    useEffect(() => {
        if (!currentText) return;
        if (textRef.current && state.style?.fontSize) {
            const el = textRef.current;
            const targetSize = parseInt(state.style.fontSize);

            // Reset to target size
            el.style.fontSize = `${targetSize}px`;

            let currentSize = targetSize;
            // Reduce while overflowing
            // Use clientHeight + 1 to account for subpixel rounding differences (V116)
            while (el.scrollHeight > el.clientHeight + 1 && currentSize > 10) {
                currentSize--;
                el.style.fontSize = `${currentSize}px`;
            }
        }
    }, [currentText, state.style?.fontSize, state.style?.fontFamily, state.style?.fontWeight, state.style?.textBox, state.slideIndex, fontLoaded]);

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
