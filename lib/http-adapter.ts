
import { fetch as tauriFetch, Body, ResponseType } from '@tauri-apps/api/http';

/**
 * Smart Fetch wrapper that uses Tauri's HTTP Client when available (to bypass CORS)
 * and falls back to standard fetch in web environment.
 */
export async function smartFetch(url: string, options: any = {}) {
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__;

    if (isTauri) {
        console.log('[HttpAdapter] Using Tauri HTTP Client for:', url);
        try {
            const method = options.method || 'GET';
            const headers = options.headers || {};

            let body = undefined;
            if (options.body) {
                if (typeof options.body === 'string') {
                    body = Body.text(options.body);
                } else {
                    body = Body.json(options.body);
                }
            }

            const response = await tauriFetch(url, {
                method,
                headers,
                body,
                responseType: ResponseType.Text // Force Text response for SOAP/XML
            });

            return {
                ok: response.ok,
                status: response.status,
                text: async () => response.data as string,
                json: async () => {
                    try {
                        return JSON.parse(response.data as string);
                    } catch (e) {
                        // Se responseType foi Text, data é string. Se JSON, data já é obj.
                        if (typeof response.data === 'object') return response.data;
                        throw e;
                    }
                }
            };

        } catch (e) {
            console.error("[HttpAdapter] Tauri Fetch Error:", e);
            throw e;
        }
    } else {
        // Web Standard Fetch (CORS apply)
        return fetch(url, options);
    }
}
