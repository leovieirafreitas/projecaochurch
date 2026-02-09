
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const CHANNEL_NAME = 'projection_updates';
const TABLE_NAME = 'projection_state'; // Tabela 'projection_state' no schema 'public'

// Interface do estado de projeção (ajuste conforme necessário)
interface ProjectionState {
    verseText?: string;
    reference?: string;
    slideIndex?: number;
    version?: string;
    style?: any;
    timestamp?: number;
    senderId?: string; // V32: Identify controller
    source?: 'desktop' | 'mobile'; // V34: Source Type
    master?: 'desktop' | 'mobile'; // V34: Master Lock Command (Control Packet)
    type?: 'bible' | 'music' | 'control'; // Control packets
    action?: 'reload' | 'reset' | 'unlock_mobile' | 'lock_mobile' | null; // V73: Ações de Controle (Reload, Reset)
}

// V66: Lazy Connect - Só conecta no Supabase se enableSupabase for true.
// Isso garante ESCALABILIDADE INFINITA para usuários Desktop (Zero conexões).
export function useProjectionSync(
    role: 'sender' | 'receiver',
    onStateChange?: (state: ProjectionState) => void,
    enableSupabase: boolean = false // V70: Hybrid Mode Default (Local First, Cloud Off for state)
) {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

    // V68: FIX EGRESS LOOP - Use Ref para callback evitar re-runs infinitos do Effect
    const onStateChangeRef = useRef(onStateChange);
    useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

    // V114: SECURITY STATE (Memory based + LocalStorage Init)
    // Inicializa com valor do localStorage (se existir) para persistir reload
    const mobileAllowedRef = useRef(typeof window !== 'undefined' && localStorage.getItem('mobileMode') === 'true');

    useEffect(() => {
        if (enableSupabase) setStatus('connecting');
        else setStatus('idle');

        // V114: LOCAL STORAGE SYNC (Listen for changes from other windows)
        const handleStorage = () => {
            const val = localStorage.getItem('mobileMode');
            if (val !== null) mobileAllowedRef.current = val === 'true';
        };
        window.addEventListener('storage', handleStorage);

        // 1. RECUPERAR ESTADO INICIAL DO BANCO (Apenas Receiver E se Supabase estiver ativo)
        if (role === 'receiver' && enableSupabase) {
            supabase
                ?.from(TABLE_NAME)
                .select('data') // A coluna é 'data'
                .eq('id', 1)
                .single()
                .then(({ data, error }) => {
                    if (data?.data && onStateChangeRef.current) {
                        onStateChangeRef.current(data.data);
                    }
                    if (error) {
                        // Silencia erros de timeout para não spammar logs
                        if (error.code === '57014' || error.message?.includes('timeout') || error.code === '500') {
                            console.warn('[Supabase Sync] Timeout/Erro ao carregar inicial. Usando fallback local via polling.');
                        }
                    }
                }, () => { }); // Handle rejection here

        }

        // 2. INSCREVER NO REALTIME (Postgres Changes)
        // Isso garante que se o sender atualizar o banco, todos recebem.
        // V66: Lazy Connect - Só cria canal se ativado
        let channel: any = null;

        if (enableSupabase) {
            channel = supabase?.channel(CHANNEL_NAME)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: TABLE_NAME,
                        filter: 'id=eq.1',
                    },
                    (payload) => {
                        // Payload.new contém a linha inteira atualizada
                        // A coluna de dados é payload.new.data
                        if (onStateChangeRef.current && payload.new && payload.new.data) {
                            // console.log('[Supabase] Update Recebido');

                            // V114: PROCESS CONTROL MESSAGES BEFORE SECURITY CHECK
                            if (payload.new.data.type === 'control') {
                                if (payload.new.data.action === 'unlock_mobile') {
                                    mobileAllowedRef.current = true;
                                    if (typeof window !== 'undefined') localStorage.setItem('mobileMode', 'true');
                                } else if (payload.new.data.action === 'lock_mobile') {
                                    mobileAllowedRef.current = false;
                                    if (typeof window !== 'undefined') localStorage.setItem('mobileMode', 'false');
                                }
                            }

                            // V76: SECURITY LOCK - BLOCK MOBILE IF DISABLED (ENABLED & ROBUST)
                            if (payload.new.data.source === 'mobile') {
                                // If not explicitely allowed via Control Message OR LocalStorage
                                if (!mobileAllowedRef.current) {
                                    // Double check localStorage just in case (e.g. page reload)
                                    if (localStorage.getItem('mobileMode') !== 'true') {
                                        // console.warn('[Security] Mobile Locked. Ignoring.');
                                        return;
                                    }
                                }
                            }

                            onStateChangeRef.current(payload.new.data);

                            // V63: RELAY - Se somos o Receiver (PC) recebendo do Mobile,
                            // precisamos avisar o Servidor Local (4523) para que o Chrome/OBS também receba!
                            if (role === 'receiver') {
                                fetch('http://127.0.0.1:4523/api/status', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload.new.data)
                                }).catch(() => { });
                            }
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') setStatus('connected');
                    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.warn('[Supabase Sync] Falha no Realtime. Operando em modo OFFLINE LOCAL apenas.');
                        setStatus('error');
                        if (channel) supabase?.removeChannel(channel);
                    }
                });
        }

        // 3. BROADCAST LOCAL (Fallback super rápido para mesma máquina)
        const bc = new BroadcastChannel('projection_channel');
        bc.onmessage = (event) => {
            // Se for receiver, aplica
            if (role === 'receiver' && onStateChangeRef.current) {
                // Log removed for performance

                // V114: PROCESS CONTROL MESSAGES (Broadcast)
                if (event.data?.type === 'control') {
                    if (event.data.action === 'unlock_mobile') {
                        mobileAllowedRef.current = true;
                        // Force update local storage for other tabs
                        if (typeof window !== 'undefined') localStorage.setItem('mobileMode', 'true');
                    }
                    if (event.data.action === 'lock_mobile') {
                        mobileAllowedRef.current = false;
                        if (typeof window !== 'undefined') localStorage.setItem('mobileMode', 'false');
                    }
                }

                // V76: SECURITY LOCK (Broadcast)
                if (event.data?.source === 'mobile') {
                    if (!mobileAllowedRef.current) {
                        if (localStorage.getItem('mobileMode') !== 'true') return;
                    }
                }

                onStateChangeRef.current(event.data);
            }
        };

        // 4. WEBSOCKET LOCAL (Rust Server) - REALTIME LOCAL (Substitui Polling)
        // V69: WebSocket Client for Zero-Latency & Zero-Egress
        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;
        let isUnmounting = false;

        const setupWebsocket = () => {
            if (role !== 'receiver' || isUnmounting) return;

            // Determina porta baseada no ambiente (Dev vs Prod)
            const loc = window.location;
            let port = 4523; // Prod default
            if (loc.port === '3000') port = 4524; // Dev Next.js
            else if (loc.port && loc.port !== '80' && loc.port !== '443') port = parseInt(loc.port);

            // Fallback para hardcoded se a lógica acima falhar ou for 3000
            if (port === 3000) port = 4524;

            const wsUrl = `ws://${loc.hostname}:${port}/ws`;

            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setStatus('connected');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (onStateChangeRef.current) {

                        // V114: PROCESS CONTROL MESSAGES (WebSocket)
                        if (data.type === 'control') {
                            if (data.action === 'unlock_mobile') mobileAllowedRef.current = true;
                            if (data.action === 'lock_mobile') mobileAllowedRef.current = false;
                        }

                        // V76: SECURITY LOCK (WebSocket)
                        if (data.source === 'mobile') {
                            if (!mobileAllowedRef.current) {
                                if (localStorage.getItem('mobileMode') !== 'true') return;
                            }
                        }

                        onStateChangeRef.current(data);
                    }
                } catch (e) { }
            };

            ws.onerror = (err) => { };

            ws.onclose = () => {
                if (!isUnmounting) {
                    reconnectTimeout = setTimeout(setupWebsocket, 2000);
                }
            };
        };

        if (role === 'receiver') {
            setupWebsocket();
        }

        return () => {
            // CLEANUP
            isUnmounting = true;
            window.removeEventListener('storage', handleStorage); // Remove storage listener
            if (channel) supabase?.removeChannel(channel);
            bc.close();
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
            clearTimeout(reconnectTimeout);
        };
    }, [role, enableSupabase]);

    // V61: Persist BroadcastChannel to avoid overhead/latency of open/close loop
    const bcRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        bcRef.current = new BroadcastChannel('projection_channel');
        return () => {
            bcRef.current?.close();
        };
    }, []);

    // Função de Envio (Sender)
    // V60: Ultimate Scalability Fix - Separa Local (Rico) de Cloud (Leve)
    const sendState = async (newState: ProjectionState, options: { forceLocalOnly?: boolean, stripStyleForCloud?: boolean } = {}) => {
        // 1. Envia via Broadcast Local (Zero latencia, Full Quality)
        if (bcRef.current) {
            bcRef.current.postMessage(newState);
        } else {
            // Fallback se o ref não estiver pronto (raro)
            const tempBc = new BroadcastChannel('projection_channel');
            tempBc.postMessage(newState);
            tempBc.close();
        }

        // 2. Atualiza Cache Local do Servidor (Full Quality)
        const sendToLocal = async () => {
            const hostname = window.location.hostname;

            // Tenta 127.0.0.1 (Garante funcionamento no mesmo PC, App -> Chrome/OBS)
            try {
                await fetch('http://127.0.0.1:4523/api/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newState)
                });
                // Se der certo, nem tenta os outros pra economizar recurso
                return;
            } catch (e) { }

            // Fallback: Tenta hostname atual (útil se estiver rodando via LAN)
            if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
                try {
                    await fetch(`http://${hostname}:4523/api/status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newState)
                    });
                } catch (e) { }
            }
        };
        sendToLocal();

        // 3. Envia via Supabase Banco (Otimizado para Escala)
        // V72: TRAVA DE SEGURANÇA - Só envia se enableSupabase for true.
        // Isso impede que o mobile gaste cota.
        if (!options.forceLocalOnly && enableSupabase) {

            // Se stripStyleForCloud estiver ativo, removemos o objeto 'style' pesado
            // O celular recebe apenas texto/referência (rápido e barato)
            let finalPayload = newState;
            if (options.stripStyleForCloud) {
                // Cria cópia sem style
                const { style, ...rest } = newState;
                // Mantém style apenas se for muito pequeno (opcional), mas melhor cortar tudo para garantir
                finalPayload = { ...rest, style: undefined };
            }

            supabase
                ?.from(TABLE_NAME)
                .update({ data: finalPayload, updated_at: new Date() })
                .eq('id', 1)
                .then(({ error }) => {
                    if (error) console.error('[Supabase] Erro ao enviar estado:', error);
                });
        }
    };

    return { sendState, status };
}
