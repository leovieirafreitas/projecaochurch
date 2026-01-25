import { supabase } from '../../lib/supabaseClient';

/* eslint-disable @typescript-eslint/no-explicit-any */
const globalAny: any = global;

// Initialize global cache if it doesn't exist
if (!globalAny.projectionCache) {
    globalAny.projectionCache = null;
}

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

            // 2. Persist to Supabase (Async/Background)
            // We await here to ensure data consistency in local dev environment
            const { error } = await supabase
                .from('projection_state')
                .update({
                    data: currentData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (error) {
                console.error("Supabase Sync Error:", error);
                // We don't throw here to avoid failing the client request based on DB latency
            }

            return res.status(200).json({ success: true, mode: 'cached' });
        } catch (error) {
            console.error("API Error:", error);
            return res.status(500).json({ error: 'Save failed' });
        }
    } else {
        // GET Request
        try {
            // 1. Serve from In-Memory Cache (Light Speed)
            if (globalAny.projectionCache) {
                return res.status(200).json(globalAny.projectionCache);
            }

            // 2. Fallback: Fetch from Supabase (Cold Start)
            const { data, error } = await supabase
                .from('projection_state')
                .select('data')
                .eq('id', 1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            const finalData = data?.data || {};
            globalAny.projectionCache = finalData; // Warm up cache

            return res.status(200).json(finalData);
        } catch (error) {
            console.error("Read Error:", error);
            return res.status(500).json({ error: 'Read failed' });
        }
    }
}
