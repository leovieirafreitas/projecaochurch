import { supabase } from '../../lib/supabaseClient';

/* eslint-disable @typescript-eslint/no-explicit-any */
const globalAny: any = global;

// Initialize global cache if it doesn't exist
if (!globalAny.projectionCache) {
    globalAny.projectionCache = { verseText: '', reference: '', slideIndex: 0, style: {}, timestamp: Date.now() };
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '30mb',
        },
    },
};

export default async function handler(req: any, res: any) {
    // Set headers to prevent caching and allow cross-origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const currentData = req.body;

            // 1. Update In-Memory Cache (Instant)
            globalAny.projectionCache = currentData;

            // 2. Persist to Supabase (FIRE AND FORGET - Don't await to avoid latency/500s)
            if (supabase) {
                (supabase
                    .from('projection_state')
                    .update({
                        data: currentData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', 1) as any)
                    .then(({ error }: any) => {
                        if (error) console.error("Supabase Background Sync Error:", error);
                    })
                    .catch((err: any) => console.error("Supabase Promise Error:", err));
            }

            return res.status(200).json({ success: true, mode: 'cached' });
        } catch (error) {
            console.error("API Error:", error);
            return res.status(500).json({ error: 'Save failed' });
        }
    } else {
        // GET Request
        try {
            // 1. Metadata Request (?meta=true)
            // Permite que o receiver verifique se o dado mudou sem baixar 10MB de imagem toda vez
            if (req.query.meta === 'true') {
                const cache = globalAny.projectionCache || {};

                // Garantia de tipos para evitar 500
                const ts = typeof cache.timestamp === 'number' ? cache.timestamp : 0;
                const idx = typeof cache.slideIndex === 'number' ? cache.slideIndex : 0;
                const text = typeof cache.verseText === 'string' ? cache.verseText.substring(0, 20) : '';

                return res.status(200).json({
                    timestamp: ts,
                    slideIndex: idx,
                    verseText: text,
                    hasStyle: !!cache.style
                });
            }

            // 2. Serve from In-Memory Cache (Light Speed)
            if (globalAny.projectionCache) {
                return res.status(200).json(globalAny.projectionCache);
            }

            // 3. Fallback: Fetch from Supabase (Cold Start)
            if (supabase) {
                const { data, error } = await supabase
                    .from('projection_state')
                    .select('data')
                    .eq('id', 1)
                    .single();

                if (!error && data?.data) {
                    globalAny.projectionCache = data.data;
                    console.log("[StatusAPI] Cache aquecido via Supabase");
                    return res.status(200).json(data.data);
                }
            }

            return res.status(200).json({ verseText: '', reference: '', style: {}, timestamp: Date.now() });
        } catch (error) {
            console.error("Read Error:", error);
            // Nunca retorne 500 no GET para não travar o loop de pooling
            return res.status(200).json({ verseText: '', reference: '', style: {}, timestamp: 0 });
        }
    }
}
