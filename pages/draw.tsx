
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import Head from 'next/head';
import { useProjectionSync } from '../hooks/useProjectionSync';
import { StorageHelper } from '../lib/storage-helper';
import ProjectionRenderer from '../components/ProjectionRenderer';
import { splitTextGeometrically } from '../lib/text-utils';
import {
    LuPen,
    LuPencil,
    LuEraser,
    LuTrash2,
    LuUndo2,
    LuRedo2,
    LuSearch,
    LuMonitor,
    LuPlus,
    LuHighlighter,
    LuChevronDown
} from 'react-icons/lu';


// ─── TYPES ────────────────────────────────────────────────────────────────────
type ToolType = 'round-brush' | 'ink-pen' | 'airbrush' | 'pencil' | 'eraser' | 'smudge' | 'marker' | 'monoline' | 'fountain' | 'watercolor' | 'pen';

interface DrawPath {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    opacity: number;
    tool: ToolType | 'eraser';
    isEraser: boolean;
}

interface BrushPreset {
    id: number;
    color: string;
    size: number;
    opacity: number;
    tool: ToolType;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const BASE_COLORS = [
    '#FFFFFF', // White
    '#000000', // Black 
    '#FF3B30', // Red
    '#FFCC00', // Yellow
    '#007AFF', // Blue
];

const TOOL_OPTIONS: { id: ToolType; label: string; icon: any; desc: string }[] = [
    { id: 'round-brush', label: 'Round Brush', icon: LuPen, desc: 'Pincel redondo básico' },
    { id: 'ink-pen', label: 'Ink Pen', icon: LuPen, desc: 'Traço firme e sólido' },
    { id: 'airbrush', label: 'Airbrush', icon: LuHighlighter, desc: 'Spray suave e difuso' },
    { id: 'pencil', label: 'Pencil', icon: LuPencil, desc: 'Textura de grafite' },
    { id: 'eraser', label: 'Eraser', icon: LuEraser, desc: 'Apaga o desenho' },
    { id: 'smudge', label: 'Smudge', icon: LuHighlighter, desc: 'Mescla cores (efeito)' },
    // Keeping existing ones for compatibility or extra options if desired, or removing if strictly user list wanted. 
    // User requested SPECIFIC list, so I'll prioritize the new ones but keep useful legacies at the bottom.
    { id: 'marker', label: 'Marker', icon: LuHighlighter, desc: 'Marcador texto' },
    { id: 'watercolor', label: 'Watercolor', icon: LuPen, desc: 'Aquarela' },
];

const DEFAULT_PRESETS: BrushPreset[] = [
    { id: 1, tool: 'round-brush', color: '#FFFFFF', size: 4, opacity: 1 },
    { id: 2, tool: 'marker', color: '#007AFF', size: 30, opacity: 0.5 }, // Blue Marker
    { id: 3, tool: 'pencil', color: '#FF3B30', size: 2, opacity: 0.8 }, // Red Pencil
];

const sendDrawingSync = (data: any, channelRef: React.MutableRefObject<BroadcastChannel | null>) => {
    channelRef.current?.postMessage(data);
    const drawPayload = JSON.stringify({ type: 'drawing', drawData: data, timestamp: Date.now() });

    fetch('http://localhost:4523/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: drawPayload
    }).catch(() => { });
};

