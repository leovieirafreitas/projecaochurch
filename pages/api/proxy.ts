
import type { NextApiRequest, NextApiResponse } from 'next';
import https from 'https';
import { URL } from 'url';

// Forçar Node.js Runtime (evitar Edge)
export const config = {
    api: {
        bodyParser: false, // Opcional, mas bom para proxies
        externalResolver: true,
    },
};

// SEGURANÇA: Chave vem do ENV agora
const APP_KEY = process.env.YOUVERSION_API_KEY || '';
const BASE_URL = 'https://api.youversion.com/v1';

export default async function handler(req: any, res: any) {
    console.log('[Proxy-HTTPS] Hit!'); // Confirmação que chegou aqui

    let endpoint = req.query.endpoint;
    if (Array.isArray(endpoint)) endpoint = endpoint[0];

    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

    // Montar URL correta
    const cleanEndpoint = endpoint.replace(/^\//, '');
    const targetUrlStr = `${BASE_URL}/${cleanEndpoint}`;
    const targetUrl = new URL(targetUrlStr);

    // Params
    Object.keys(req.query).forEach(key => {
        if (key !== 'endpoint') {
            targetUrl.searchParams.append(key, req.query[key]);
        }
    });

    console.log(`[Proxy-HTTPS] Target: ${targetUrl.toString()}`);

    const options = {
        hostname: targetUrl.hostname,
        port: 443,
        path: targetUrl.pathname + targetUrl.search,
        method: 'GET',
        headers: {
            'x-yvp-app-key': APP_KEY,
            'Accept': 'application/json',
            'User-Agent': 'PostmanRuntime/7.26.8'
        }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        let rawData = '';

        console.log(`[Proxy-HTTPS] Upstream Status: ${proxyRes.statusCode}`);

        proxyRes.setEncoding('utf8');

        proxyRes.on('data', (chunk) => {
            rawData += chunk;
        });

        proxyRes.on('end', () => {
            console.log(`[Proxy-HTTPS] Body Size: ${rawData.length}`);
            console.log(`[Proxy-HTTPS] Status Code: ${proxyRes.statusCode}`);
            console.log(`[Proxy-HTTPS] First 500 chars:`, rawData.substring(0, 500));

            // Se vazio, alerta
            if (!rawData) {
                console.error('[Proxy-HTTPS] EMPTY BODY FROM UPSTREAM');
                return res.status(200).json({ error: 'EMPTY_BODY_FROM_UPSTREAM', status: proxyRes.statusCode });
            }

            // Se for 404 ou erro, retornar o erro
            if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
                console.error(`[Proxy-HTTPS] API Error ${proxyRes.statusCode}:`, rawData);
                return res.status(proxyRes.statusCode).json({
                    error: 'API_ERROR',
                    status: proxyRes.statusCode,
                    message: rawData
                });
            }

            try {
                const parsedData = JSON.parse(rawData);
                res.status(proxyRes.statusCode || 200).json(parsedData);
            } catch (e: any) {
                console.error('[Proxy-HTTPS] Invalid JSON');
                // Retorna texto bruto embrulhado se falhar JSON
                res.status(200).json({ error: 'INVALID_JSON', raw: rawData });
            }
        });
    });

    proxyReq.on('error', (e) => {
        console.error(`[Proxy-HTTPS] Request error: ${e.message}`);
        res.status(500).json({ error: e.message });
    });

    proxyReq.end();
}
