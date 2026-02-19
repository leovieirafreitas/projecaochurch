import React, { useState, useEffect, useRef, useCallback } from 'react';
import { splitTextGeometrically } from '../lib/text-utils';
import { StorageHelper } from '../lib/storage-helper';
import ProjectionRenderer from './ProjectionRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DrawPath {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    isEraser: boolean;
}

interface DrawModalProps {
    onClose: () => void;
}

// ─── Palette Colors ───────────────────────────────────────────────────────────
const COLORS = [
    '#ff3b3b', '#ff9f0a', '#ffd60a', '#30d158',
    '#00c7be', '#0a84ff', '#bf5af2', '#ff375f',
    '#ffffff', '#aeaeb2', '#636366', '#1c1c1e',
];

const BRUSH_SIZES = [3, 6, 12, 22];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DrawModal({ onClose }: DrawModalProps) {
    // --- Slide state (from localStorage) ---
    const [slideState, setSlideState] = useState<any>(null);
    const [currentText, setCurrentText] = useState('');
    const [bgImage, setBgImage] = useState<string | null>(null);

    // --- Drawing state ---
    const [paths, setPaths] = useState<DrawPath[]>([]);
    const [activeColor, setActiveColor] = useState('#ff3b3b');
    const [activeSize, setActiveSize] = useState(6);
    const [isEraser, setIsEraser] = useState(false);
    const [isDrawingVisible, setIsDrawingVisible] = useState(true); // Toggle projection overlay

    // --- Canvas refs ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const currentPath = useRef<DrawPath | null>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    // ─── Load current slide state ─────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const raw = localStorage.getItem('bible_settings');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    setSlideState(parsed);

                    // Get current text
                    const slides: string[] = parsed.slides || [];
                    const idx: number = parsed.slideIndex ?? 0;
                    setCurrentText(slides[idx] || parsed.verseText || '');

                    // Load background
                    const idbBg = await StorageHelper.getBackground('bible_settings');
                    const bg = idbBg || parsed.style?.backgroundImage || null;
                    if (bg && bg !== 'INDEXED_DB') setBgImage(bg);
                }
            } catch (e) {
                console.error('[DrawModal] Erro ao carregar estado:', e);
            }
        };
        load();

        // Live sync: update when slide changes
        const handleSync = (e: StorageEvent | CustomEvent) => {
            const raw = e instanceof StorageEvent ? e.newValue : JSON.stringify((e as CustomEvent).detail);
            if (!raw) return;
            try {
                const parsed = JSON.parse(raw);
                setSlideState(parsed);
                const slides: string[] = parsed.slides || [];
                const idx: number = parsed.slideIndex ?? 0;
                setCurrentText(slides[idx] || parsed.verseText || '');
            } catch { }
        };

        window.addEventListener('storage', handleSync as any);
        window.addEventListener('force-sync-settings', handleSync as any);
        return () => {
            window.removeEventListener('storage', handleSync as any);
            window.removeEventListener('force-sync-settings', handleSync as any);
        };
    }, []);

    // ─── Broadcast Channel ────────────────────────────────────────────────────
    useEffect(() => {
        const bc = new BroadcastChannel('drawing_channel');
        channelRef.current = bc;
        return () => bc.close();
    }, []);

    const broadcastPaths = useCallback((updatedPaths: DrawPath[]) => {
        channelRef.current?.postMessage({ type: 'SYNC_PATHS', payload: updatedPaths });
    }, []);

    // ─── Canvas redraw ────────────────────────────────────────────────────────
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Match internal resolution to display size
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        paths.forEach(path => {
            if (path.points.length < 1) return;
            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = path.width;

            if (path.isEraser) {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = path.color;
            }

            const w = canvas.width;
            const h = canvas.height;
            ctx.moveTo((path.points[0].x / 100) * w, (path.points[0].y / 100) * h);
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo((path.points[i].x / 100) * w, (path.points[i].y / 100) * h);
            }
            ctx.stroke();
        });

        ctx.globalCompositeOperation = 'source-over';
    }, [paths]);

    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    // ─── Pointer Events ───────────────────────────────────────────────────────
    const getPercent = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        };
    };

    const onPointerDown = (e: React.PointerEvent) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        isDrawing.current = true;
        const pt = getPercent(e);
        const newPath: DrawPath = {
            id: Date.now().toString(),
            points: [pt],
            color: isEraser ? '#000' : activeColor,
            width: isEraser ? activeSize * 3 : activeSize,
            isEraser,
        };
        currentPath.current = newPath;
        setPaths(prev => [...prev, newPath]);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!isDrawing.current || !currentPath.current) return;
        const pt = getPercent(e);
        currentPath.current.points.push(pt);
        // Trigger redraw
        setPaths(prev => [...prev]);
    };

    const onPointerUp = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        const finalPaths = [...paths];
        broadcastPaths(finalPaths);
        currentPath.current = null;
    };

    // ─── Actions ──────────────────────────────────────────────────────────────
    const handleUndo = () => {
        setPaths(prev => {
            const updated = prev.slice(0, -1);
            broadcastPaths(updated);
            return updated;
        });
    };

    const handleClear = () => {
        setPaths([]);
        channelRef.current?.postMessage({ type: 'CLEAR' });
        // Also clear canvas visually
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const toggleProjectionDraw = () => {
        const newVisible = !isDrawingVisible;
        setIsDrawingVisible(newVisible);
        if (newVisible) {
            broadcastPaths(paths);
        } else {
            channelRef.current?.postMessage({ type: 'CLEAR' });
        }
    };

    // ─── Style inferences ─────────────────────────────────────────────────────
    const style = slideState?.style || {};
    const bgColor = style.backgroundColor || '#000';

    const normalizeFont = (f: string) => {
        if (!f) return 'Inter, sans-serif';
        if (f.includes('NewBlack')) return 'NewBlackTypeface, sans-serif';
        return f;
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>

            {/* ─── HEADER ─────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-3 bg-[#1a1a1a] border-b border-[#333] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-lg">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-white font-bold text-sm">Draw Projection</div>
                        <div className="text-gray-500 text-[10px] uppercase tracking-widest">Desenhe sobre a projeção</div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Toggle projection draw */}
                    <button
                        onClick={toggleProjectionDraw}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${isDrawingVisible
                            ? 'bg-orange-600 border-orange-500 text-white shadow-orange-500/30 shadow-lg'
                            : 'bg-[#2a2a2a] border-[#444] text-gray-400 hover:border-gray-500'
                            }`}
                        title="Mostrar/Ocultar desenhos na projeção"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            {isDrawingVisible ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>}
                        </svg>
                        {isDrawingVisible ? 'Projetando' : 'Oculto'}
                    </button>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-[#2a2a2a] hover:bg-red-600 border border-[#444] hover:border-red-500 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ─── BODY ────────────────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── LEFT: Tools Panel ───────────────────────────────────────── */}
                <div className="w-[200px] bg-[#141414] border-r border-[#2a2a2a] flex flex-col gap-1 p-4 shrink-0 overflow-y-auto">

                    {/* Tool: Pen / Eraser */}
                    <div className="text-[9px] uppercase tracking-widest text-gray-600 mb-1">Ferramenta</div>
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                        <button
                            onClick={() => setIsEraser(false)}
                            className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border transition-all text-xs font-medium ${!isEraser ? 'bg-orange-600 border-orange-500 text-white' : 'bg-[#1e1e1e] border-[#333] text-gray-400 hover:border-gray-500'}`}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                            Pincel
                        </button>
                        <button
                            onClick={() => setIsEraser(true)}
                            className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border transition-all text-xs font-medium ${isEraser ? 'bg-orange-600 border-orange-500 text-white' : 'bg-[#1e1e1e] border-[#333] text-gray-400 hover:border-gray-500'}`}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>
                            Borracha
                        </button>
                    </div>

                    {/* Brush Size */}
                    <div className="text-[9px] uppercase tracking-widest text-gray-600 mb-1">Tamanho</div>
                    <div className="flex gap-2 mb-3">
                        {BRUSH_SIZES.map(size => (
                            <button
                                key={size}
                                onClick={() => setActiveSize(size)}
                                className={`flex-1 h-8 rounded-lg border flex items-center justify-center transition-all ${activeSize === size ? 'bg-[#2a2a2a] border-orange-500' : 'bg-[#1a1a1a] border-[#333] hover:border-gray-500'}`}
                            >
                                <div
                                    className="rounded-full bg-white"
                                    style={{ width: Math.min(size, 18), height: Math.min(size, 18), opacity: activeSize === size ? 1 : 0.4 }}
                                />
                            </button>
                        ))}
                    </div>

                    {/* Color Palette */}
                    <div className="text-[9px] uppercase tracking-widest text-gray-600 mb-1">Cor</div>
                    <div className="grid grid-cols-4 gap-1.5 mb-4">
                        {COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => { setActiveColor(color); setIsEraser(false); }}
                                className="w-full aspect-square rounded-lg border-2 transition-all shadow-sm hover:scale-110"
                                style={{
                                    background: color,
                                    borderColor: activeColor === color && !isEraser ? 'white' : 'transparent',
                                    boxShadow: activeColor === color && !isEraser ? `0 0 8px ${color}80` : undefined,
                                }}
                            />
                        ))}
                    </div>

                    {/* Custom Color */}
                    <label className="text-[9px] uppercase tracking-widest text-gray-600 mb-1 cursor-pointer flex items-center gap-2">
                        Cor personalizada
                        <input
                            type="color"
                            value={activeColor}
                            onChange={e => { setActiveColor(e.target.value); setIsEraser(false); }}
                            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                            style={{ padding: 0 }}
                        />
                    </label>

                    {/* Divider */}
                    <div className="h-px bg-[#2a2a2a] my-3" />

                    {/* Actions */}
                    <div className="text-[9px] uppercase tracking-widest text-gray-600 mb-1">Ações</div>
                    <button
                        onClick={handleUndo}
                        disabled={paths.length === 0}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#1e1e1e] border border-[#333] text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all mb-1.5"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                        Desfazer
                    </button>
                    <button
                        onClick={handleClear}
                        disabled={paths.length === 0}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#1e1e1e] border border-red-900 text-red-400 hover:bg-red-900/20 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                        Limpar tudo
                    </button>
                </div>

                {/* ── CENTER: Slide Preview + Drawing Canvas ───────────────────── */}
                <div className="flex-1 flex items-center justify-center p-6 bg-[#0d0d0d] overflow-hidden">
                    <div className="relative shadow-2xl shadow-black/80" style={{ aspectRatio: '16/9', height: 'min(85vh, 100%)' }}>

                        {/* Slide Background */}
                        <div
                            ref={previewRef}
                            className="absolute inset-0 overflow-hidden rounded-sm"
                            style={{ background: bgColor }}
                        >
                            {/* Background Image */}
                            {bgImage && (
                                <div style={{
                                    position: 'absolute',
                                    left: `${style?.bgRect?.x || 50}%`,
                                    top: `${style?.bgRect?.y || 50}%`,
                                    width: `${style?.bgRect?.w || 100}%`,
                                    height: `${style?.bgRect?.h || 100}%`,
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: 1,
                                    pointerEvents: 'none'
                                }}>
                                    <img src={bgImage} alt="bg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            )}

                            {/* Projection Layers (Text & Ref) - V117 (Sync) */}
                            {slideState && (
                                <div className="absolute inset-0 pointer-events-none">
                                    <ProjectionRenderer
                                        state={slideState}
                                        currentText={currentText}
                                    />
                                </div>
                            )}

                            {/* No content hint */}
                            {!currentText && (
                                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                    <div className="text-center">
                                        <div className="text-white/20 text-5xl mb-3">✦</div>
                                        <div className="text-white/20 text-sm">Nenhuma projeção ativa</div>
                                        <div className="text-white/10 text-xs mt-1">Projete um versículo para ver aqui</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ─── Drawing Canvas ──────────────────────────────────── */}
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full rounded-sm z-50"
                            style={{ cursor: isEraser ? 'cell' : 'crosshair', touchAction: 'none' }}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerLeave={onPointerUp}
                        />

                        {/* Corner label */}
                        <div className="absolute top-2 left-2 z-[60] pointer-events-none">
                            <div className="bg-black/50 backdrop-blur-sm text-white/50 text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-mono">
                                Preview 16:9
                            </div>
                        </div>

                        {/* Eraser cursor indicator */}
                        {isEraser && (
                            <div className="absolute top-2 right-2 z-[60] pointer-events-none">
                                <div className="bg-orange-600/80 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-bold flex items-center gap-1">
                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /></svg>
                                    Borracha
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: Status Panel ──────────────────────────────────────── */}
                <div className="w-[160px] bg-[#141414] border-l border-[#2a2a2a] flex flex-col p-4 shrink-0">
                    <div className="text-[9px] uppercase tracking-widest text-gray-600 mb-3">Status</div>

                    <div className="flex flex-col gap-2">
                        <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
                            <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Traços</div>
                            <div className="text-white font-bold text-2xl">{paths.length}</div>
                        </div>

                        <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
                            <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Cor Ativa</div>
                            <div
                                className="w-8 h-8 rounded-md border border-white/20 shadow-lg"
                                style={{ background: isEraser ? 'transparent' : activeColor, boxShadow: `0 2px 8px ${activeColor}60` }}
                            />
                        </div>

                        <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
                            <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Projeção</div>
                            <div className={`text-xs font-bold flex items-center gap-1 ${isDrawingVisible ? 'text-green-400' : 'text-gray-500'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isDrawingVisible ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                                {isDrawingVisible ? 'Ativo' : 'Oculto'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <div className="text-[8px] text-gray-700 leading-relaxed">
                            Desenhe sobre o slide. Use o botão "Projetando" no topo para mostrar ou ocultar o desenho na tela de projeção.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