export default function DrawPage() {
    // ─── PROJECTION STATE ──────────────────────────────────────────────────────
    const [state, setState] = useState({
        verseText: '',
        reference: '',
        slideIndex: 0,
        style: null as any,
        slides: [] as string[]
    });
    const lastTimestamp = useRef(0);

    const processUpdate = useCallback(async (data: any) => {
        if (!data || data.type === 'control') return;
        if (typeof data.verseText === 'undefined') return;
        if (data.timestamp && data.timestamp <= lastTimestamp.current) return;

        lastTimestamp.current = data.timestamp || Date.now();

        let style = data.style || {};
        if (style && (!style.backgroundImage || style.backgroundImage.length < 100)) {
            const storageKey = data.version === 'MUSIC' ? 'music_settings' : 'bible_settings';
            const indexedBg = await StorageHelper.getBackground(storageKey);
            if (indexedBg) style = { ...style, backgroundImage: indexedBg };
        }

        setState(prev => ({
            ...prev,
            ...data,
            style: { ...prev.style, ...style },
            slides: data.slides || []
        }));
    }, []);

    useProjectionSync('receiver', processUpdate);

    // Initial Load Logic
    const loadFromStorage = async () => {
        try {
            const stored = localStorage.getItem('bible_settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                requestAnimationFrame(async () => {
                    const idbImage = await StorageHelper.getBackground('bible_settings');
                    const initialStyle = {
                        ...(parsed.style || parsed),
                        backgroundImage: idbImage || parsed.style?.backgroundImage || null
                    };
                    setState(prev => ({
                        ...prev,
                        verseText: parsed.verseText || '',
                        reference: parsed.reference || '',
                        slideIndex: parsed.slideIndex || 0,
                        style: initialStyle,
                        slides: parsed.slides || []
                    }));
                });
            }
        } catch { }
    };

    useEffect(() => { loadFromStorage(); }, []);

    // ─── TEXT & LAYOUT ────────────────────────────────────────────────────────
    const fontSize = state.style?.fontSize ? parseInt(String(state.style.fontSize)) : 30;
    const textBox = state.style?.textBox || { w: 80, h: 40 };
    const vWidth = 1024;
    const vHeight = 576;
    const wPx = Math.max(10, ((textBox.w || 80) / 100) * vWidth - 40);
    const hPx = Math.max(10, ((textBox.h || 40) / 100) * vHeight - 20);
    const fontFamily = state.style?.fontFamily || 'Inter, sans-serif';
    const isBold = state.style?.fontWeight === 'bold';

    const normalizeFont = (f: string) => {
        if (!f) return 'Inter, sans-serif';
        if (f.includes('NewBlack')) return 'NewBlackTypeface, sans-serif';
        return f;
    };
    const fontName = normalizeFont(fontFamily).replace(/"/g, '');

    const computedSlides = React.useMemo(() => {
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

    const currentText = computedSlides[state.slideIndex ?? 0] || state.verseText || '';
    const bgImage = state.style?.backgroundImage === 'INDEXED_DB' ? null : state.style?.backgroundImage;
    const bgColor = state.style?.backgroundColor || '#000000';

    // ─── DRAWING STATE ────────────────────────────────────────────────────────
    const [paths, setPaths] = useState<DrawPath[]>([]);
    const [redoStack, setRedoStack] = useState<DrawPath[][]>([]);
    const [activeToolMode, setActiveToolMode] = useState<'draw' | 'eraser' | 'pan'>('draw');

    // 3 PRESETS (1, 2, 3)
    const [presets, setPresets] = useState<BrushPreset[]>(DEFAULT_PRESETS);
    const [activePresetIndex, setActivePresetIndex] = useState(0); // 0, 1 or 2

    // Tools Dropdown
    const [showToolDropdown, setShowToolDropdown] = useState(false);

    // UI State
    const [isProjecting, setIsProjecting] = useState(true);

    // Zoom/Pan
    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [fitScale, setFitScale] = useState(1);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const colorInputRef = useRef<HTMLInputElement>(null);

    // Pointer Ref
    const isDrawing = useRef(false);
    const isPanning = useRef(false);
    const lastPointerPos = useRef({ x: 0, y: 0 });
    const currentPath = useRef<DrawPath | null>(null);

    // Initial Fit & High DPI Canvas Setup
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current?.parentElement && canvasRef.current) {
                const { clientWidth, clientHeight } = containerRef.current.parentElement;

                // Fit calculation
                const scaleX = clientWidth / vWidth;
                const scaleY = clientHeight / vHeight;
                setFitScale(Math.min(scaleX, scaleY) * 0.95);

                // HIGH DPI FIX:
                const dpr = window.devicePixelRatio || 1;
                const canvas = canvasRef.current;

                // Set actual canvas memory size (scaled)
                canvas.width = vWidth * dpr;
                canvas.height = vHeight * dpr;

                // Set display size (CSS)
                canvas.style.width = `${vWidth}px`;
                canvas.style.height = `${vHeight}px`;

                // Scale context to match
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.scale(dpr, dpr);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        setTimeout(handleResize, 100);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        channelRef.current = new BroadcastChannel('drawing_channel');
        return () => channelRef.current?.close();
    }, []);

    const getSvgPathFromStroke = (stroke: any[]) => {
        if (!stroke.length) return '';
        const d = stroke.reduce(
            (acc, [x0, y0], i, arr) => {
                const [x1, y1] = arr[(i + 1) % arr.length];
                acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
                return acc;
            },
            ['M', ...stroke[0], 'Q']
        );
        d.push('Z');
        return d.join(' ');
    };

    const updateCurrentPreset = (updates: Partial<BrushPreset>) => {
        const newPresets = [...presets];
        newPresets[activePresetIndex] = { ...newPresets[activePresetIndex], ...updates };
        setPresets(newPresets);
    };

    const currentSettings = presets[activePresetIndex];
    const CurrentIcon = TOOL_OPTIONS.find(t => t.id === currentSettings.tool)?.icon || LuPen;

    // Redraw Canvas
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        // Clear rect using logical coords, but context is already scaled
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to clear full buffer
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore(); // Restore dpr scale

        paths.forEach(path => {
            if (path.points.length < 1) return;

            // Convert normalized points to pixel coordinates
            const w = vWidth;
            const h = vHeight;

            const points = path.points.map(p => ({
                x: (p.x / 100) * w,
                y: (p.y / 100) * h,
                pressure: 0.5 // Default pressure simulation
            }));

            // Configure stroke options based on tool
            let options: any = {
                size: path.width,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
                easing: (t: number) => t,
                start: {
                    taper: 0,
                    easing: (t: number) => t,
                },
                end: {
                    taper: 0,
                    easing: (t: number) => t,
                },
            };

            if (path.tool === 'marker') {
                options = { ...options, size: path.width, thinning: 0, smoothing: 0.5, streamline: 0.4, start: { taper: 0 }, end: { taper: 0 } };
            } else if (path.tool === 'pen' || path.tool === 'ink-pen') {
                options = { ...options, size: path.width, thinning: 0.7, smoothing: 0.6, streamline: 0.6, simulatePressure: true };
            } else if (path.tool === 'round-brush') {
                options = { ...options, size: path.width * 1.5, thinning: 0.4, smoothing: 0.8, streamline: 0.6 };
            } else if (path.tool === 'pencil') {
                options = { ...options, size: path.width * 0.8, thinning: 0.6, smoothing: 0.4, streamline: 0.4 };
            } else if (path.tool === 'monoline') {
                options = { ...options, size: path.width, thinning: 0, smoothing: 0.5, streamline: 0.5 };
            } else if (path.isEraser || path.tool === 'eraser') {
                options = { ...options, size: path.width, thinning: 0, smoothing: 0.2, streamline: 0.4 };
            }

            // Specific Canvas Context Settings
            ctx.globalAlpha = path.opacity;

            if (path.tool === 'marker') {
                ctx.globalCompositeOperation = 'multiply';
                if (path.color === '#FFFFFF') ctx.globalCompositeOperation = 'source-over';
            } else if (path.tool === 'eraser' || path.isEraser) {
                ctx.globalCompositeOperation = 'destination-out';
            } else if (path.tool === 'smudge') {
                ctx.globalCompositeOperation = 'overlay';
            } else {
                ctx.globalCompositeOperation = 'source-over';
            }

            // Standard shadow for specific tools
            if (path.tool === 'airbrush') {
                ctx.shadowBlur = path.width * 2;
                ctx.shadowColor = path.color;
                ctx.globalAlpha = path.opacity * 0.5;
            } else if (path.tool === 'watercolor') {
                ctx.shadowBlur = 4;
                ctx.shadowColor = path.color;
            } else {
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            }

            const stroke = getStroke(points, options);
            const pathData = getSvgPathFromStroke(stroke);

            const p2d = new Path2D(pathData);

            if (path.tool === 'eraser' || path.isEraser) {
                ctx.fill(p2d);
            } else {
                ctx.fillStyle = path.color;
                ctx.fill(p2d);
            }

            // Reset Shadow
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        });

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }, [paths]);

    useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

    // Input Handlers
    const getPercent = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        if (activeToolMode === 'pan') {
            isPanning.current = true;
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        isDrawing.current = true;
        const pt = getPercent(e);
        const isEraser = activeToolMode === 'eraser' || currentSettings.tool === 'eraser';
        const p = currentSettings;

        const newPath: DrawPath = {
            id: Date.now().toString(),
            points: [pt],
            color: p.color,
            width: isEraser ? p.size * 2 : p.size,
            opacity: p.opacity,
            tool: isEraser ? 'eraser' : p.tool,
            isEraser: isEraser
        };
        currentPath.current = newPath;
        setPaths(prev => [...prev, newPath]);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isPanning.current) {
            const dx = e.clientX - lastPointerPos.current.x;
            const dy = e.clientY - lastPointerPos.current.y;
            setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (!isDrawing.current || !currentPath.current) return;
        const pt = getPercent(e);
        currentPath.current.points.push(pt);
        setPaths(prev => [...prev]);
    };

    const handlePointerUp = () => {
        isPanning.current = false;
        if (!isDrawing.current) return;
        isDrawing.current = false;

        // Clear Redo stack on new action
        if (redoStack.length > 0) setRedoStack([]);

        if (isProjecting) sendDrawingSync({ type: 'SYNC_PATHS', payload: paths }, channelRef);
        currentPath.current = null;
    };

    const handleUndo = () => {
        if (paths.length === 0) return;
        const newPaths = [...paths];
        const removed = newPaths.pop();
        if (removed) {
            setRedoStack(prev => [...prev, [removed]]);
            setPaths(newPaths);
            if (isProjecting) sendDrawingSync({ type: 'SYNC_PATHS', payload: newPaths }, channelRef);
        }
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const newRedo = [...redoStack];
        const toRestore = newRedo.pop(); // Array of paths (usually 1)
        if (toRestore) {
            const newPaths = [...paths, ...toRestore];
            setPaths(newPaths);
            setRedoStack(newRedo);
            if (isProjecting) sendDrawingSync({ type: 'SYNC_PATHS', payload: newPaths }, channelRef);
        }
    };

    const toggleProjecting = () => {
        const val = !isProjecting;
        setIsProjecting(val);
        if (val) sendDrawingSync({ type: 'SYNC_PATHS', payload: paths }, channelRef);
        else sendDrawingSync({ type: 'CLEAR' }, channelRef);
    };

    // Close Dropdown on click outside
    useEffect(() => {
        const clickHandler = () => setShowToolDropdown(false);
        window.addEventListener('click', clickHandler);
        return () => window.removeEventListener('click', clickHandler);
    }, []);

    const CurrentToolLabel = TOOL_OPTIONS.find(t => t.id === currentSettings.tool)?.label || 'Pen';

    return (
        <div className="fixed inset-0 bg-[#121212] flex flex-col font-sans select-none overflow-hidden text-white/90">
            <Head>
                <title>Draw Studio Pro</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
                <style>{`
                    .scrollbar-hide::-webkit-scrollbar { display: none; }
                    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                    canvas { touch-action: none; }
                `}</style>
            </Head>

            {/* ─── TOOLBAR ────────────────────────────────────────────────────────── */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-[#1e1e1e] flex items-center justify-between px-4 z-50 border-b border-white/5">

                {/* 1. PRESETS GROUP */}
                <div className="flex gap-2 mr-4">
                    {[0, 1, 2].map(idx => {
                        const preset = presets[idx];
                        const isActive = activeToolMode === 'draw' && activePresetIndex === idx;
                        const ToolIcon = TOOL_OPTIONS.find(t => t.id === preset.tool)?.icon || LuPen;

                        return (
                            <button
                                key={idx}
                                onClick={() => { setActiveToolMode('draw'); setActivePresetIndex(idx); }}
                                className={`
                                    relative w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-all
                                    ${isActive
                                        ? 'bg-[#007AFF] text-white shadow-lg translate-y-0.5'
                                        : 'bg-[#2c2c2e] text-zinc-500 hover:bg-[#3a3a3c]'
                                    }
                                `}
                            >
                                <span className={`text-[10px] font-bold absolute top-1.5 ${isActive ? 'text-white' : 'text-zinc-500'}`}>{idx + 1}</span>
                                <ToolIcon size={18} className="mt-2" />
                            </button>
                        );
                    })}
                </div>

                <div className="w-px h-8 bg-white/10 mx-2" />

                {/* 2. COLORS & TOOL SELECT */}
                <div className="flex-1 flex items-center justify-start gap-4">

                    {/* Color Palette - FIXED LAYOUT */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 px-1 flex-shrink-0" style={{ maxWidth: '400px' }}>
                        {BASE_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => updateCurrentPreset({ color: c })}
                                className={`w-7 h-7 rounded-full flex-shrink-0 transition-transform border border-white/10 ${currentSettings.color === c && activeToolMode !== 'eraser' ? 'ring-2 ring-white scale-110 shadow-md' : 'hover:scale-110 opacity-80 hover:opacity-100'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}

                        <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

                        <button
                            onClick={() => colorInputRef.current?.click()}
                            className="w-7 h-7 rounded-full bg-[#2c2c2e] border border-white/20 flex items-center justify-center text-white hover:bg-[#3f3f46] transition flex-shrink-0 group relative"
                            title="Mais Cores"
                        >
                            <LuPlus size={12} className="group-hover:scale-110 transition-transform" />
                            {/* Hidden color input */}
                            <input
                                ref={colorInputRef}
                                type="color"
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                onChange={(e) => updateCurrentPreset({ color: e.target.value })}
                            />
                        </button>
                    </div>

                    {/* TOOL SELECTOR DROPDOWN */}
                    <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowToolDropdown(!showToolDropdown)}
                            className="bg-[#2c2c2e] hover:bg-[#3a3a3c] h-10 px-4 rounded-lg flex items-center gap-2 text-sm font-medium transition min-w-[120px] justify-between border border-white/5"
                        >
                            <div className="flex items-center gap-2">
                                <CurrentIcon size={16} />
                                <span>{CurrentToolLabel}</span>
                            </div>
                            <LuChevronDown size={14} className="opacity-50" />
                        </button>

                        {showToolDropdown && (
                            <div className="absolute top-12 left-0 w-64 bg-[#2c2c2e] rounded-xl shadow-2xl border border-white/10 overflow-hidden flex flex-col py-1 z-[100]">
                                {TOOL_OPTIONS.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            updateCurrentPreset({ tool: opt.id });
                                            setShowToolDropdown(false);
                                        }}
                                        className={`px-4 py-3 text-left text-sm flex items-start gap-3 hover:bg-white/10 border-b border-white/5 last:border-0 ${currentSettings.tool === opt.id ? 'bg-white/5' : ''}`}
                                    >
                                        <div className={`mt-0.5 p-1.5 rounded-md ${currentSettings.tool === opt.id ? 'bg-[#007AFF] text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                                            <opt.icon size={16} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-medium ${currentSettings.tool === opt.id ? 'text-white' : 'text-zinc-200'}`}>{opt.label}</span>
                                            <span className="text-[10px] text-zinc-500 leading-tight">{opt.desc}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. SLIDERS & UNDO/REDO */}
                <div className="flex gap-4 items-center hidden lg:flex border-l border-white/5 pl-4 mr-6">

                    {/* Undo/Redo Buttons */}
                    <div className="flex gap-1">
                        <button onClick={handleUndo} disabled={paths.length === 0} className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition" title="Desfazer">
                            <LuUndo2 size={18} />
                        </button>
                        <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition" title="Refazer">
                            <LuRedo2 size={18} />
                        </button>
                    </div>

                    <div className="flex flex-col w-40 sm:w-48 gap-1.5 justify-center">
                        {/* SIZE SLIDER */}
                        <div className="flex items-center gap-2 h-5">
                            <span className="text-[9px] font-bold text-zinc-500 w-8 text-right uppercase">TAM</span>
                            <input
                                type="range" min="1" max="100"
                                className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-white hover:accent-blue-500 transition-all"
                                value={currentSettings.size}
                                onChange={e => updateCurrentPreset({ size: +e.target.value })}
                            />
                            <span className="text-[9px] font-mono text-zinc-400 w-6 text-right">{currentSettings.size}</span>
                        </div>

                        {/* OPACITY SLIDER */}
                        <div className="flex items-center gap-2 h-5">
                            <span className="text-[9px] font-bold text-zinc-500 w-8 text-right uppercase">OPAC</span>
                            <input
                                type="range" min="1" max="100"
                                className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-white hover:accent-blue-500 transition-all"
                                value={currentSettings.opacity * 100}
                                onChange={e => updateCurrentPreset({ opacity: +e.target.value / 100 })}
                            />
                            <span className="text-[9px] font-mono text-zinc-400 w-6 text-right">{Math.round(currentSettings.opacity * 100)}</span>
                        </div>
                    </div>
                </div>

                {/* 4. RIGHT ACTIONS */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveToolMode(activeToolMode === 'eraser' ? 'draw' : 'eraser')}
                        className={`p-3 rounded-lg transition ${activeToolMode === 'eraser' ? 'bg-[#007AFF] text-white' : 'text-zinc-400 hover:text-white hover:bg-[#2c2c2e]'}`}
                        title="Eraser"
                    >
                        <LuEraser size={20} />
                    </button>

                    {/* LUPA (Simulated Pan/Zoom Mode) */}
                    <button
                        onClick={() => setActiveToolMode(activeToolMode === 'pan' ? 'draw' : 'pan')}
                        className={`p-3 rounded-lg transition ${activeToolMode === 'pan' ? 'bg-[#007AFF] text-white' : 'text-zinc-400 hover:text-white hover:bg-[#2c2c2e]'}`}
                        title="Zoom/Pan (Lupa)"
                    >
                        <LuSearch size={20} />
                    </button>

                    <button onClick={() => { setPaths([]); sendDrawingSync({ type: 'CLEAR' }, channelRef); }} className="p-3 text-zinc-400 hover:text-red-500 transition hover:bg-[#2c2c2e] rounded-lg">
                        <LuTrash2 size={20} />
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-1" />

                    <button
                        onClick={toggleProjecting}
                        className={`
                            h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 shadow-lg
                            ${isProjecting
                                ? 'bg-green-600 border-green-500 text-white'
                                : 'bg-red-600 border-red-500 text-white'
                            }
                        `}
                    >
                        <LuMonitor size={14} />
                        {isProjecting ? 'PROJEÇÃO ON' : 'PROJEÇÃO OFF'}
                    </button>
                </div>
            </div>

            {/* ─── CANVAS AREA ────────────────────────────────────────────────────── */}
            <div
                className="flex-1 flex items-center justify-center bg-[#121212] relative overflow-hidden"
                style={{ cursor: activeToolMode === 'pan' ? 'grab' : 'crosshair' }}
                onWheel={(e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -0.1 : 0.1;
                        setZoom(z => Math.max(0.2, Math.min(z + delta, 5)));
                    }
                }}
            >
                <div
                    ref={containerRef}
                    style={{
                        width: vWidth,
                        height: vHeight,
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${fitScale * zoom})`,
                        backgroundColor: bgColor,
                        transition: isPanning.current ? 'none' : 'transform 0.1s ease-out',
                        boxShadow: '0 0 50px rgba(0,0,0,0.5)'
                    }}
                    className="relative"
                >
                    {/* BACKGROUND Image with BGRECT Fix */}
                    {bgImage && (
                        <div style={{
                            position: 'absolute',
                            left: `${(state.style?.bgRect?.x || 50)}%`,
                            top: `${(state.style?.bgRect?.y || 50)}%`,
                            width: `${(state.style?.bgRect?.w || 100)}%`,
                            height: `${(state.style?.bgRect?.h || 100)}%`,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 0,
                            pointerEvents: 'none'
                        }}>
                            <img src={bgImage} className="w-full h-full object-cover" />
                        </div>
                    )}

                    <div className="absolute inset-0 z-[5] pointer-events-none">
                        <ProjectionRenderer state={state} currentText={currentText} />
                    </div>

                    <canvas
                        ref={canvasRef}
                        // removed width/height props to rely on JS control of resolution
                        className="absolute inset-0 z-10 touch-none"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    />
                </div>

                {/* Zoom Utility */}
                <div className="absolute bottom-6 right-6 flex flex-col items-center gap-1 bg-[#1e1e1e] border border-white/10 p-1.5 rounded-lg shadow-xl opacity-80 hover:opacity-100 transition">
                    <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded text-xl">+</button>
                    <span className="text-[10px] text-zinc-500 font-mono py-1">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.2))} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded text-xl">-</button>
                    <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="w-8 h-6 flex items-center justify-center text-[9px] text-blue-500 font-bold uppercase hover:bg-white/10 rounded">RST</button>
                </div>
            </div>
        </div>
    );
}
