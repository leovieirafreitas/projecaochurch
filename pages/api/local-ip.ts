import { networkInterfaces } from 'os';
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const nets = networkInterfaces();
    let localIp = 'localhost';

    // Tenta encontrar o IP da rede local (não interno)
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if ((net.family === 'IPv4' || (net.family as any) === 4) && !net.internal) {
                localIp = net.address;
                // Retorna o primeiro encontrado (geralmente o correto da interface principal)
                // Mas vamos tentar priorizar interfaces comuns se houver duvida, por enquanto o primeiro serve.
                return res.status(200).json({ ip: localIp });
            }
        }
    }

    res.status(200).json({ ip: localIp });
}
