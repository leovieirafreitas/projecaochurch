import React, { useRef, useEffect, useState } from 'react';

export interface DrawPath {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    opacity?: number;
    tool?: 'pen' | 'marker' | 'highlighter' | 'eraser';
    isEraser?: boolean;
}

interface DrawCanvasProps {
    mode: 'viewer';
}

/**
 * DrawCanvas — Viewer Mode (HIGH RESOLUTION 1920x1080)
 * 
 * Recebe desenhos e renderiza em um Canvas de 1920x1080 fixo, escalado via CSS.
 * Isso garante qualidade HD do traço independente do tamanho do container.
 */
export default function DrawCanvas({ mode }: DrawCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [paths, setPaths] = useState<DrawPath[]>([]);
    const lastDrawTimestamp = useRef(0);

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

    // ─── 1. BroadcastChannel 'drawing_channel' (mesma máquina/browser) ────
    useEffect(() => {
        const bc = new BroadcastChannel('drawing_channel');
        bc.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'SYNC_PATHS') {
                setPaths(payload || []);
            } else if (type === 'CLEAR') {
                setPaths([]);
            }
        };
        return () => bc.close();
    }, []);

    // ─── 2. WebSocket do servidor local (cross-device) ───────────────────
    useEffect(() => {
        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;
        let isUnmounting = false;

        const connect = () => {
            if (isUnmounting) return;

            const loc = window.location;
            let port = 4523;
            if (loc.port === '3000') port = 4524;
            else if (loc.port && loc.port !== '80' && loc.port !== '443') port = parseInt(loc.port);
            if (port === 3000) port = 4524;

            const wsUrl = `ws://${loc.hostname}:${port}/ws`;
            ws = new WebSocket(wsUrl);

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'drawing') {
                        applyDrawData(data);
                    }
                } catch { }
            };

            ws.onclose = () => {
                if (!isUnmounting) {
                    reconnectTimeout = setTimeout(connect, 3000);
                }
            };
            ws.onerror = () => { };
        };

        connect();

        return () => {
            isUnmounting = true;
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
            clearTimeout(reconnectTimeout);
        };
    }, []);

    // ─── Redraw High Resolution ───────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // HIGH QUALITY RESOLUTION
        // Renderiza internamente em Full HD para evitar serrilhado
        const TARGET_WIDTH = 1920;
        const TARGET_HEIGHT = 1080;

        if (canvas.width !== TARGET_WIDTH || canvas.height !== TARGET_HEIGHT) {
            canvas.width = TARGET_WIDTH;
            canvas.height = TARGET_HEIGHT;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Deduplicate paths
        const uniquePaths = Array.from(new Map(paths.map(p => [p.id, p])).values());

        // Base Scale (assumindo que path.width vem de base 1024)
        // Se desenhado em 1024, para mostrar em 1920 precisa multiplicar por ~1.875
        const scaleFactor = TARGET_WIDTH / 1024;

        uniquePaths.forEach(path => {
            if (path.points.length < 2) return;

            ctx.beginPath();

            // Configurar Estilo baseado na Ferramenta
            const tool = path.tool || (path.isEraser ? 'eraser' : 'pen');
            const isHighlighter = tool === 'marker' || tool === 'highlighter';

            // Opacidade
            ctx.globalAlpha = path.opacity ?? (isHighlighter ? 0.5 : 1);

            // Cap & Join
            if (isHighlighter) {
                ctx.lineCap = 'butt'; // Marker geralmente é quadrado
                ctx.lineJoin = 'bevel';
            } else {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }

            // Ajusta espessura para High Res
            let finalWidth = path.width * scaleFactor;
            // Se for marker e não tiver width definido explicitamente maior, aumenta
            // (Mas assumimos que o editor já manda width correto)

            ctx.lineWidth = finalWidth;

            if (tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = path.color;
            }

            // Converter % para High Res Pixels
            const startX = (path.points[0].x / 100) * TARGET_WIDTH;
            const startY = (path.points[0].y / 100) * TARGET_HEIGHT;
            ctx.moveTo(startX, startY);

            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(
                    (path.points[i].x / 100) * TARGET_WIDTH,
                    (path.points[i].y / 100) * TARGET_HEIGHT
                );
            }
            ctx.stroke();
        });

        // Reset Global Context State
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }, [paths]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-[100] w-full h-full"
            style={{ pointerEvents: 'none' }}
        />
    );
}
