
import React, { useState, useEffect } from 'react';

export default function ProjectionLinksModal({ onClose }: { onClose: () => void }) {
    const [localIp, setLocalIp] = useState<string>('Carregando...');
    const [bibleLink, setBibleLink] = useState('');
    const [musicLink, setMusicLink] = useState('');

    // Detectar IP ao montar
    useEffect(() => {
        const getIp = async () => {
            let ip = '';

            console.log('Iniciando detecção de IP...');

            // 1. Tentar via Tauri (App Desktop)
            // Tenta usar window.__TAURI__ diretamente para evitar problemas de import dinâmico em build
            if (typeof window !== 'undefined' && (window as any).__TAURI__) {
                try {
                    // Tenta via import (padrão)
                    try {
                        const { invoke } = await import('@tauri-apps/api/tauri');
                        ip = await invoke('get_local_ip');
                        console.log('IP via import Tauri:', ip);
                    } catch (errImport) {
                        // Fallback para window.__TAURI__ se o import falhar (comum em alguns bundles)
                        console.warn('Import Tauri falhou, tentando global:', errImport);
                        const tauri = (window as any).__TAURI__;
                        if (tauri && tauri.invoke) {
                            ip = await tauri.invoke('get_local_ip');
                            console.log('IP via global Tauri:', ip);
                        }
                    }
                } catch (e) {
                    console.error('Erro ao invocar get_local_ip:', e);
                }
            }

            // 2. Tentar via API Next.js (apenas se estiver em ambiente web real, nao tauri://)
            // Se estivermos no Tauri, o fetch para /api/local-ip pode falhar ou retornar localhost interno
            if ((!ip || ip === 'localhost' || ip === 'tauri.localhost') && !((window as any).__TAURI__)) {
                try {
                    const res = await fetch('/api/local-ip');
                    if (res.ok) {
                        const data = await res.json();
                        if (data.ip) ip = data.ip;
                    }
                } catch (e) { }
            }

            // 3. Fallback: window.location.hostname
            // Mas ignoramos 'localhost', '127.0.0.1' e 'tauri.localhost' se quisermos o IP externo
            if (!ip || ip === 'localhost' || ip === '127.0.0.1' || ip === 'tauri.localhost') {
                const hostname = window.location.hostname;
                if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== 'tauri.localhost') {
                    ip = hostname;
                }
            }

            // Validar resultado final
            // Se ainda for inválido, definimos como null para mostrar msg de erro ou localhost
            if (ip === 'tauri.localhost') ip = '';

            if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
                setLocalIp(ip);
                setBibleLink(`http://${ip}:3000/projection`);
                setMusicLink(`http://${ip}:3000/projection-music`);
            } else {
                setLocalIp('Não detectado (Verifique Wi-Fi)');
                // Fallback seguro mostrando o que temos
                const fallbackIp = ip || 'localhost';
                setBibleLink(`http://${fallbackIp}:3000/projection`);
                setMusicLink(`http://${fallbackIp}:3000/projection-music`);
            }
        };

        getIp();
    }, []);

    const copyLink = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Link copiado!');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-sans">
            <div className="bg-[#222] border border-[#444] rounded-md shadow-2xl w-full max-w-lg p-6 text-white relative">

                {/* Cabeçalho */}
                <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-2">
                    <h2 className="text-lg font-bold text-gray-200">Links de Projeção</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white px-2 text-xl font-bold">X</button>
                </div>

                <div className="space-y-6">

                    {/* Link Bíblia */}
                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Bíblia (Texto)</label>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-black/40 border border-[#333] rounded px-3 py-2 text-blue-400 font-mono text-sm truncate select-all">
                                {bibleLink}
                            </div>
                            <button
                                onClick={() => copyLink(bibleLink)}
                                className="bg-[#333] hover:bg-[#444] text-white px-4 py-2 rounded text-xs font-bold uppercase transition border border-[#444]"
                            >
                                Copiar
                            </button>
                        </div>
                    </div>

                    {/* Link Louvor */}
                    <div>
                        <label className="block text-xs uppercase font-bold text-gray-400 mb-1">Louvor (Música)</label>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-black/40 border border-[#333] rounded px-3 py-2 text-blue-400 font-mono text-sm truncate select-all">
                                {musicLink}
                            </div>
                            <button
                                onClick={() => copyLink(musicLink)}
                                className="bg-[#333] hover:bg-[#444] text-white px-4 py-2 rounded text-xs font-bold uppercase transition border border-[#444]"
                            >
                                Copiar
                            </button>
                        </div>
                    </div>

                    {/* Aviso */}
                    <div className="bg-[#2a2a2a] p-3 rounded border-l-2 border-yellow-600/50">
                        <p className="text-xs text-gray-400">
                            Certifique-se que o dispositivo (celular/tablet) esteja no <strong>mesmo Wi-Fi</strong> deste computador.
                        </p>
                    </div>

                </div>

                {/* Botão Fechar Inferior */}
                <div className="mt-8 flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xs hover:underline"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
