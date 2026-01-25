
const YOUVERSION_BASE_URL = 'https://api.youversion.com/v1';
const APP_KEY = '8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7';

/**
 * Cliente para API Oficial YouVersion (Via Proxy Local) + Fallback Externo
 */
export class YouVersionClient {
    private static async request(endpoint: string, params: Record<string, string> = {}) {
        const url = new URL('/api/proxy', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
        url.searchParams.append('endpoint', endpoint);

        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                console.warn(`[YouVersionClient] Erro API ${response.status}`);
                return null;
            }

            const rawText = await response.text();
            if (!rawText || rawText.trim() === '') return null;

            try {
                return JSON.parse(rawText);
            } catch (e) { return null; }

        } catch (error) {
            console.error('YouVersion Request Failed:', error);
            return null;
        }
    }

    static async getVersions(): Promise<any[]> {
        // Revertendo para 'por' que é o padrão seguro da API
        const data = await this.request('/bibles', { 'language_ranges[]': 'por' });
        const versions = data?.data || [];

        // Injetar Almeida Externa no topo
        return [
            {
                id: 'ALMEIDA_EXTERNA',
                abbreviation: 'ACF',
                // Usando local_title para aparecer bonito no menu (conforme nosso código do componente)
                name: 'Almeida Corrigida Fiel (Externa)',
                local_title: 'Almeida Corrigida Fiel',
                description: 'Versão externa via Bible-API',
                lang: 'pt'
            },
            ...versions
        ];
    }

    static async getBooks(bibleId: string): Promise<any[]> {
        if (bibleId === 'ALMEIDA_EXTERNA') {
            // Retorna lista padrão de livros (usando NVI como base para estrutura)
            // Isso é um hack: usamos a estrutura da YouVersion 129 para navegar na externa
            const data = await this.request(`/bibles/129/books`);
            return data?.data || [];
        }
        const data = await this.request(`/bibles/${bibleId}/books`);
        return data?.data || [];
    }

    static async getChapters(bibleId: string, bookId: string): Promise<any[]> {
        // Mesma lógica: usa estrutura da NVI (129) para navegação
        const realId = bibleId === 'ALMEIDA_EXTERNA' ? '129' : bibleId;
        const data = await this.request(`/bibles/${realId}/books/${bookId}/chapters`);
        return data?.data || [];
    }

    static async getPassage(bibleId: string, passageId: string): Promise<any> {
        // SE FOR VERSÃO EXTERNA
        if (bibleId === 'ALMEIDA_EXTERNA') {
            return await this.fetchExternalBibleApi(passageId);
        }

        // NORMAL (YouVersion)
        const data = await this.request(`/bibles/${bibleId}/passages/${passageId}`, {
            'content_type': 'html',
            'format': 'html'
        });

        if (!data) return null;
        if (data.content) return data;
        if (data.data) return data.data;
        return data;
    }

    // Adapter para Bible-API.com (Almeida)
    private static async fetchExternalBibleApi(passageId: string) {
        try {
            const ref = passageId.replace('.', '+');
            const url = `https://bible-api.com/${ref}?translation=almeida`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('Falha na API Externa');
            const json = await res.json();

            // Gerar HTML estilo YouVersion (Texto corrido com spans)
            let html = `<div class="yv-content">`;

            if (json.reference) html += `<h1 class="s1">${json.reference.toUpperCase()}</h1>`;

            if (json.verses && Array.isArray(json.verses)) {
                json.verses.forEach((v: any) => {
                    // Estrutura EXATA que o parser espera:
                    // <span class="verse" data-usfm="GEN.1.1"><span class="label">1</span><span class="content">Texto</span></span>

                    // Se o texto vier com quebras de linha, tratar
                    const cleanText = v.text.replace(/[\n\r]+/g, ' ').trim();

                    html += `<span class="verse" data-usfm="${passageId}.${v.verse}">`;
                    html += `<span class="label">${v.verse}</span>`;
                    html += `<span class="content"> ${cleanText} </span>`;
                    html += `</span> `; // Espaço importante
                });
            } else if (json.text) {
                // Fallback Texto Único (Tenta quebrar por regex)
                const verses = json.text.match(/(\d+)([^0-9]+)/g) || [json.text];
                verses.forEach((vStr: string) => {
                    const match = vStr.match(/(\d+)(.*)/);
                    if (match) {
                        html += `<span class="verse"><span class="label">${match[1]}</span><span class="content">${match[2]}</span></span> `;
                    } else {
                        html += `<p>${vStr}</p>`;
                    }
                });
            }
            html += `</div>`;

            return {
                id: passageId,
                content: html,
                reference: json.reference
            };

        } catch (err) {
            console.error('Erro API Externa:', err);
            return { content: '<p>Erro ao carregar texto da fonte externa.</p>' };
        }
    }
}
