import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
    onClose: () => void;
}

export default function MobileRemoteModal({ onClose }: Props) {
    const [ips, setIps] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIp, setSelectedIp] = useState('');

    useEffect(() => {
        const fetchIp = async () => {
            // 1. Tentar via Tauri (Desktop)
            if (typeof window !== 'undefined' && (window as any).__TAURI__) {
                try {
                    const ip = await (window as any).__TAURI__.invoke('get_local_ip');
                    if (ip) {
                        setIps([ip]);
                        setSelectedIp(ip);
                        setLoading(false);
                        return;
                    }
                } catch (e) { console.error("Tauri IP Error", e); }
            }

            // 2. Fallback Fetch (Web/Dev)
            fetch('/api/local-ip')
                .then(r => r.json())
                .then(data => {
                    const list: string[] = [];
                    // Handle both Array (if changed) or Object (standard)
                    if (Array.isArray(data)) {
                        list.push(...data);
                    } else {
                        Object.values(data).forEach((ips: any) => {
                            if (Array.isArray(ips)) list.push(...ips);
                            else if (typeof ips === 'string') list.push(ips);
                        });
                    }

                    // Sort 192.168 first
                    list.sort((a, b) => {
                        if (a.startsWith('192.168') && !b.startsWith('192.168')) return -1;
                        if (!a.startsWith('192.168') && b.startsWith('192.168')) return 1;
                        return 0;
                    });

                    setIps(list);
                    if (list.length > 0) setSelectedIp(list[0]);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        };
        fetchIp();
    }, []);

    const port = '4523'; // Always use Actix Server port for Remote
    const remoteUrl = selectedIp ? `http://${selectedIp}:${port}/remote` : '';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#1e1e1e] border border-[#333] p-6 rounded-xl shadow-2xl max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-2">Controle Remoto</h2>
                <p className="text-gray-400 text-sm mb-6">Escaneie o QR Code com seu celular para controlar a projeção via Wi-Fi.</p>

                {loading ? (
                    <div className="h-48 flex items-center justify-center text-gray-500">Carregando IPs...</div>
                ) : (
                    <>
                        {remoteUrl ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="bg-white p-2 rounded-lg">
                                    <QRCodeSVG value={remoteUrl} size={200} />
                                </div>

                                <a href={remoteUrl} target="_blank" rel="noreferrer" className="text-blue-400 text-xs font-mono break-all hover:underline">
                                    {remoteUrl}
                                </a>

                                {ips.length > 1 && (
                                    <div className="flex flex-col gap-1 items-center">
                                        <span className="text-[10px] text-gray-500 uppercase font-bold">Selecionar IP:</span>
                                        <select
                                            className="bg-[#333] text-gray-300 text-xs p-1 rounded border border-[#444]"
                                            value={selectedIp}
                                            onChange={e => setSelectedIp(e.target.value)}
                                        >
                                            {ips.map(ip => <option key={ip} value={ip}>{ip}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-red-400 text-sm bg-red-900/20 p-4 rounded-lg border border-red-900/50">
                                <strong>Não foi possível detectar o IP.</strong>
                                <p className="mt-1 text-xs opacity-70">Verifique se está conectado ao Wi-Fi ou rede local.</p>
                            </div>
                        )}
                    </>
                )}

                <button
                    onClick={onClose}
                    className="mt-6 bg-[#333] hover:bg-[#444] text-white px-4 py-2 rounded-lg text-sm font-bold w-full transition"
                >
                    Fechar
                </button>
            </div>
        </div>
    );
}
