import React, { useRef, useEffect, useState } from 'react';
import { getStroke } from 'perfect-freehand';

export interface DrawPath {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    opacity?: number;
    tool?: 'pen' | 'marker' | 'highlighter' | 'eraser' | 'ink-pen' | 'round-brush' | 'pencil' | 'monoline' | 'airbrush' | 'watercolor' | 'smudge';
    isEraser?: boolean;
}

interface DrawCanvasProps {
    mode: 'viewer';
}

// Helper to smooth polygon points for Canvas fill
const getSvgPathFromStroke = (stroke: any[]): Path2D | null => {
    if (!stroke.length) return null;
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ['M', ...stroke[0], 'Q']
    );
    d.push('Z');
    try {
        return new Path2D(d.join(' '));
    } catch (e) {
        return null;
    }
};

export default function DrawCanvas({ mode }: DrawCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [paths, setPaths] = useState<DrawPath[]>([]);
    const lastDrawTimestamp = useRef(0);

    // V119: Use same logical base as editor for consistency
    const V_WIDTH = 1024;
    const V_HEIGHT = 576;

    const applyDrawData = (data: any) => {
        if (!data) return;
        if (data.timestamp && data.timestamp <= lastDrawTimestamp.current) return;
        if (data.timestamp) lastDrawTimestamp.current = data.timestamp;

        const drawData = data.drawData || data;
        if (drawData.type === 'SYNC_PATHS') {
            setPaths(drawData.payload || []);
        } else if (drawData.type === 'CLEAR') {
            setPaths([]);
        }
    };

    // Broadcast & WS effects remain unchanged...
    useEffect(() => {
        const bc = new BroadcastChannel('drawing_channel');
        bc.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'SYNC_PATHS') setPaths(payload || []);
            else if (type === 'CLEAR') setPaths([]);
        };
        return () => bc.close();
    }, []);

    useEffect(() => {
        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;
        let isUnmounting = false;
        const connect = () => {
            if (isUnmounting) return;
            const loc = window.location;
            let port = 4523;
            if (loc.port === '3000') port = 4524;
            const wsUrl = `ws://${loc.hostname}:${port}/ws`;
            ws = new WebSocket(wsUrl);
            ws.onmessage = (e) => { try { const d = JSON.parse(e.data); if (d.type === 'drawing') applyDrawData(d); } catch { } };
            ws.onclose = () => { if (!isUnmounting) reconnectTimeout = setTimeout(connect, 3000); };
        };
        connect();
        return () => { isUnmounting = true; ws?.close(); clearTimeout(reconnectTimeout); };
    }, []);

    // ─── HIGH QUALITY REDRAW (V119) ───────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // RESOLUTION SETUP
        const dpr = window.devicePixelRatio || 1;
        // Target 1920p base buffer, but scaled by DPR for sharp 4K screens
        const TARGET_W = 1920;
        const TARGET_H = 1080;

        if (canvas.width !== TARGET_W * dpr || canvas.height !== TARGET_H * dpr) {
            canvas.width = TARGET_W * dpr;
            canvas.height = TARGET_H * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, TARGET_W, TARGET_H);

        const uniquePaths = Array.from(new Map(paths.map(p => [p.id, p])).values()) as DrawPath[];

        // Coordinate scaling: from Editor logical (1024) to Canvas target (1920)
        const scale = TARGET_W / V_WIDTH;

        uniquePaths.forEach(path => {
            if (path.points.length < 1) return;

            const tool = path.tool || (path.isEraser ? 'eraser' : 'pen');

            // Map logical % points to local pixels
            const pts = path.points.map(p => ({
                x: (p.x / 100) * TARGET_W,
                y: (p.y / 100) * TARGET_H,
                pressure: 0.5
            }));

            // Brush options (Sync with draw.tsx V114/V119/V121)
            let options: any = {
                size: (path.width || 5) * scale,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
                start: { taper: 0 },
                end: { taper: 0 }
            };

            if (tool === 'marker') options = { ...options, thinning: 0, smoothing: 0.5, streamline: 0.4 };
            else if (tool === 'pen' || tool === 'ink-pen') options = { ...options, thinning: 0.7, smoothing: 0.6, streamline: 0.6, simulatePressure: true };
            else if (tool === 'round-brush') options = { ...options, size: (path.width || 5) * scale * 1.5, thinning: 0.4, smoothing: 0.8, streamline: 0.6 };
            else if (tool === 'pencil') options = { ...options, size: (path.width || 5) * scale * 0.8, thinning: 0.6, smoothing: 0.4, streamline: 0.4 };
            else if (tool === 'monoline') options = { ...options, thinning: 0, smoothing: 0.5, streamline: 0.5 };
            else if (tool === 'eraser') options = { ...options, thinning: 0, smoothing: 0.2, streamline: 0.4 };

            // Shadow logic for Airbrush/Watercolor (V121)
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';

            if (tool === 'airbrush') {
                ctx.shadowBlur = (path.width || 5) * scale * 2;
                ctx.shadowColor = path.color;
                ctx.globalAlpha = (path.opacity ?? 1) * 0.5;
            } else if (tool === 'watercolor') {
                ctx.shadowBlur = 4;
                ctx.shadowColor = path.color;
            }

            const stroke = getStroke(pts, options);
            const p2d = getSvgPathFromStroke(stroke);
            if (!p2d) return;

            ctx.globalAlpha = path.opacity ?? (tool === 'marker' ? 0.5 : 1);

            if (tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fill(p2d);
            } else {
                ctx.globalCompositeOperation = (tool === 'marker' && path.color !== '#FFFFFF') ? 'multiply' : 'source-over';
                ctx.fillStyle = path.color;
                ctx.fill(p2d);
            }
        });

        ctx.restore();
    }, [paths]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-[100] w-full h-full"
            style={{ pointerEvents: 'none' }}
        />
    );
}
