import { BibleVersion, BibleBook, BibleVerse } from './types';

const HOLYRICS_BASE_URL = 'http://localhost:80/api';
// Você pode mover isso para .env.local
const TOKEN = '4h7sSD4oabhZJ0TR';

/**
 * Cliente para se comunicar com o Script Proxy do Holyrics
 * 
 * Requer que o script 'Bible API Proxy' esteja rodando no Holyrics
 */
export class HolyricsClient {
    private static async request(action: string, params: any = {}) {
        // IMPORTANTE: 
        // O endpoint /api/my_custom_action aciona o 'case "my_custom_action"' no Holyrics
        // O conteúdo (body) é passado para a função myCustomAction(content)
        // Então passamos a 'sub-action' desejada (ex: get_bible_versions) dentro do body

        const url = `${HOLYRICS_BASE_URL}/my_custom_action?token=${TOKEN}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action, // A ação que nosso script JS vai ler
                    params: params
                }),
            });

            if (!response.ok) {
                throw new Error(`Holyrics API Error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status === 'error') {
                throw new Error(`Holyrics Script Error: ${result.error}`);
            }

            return result.data;
        } catch (error) {
            console.error('Holyrics Request Failed:', error);
            throw error;
        }
    }

    static async getVersions(): Promise<BibleVersion[]> {
        try {
            return await this.request('get_bible_versions');
        } catch (e) {
            console.warn('Falha ao obter versões via proxy, retornando padrão.', e);
            return [];
        }
    }

    static async getBooks(version: string): Promise<BibleBook[]> {
        try {
            return await this.request('get_bible_books', { version });
        } catch (e) {
            console.warn('Falha ao obter livros via proxy.', e);
            return [];
        }
    }

    static async getVerses(version: string, reference: string): Promise<any> {
        try {
            return await this.request('get_bible_text', { version, reference });
        } catch (e) {
            console.warn('Falha ao obter versículos via proxy.', e);
            return null;
        }
    }
}
