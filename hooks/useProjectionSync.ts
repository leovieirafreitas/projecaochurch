
import { useEffect, useState } from 'react';
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
    type?: 'bible' | 'music'; // Para diferenciar se needed
}

export function useProjectionSync(role: 'sender' | 'receiver', onStateChange?: (state: ProjectionState) => void) {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

    useEffect(() => {
        setStatus('connecting');

        // 1. RECUPERAR ESTADO INICIAL DO BANCO (Apenas Receiver)
        if (role === 'receiver') {
            supabase
                .from(TABLE_NAME)
                .select('data') // A coluna é 'data'
                .eq('id', 1)
                .single()
                .then(({ data, error }) => {
                    if (data?.data && onStateChange) {
                        onStateChange(data.data);
                    }
                    if (error) console.error('Erro ao carregar estado inicial:', error);
                });
        }

        // 2. INSCREVER NO REALTIME (Postgres Changes)
        // Isso garante que se o sender atualizar o banco, todos recebem.
        const channel = supabase
            .channel(CHANNEL_NAME)
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
                    if (onStateChange && payload.new && payload.new.data) {
                        console.log('[Supabase] Update Recebido:', payload.new.data);
                        onStateChange(payload.new.data);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setStatus('connected');
                else if (status === 'CHANNEL_ERROR') setStatus('error');
            });

        // 3. BROADCAST LOCAL (Fallback super rápido para mesma máquina)
        const bc = new BroadcastChannel('bible_channel');
        bc.onmessage = (event) => {
            // Se for receiver, aplica
            if (role === 'receiver' && onStateChange) {
                console.log('[Broadcast] Mensagem local:', event.data);
                onStateChange(event.data);
            }
        };

        return () => {
            supabase.removeChannel(channel);
            bc.close();
        };
    }, [role]);

    // Função de Envio (Sender)
    const sendState = async (newState: ProjectionState) => {
        // 1. Envia via Broadcast Local (Zero latencia)
        const bc = new BroadcastChannel('bible_channel');
        bc.postMessage(newState);
        bc.close();

        // 2. Envia via Supabase Banco (Persistência + Remote Realtime)
        // Usamos upsert para garantir
        const { error } = await supabase
            .from(TABLE_NAME)
            .update({ data: newState, updated_at: new Date() })
            .eq('id', 1);

        if (error) console.error('[Supabase] Erro ao enviar estado:', error);
    };

    return { sendState, status };
}
