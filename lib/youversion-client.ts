
import { LocalBibleManager } from './local-bible-manager';

const YOUVERSION_BASE_URL = 'https://api.youversion.com/v1';
const APP_KEY = '8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7';

// --- BIBLE BRAIN (DBT) CONFIG ---
// Usa a chave do ambiente (NEXT_PUBLIC para frontend, ou variável de servidor)
const DBT_KEY = process.env.NEXT_PUBLIC_BIBLEBRAIN_API_KEY || process.env.BIBLEBRAIN_API_KEY || "db346576-060a-4787-8bc2-5386e8e3be8d";
const DBT_BIBLES: Record<string, any> = {
    'PORACF': { id: 'PORACF', name: 'Almeida Corrigida Fiel (Bible Brain)', abbr: 'ACF', ot: 'PORACF', nt: 'PORACF' },
    'PORBBS': { id: 'PORBBS', name: 'Nova Almeida Atualizada', abbr: 'NAA', ot: 'PORBBSO_ET', nt: 'PORBBSN_ET' },
    'PORARA': { id: 'PORARA', name: 'Almeida Revista e Atualizada (NT)', abbr: 'ARA', ot: null, nt: 'PORARA' },
    'PORARC': { id: 'PORARC', name: 'Almeida Revista e Corrigida (NT)', abbr: 'ARC', ot: null, nt: 'PORARCN_ET' }
};

// Set de Livros do Antigo Testamento para filtro
const OT_BOOKS_SET = new Set(["GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZE", "DAN", "HOS", "JOE", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "EZK", "JOL"]);

/**
 * Cliente para API Oficial YouVersion (Via Proxy Local) + Fallback Externo + Bible Brain (DBT)
 */
// Declare Tauri globals
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
    interface Window {
        __TAURI__?: {
            invoke: (cmd: string, args?: any) => Promise<any>;
        };
    }
}

export class YouVersionClient {
    // Cache em memória simples para a sessão atual
    private static cache: Record<string, { data: any, timestamp: number }> = {};
    private static CACHE_TTL = 1000 * 60 * 60; // 1 Hora

    private static getFromCache(key: string) {
        const cached = this.cache[key];
        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
            return cached.data;
        }
        return null;
    }

    private static setCache(key: string, data: any) {
        this.cache[key] = { data, timestamp: Date.now() };
    }

    private static async request(endpoint: string, params: Record<string, string> = {}) {
        // Cache Key baseada no endpoint e params
        const cacheKey = `${endpoint}_${JSON.stringify(params)}`;

        // Tentar Cache primeiro
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log(`[Cache-HIT] ${endpoint}`);
            return cached;
        }

        let result = null;

        // TAURI PATH (Rust Backend)
        if (typeof window !== 'undefined' && window.__TAURI__) {
            try {
                // O Rust espera params como Map<String, String>
                result = await window.__TAURI__.invoke('youversion_proxy', { endpoint, params });
            } catch (e) {
                console.error("[Tauri] Proxy Error:", e);
                // null
            }
        }
        else {
            // BROWSER / WEB PATH
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

                if (response.ok) {
                    const rawText = await response.text();
                    if (rawText && rawText.trim() !== '') {
                        try {
                            result = JSON.parse(rawText);
                        } catch (e) { }
                    }
                }
            } catch (error) {
                console.error('YouVersion Request Failed:', error);
            }
        }

        // Se conseguiu fetch, salva no cache
        if (result) {
            this.setCache(cacheKey, result);
        }

        return result;
    }

    static async getVersions(): Promise<any[]> {
        // Converter DBT BIBLES para formato YouVersion
        const dbtList = Object.values(DBT_BIBLES).map(b => ({
            id: b.id,
            abbreviation: b.abbr,
            name: b.name,
            local_title: b.name,
            description: 'Via Bible Brain',
            lang: 'pt-br'
        }));

        // Versões alternativas sempre disponíveis
        const alternativeVersions = [
            {
                id: 'ALMEIDA_EXTERNA',
                abbreviation: 'ACF (Old)',
                name: 'ACF (Bible-API.com)',
                local_title: 'Almeida Corrigida Fiel (API Antiga)',
                description: 'Versão externa via Bible-API',
                lang: 'pt'
            },
            ...dbtList
        ];

        try {
            // Tentar buscar da API YouVersion (somente se não estiver offline forçado)
            const data = await this.request('/bibles', { 'language_ranges[]': 'por' });
            const versions = data?.data || [];

            if (versions.length > 0) {
                console.log('[YouVersion] API funcionando, retornando', versions.length, 'versões');
                return [...alternativeVersions, ...versions];
            } else {
                console.warn('[YouVersion] API retornou vazio, usando apenas versões alternativas');
                return alternativeVersions;
            }
        } catch (e) {
            console.error('[YouVersion] API falhou, usando apenas versões alternativas:', e);
            return alternativeVersions;
        }
    }

    static async getBooks(bibleId: string): Promise<any[]> {
        if (bibleId === 'ALMEIDA_EXTERNA' || DBT_BIBLES[bibleId]) {
            // Retorna lista padrão de livros (usando NVI como base para estrutura)
            const data = await this.request(`/bibles/129/books`);
            let books = data?.data || [];

            // SE for DBT e tem config NT-Only, filtrar OT
            const dbtCfg = DBT_BIBLES[bibleId];
            if (dbtCfg && dbtCfg.ot === null) {
                books = books.filter((b: any) => !OT_BOOKS_SET.has(b.id) && !OT_BOOKS_SET.has(b.usfm) && !OT_BOOKS_SET.has(b.abbreviation));
            }
            return books;
        }
        const data = await this.request(`/bibles/${bibleId}/books`);
        return data?.data || [];
    }

    static async getChapters(bibleId: string, bookId: string): Promise<any[]> {
        // Mesma lógica: usa estrutura da NVI (129) para navegação
        const realId = (bibleId === 'ALMEIDA_EXTERNA' || DBT_BIBLES[bibleId]) ? '129' : bibleId;
        const data = await this.request(`/bibles/${realId}/books/${bookId}/chapters`);
        return data?.data || [];
    }

    static async getPassage(bibleId: string, passageId: string): Promise<any> {
        // 1. Tentar Offline Local (Arquivos Baixados)
        try {
            const parts = passageId.split('.');
            const bookId = parts[0];

            const local = await LocalBibleManager.getChapter(bibleId, bookId, passageId);
            if (local) {
                console.log(`[YouVersion] Usando versão local para ${bibleId} ${passageId}`);
                return local;
            }
        } catch (e) { }

        // 2. Fetch da Rede (Lógica original)

        // SE FOR VERSÃO EXTERNA BIBLE-API
        if (bibleId === 'ALMEIDA_EXTERNA') {
            return await this.fetchExternalBibleApi(passageId);
        }

        // SE FOR BIBLE BRAIN (DBT)
        if (DBT_BIBLES[bibleId]) {
            return await this.fetchFromBibleBrain(bibleId, passageId);
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


    /**
     * Baixa uma versão inteira para acesso offline.
     */
    static async downloadVersion(versionId: string, onProgress: (msg: string, pct: number) => void, shouldStop: () => boolean) {
        try {
            console.log(`[Download] Iniciando download da versão ${versionId}`);
            const books = await this.getBooks(versionId);

            if (!books || books.length === 0) throw new Error("Não foi possível listar os livros.");

            for (let i = 0; i < books.length; i++) {
                if (shouldStop()) { console.log('[Download] Cancelado pelo usuário.'); break; }

                const book = books[i];
                // Identificar ID correto. Algumas APIs retornam 'id', outras 'usfm', outras 'abbreviation'
                const bookId = book.id || book.usfm || book.abbreviation;

                onProgress(`Baixando ${book.name || bookId} (${i + 1}/${books.length})...`, Math.floor((i / books.length) * 100));

                try {
                    const chapters = await this.getChapters(versionId, bookId);

                    // Serial para evitar rate limit
                    for (const chap of chapters) {
                        if (shouldStop()) break;

                        const chapId = chap.passage_id || chap.id || chap.usfm;
                        if (!chapId) continue;

                        // Verifica se já existe localmente para pular
                        const exists = await LocalBibleManager.getChapter(versionId, bookId, chapId);

                        if (!exists) {
                            // Busca e Salva
                            const content = await this.getPassage(versionId, chapId);

                            if (content && (content.content || content.data)) {
                                const saved = await LocalBibleManager.saveChapter(versionId, bookId, chapId, content);
                                if (!saved) {
                                    throw new Error(`Falha ao gravar arquivo no disco para ${chapId}. Verifique permissões.`);
                                }
                            } else {
                                console.warn(`[Download] Falha ao baixar ${chapId}`);
                                // Optional: throw error/count failures?
                            }

                            // Delay mínimo para evitar bloqueio de API
                            await new Promise(r => setTimeout(r, 150));
                        }
                    }
                } catch (eBook: any) {
                    console.error(`[Download] Erro ao baixar livro ${bookId}:`, eBook);
                    // Se for erro de disco, repassar
                    if (eBook.message && eBook.message.includes('disco')) throw eBook;
                }
            }
            onProgress('Download Concluído!', 100);
        } catch (e: any) {
            console.error('[Download] Erro fatal:', e);
            onProgress(`Erro: ${e.message || 'Falha no download'}`, 0);
            throw e;
        }
    }

    // Adapter para Bible Brain (dbt.io)
    private static async fetchFromBibleBrain(versionId: string, passageId: string) {
        // passageId: ex "GEN.1"
        try {
            const parts = passageId.split('.');
            const book = parts[0];
            const chap = parts[1];

            const cfg = DBT_BIBLES[versionId];
            if (!cfg) throw new Error("Config not found");

            // Determinar OT ou NT
            // Determinar OT ou NT
            const isOT = OT_BOOKS_SET.has(book.toUpperCase());

            const filesetId = isOT ? cfg.ot : cfg.nt;

            if (!filesetId) {
                // Se fileset_id for nulo (CASO ARA/ARC OT), retorna mensagem de erro como conteúdo
                return {
                    content: `<div class="p-4 bg-red-100 text-red-800 rounded">O Antigo Testamento não está disponível nesta versão gratuita (ARA/ARC) pela Bible Brain. Tente a versão 'Nova Almeida Atualizada' ou 'Almeida Corrigida Fiel'.</div>`,
                    ref: passageId
                };
            }

            const url = `https://4.dbt.io/api/bibles/filesets/${filesetId}/${book}/${chap}?v=4&key=${DBT_KEY}`;
            const res = await fetch(url);

            if (!res.ok) {
                // Se der 404, pode ser mapeamento de livro errado
                console.error("DBT 404", url);
                throw new Error("Capítulo não encontrado na Bible Brain");
            }

            const json = await res.json();
            const verses = json.data || [];

            // Montar HTML compatível
            let html = `<div class="yv-content">`;

            // Ordenar por verso (verse_start)
            verses.sort((a: any, b: any) => parseInt(a.verse_start) - parseInt(b.verse_start));

            verses.forEach((v: any) => {
                const num = v.verse_start;
                const text = v.verse_text;
                // Remover quebras de linha estranhas
                const cleanText = text.replace(/[\n\r]+/g, ' ').trim();

                html += `<span class="verse" data-usfm="${passageId}.${num}">`;
                html += `<span class="label">${num}</span>`;
                html += `<span class="content"> ${cleanText} </span>`;
                html += `</span> `;
            });
            html += `</div>`;

            return {
                id: passageId,
                content: html,
                reference: `${cfg.abbr} ${book} ${chap}` // Placeholder ref
            };

        } catch (e) {
            console.error("DBT Fetch Error", e);
            return { content: '<p>Erro ao carregar texto da Bible Brain (DBT).</p>' };
        }
    }

    // Adapter para Bible-API.com (Almeida)
    private static async fetchExternalBibleApi(passageId: string) {
        try {
            let ref = passageId.replace('.', '+');

            // CORREÇÃO: Livros de capítulo único retornam apenas verso 1 se não especificar range
            const singleChapBooks: Record<string, number> = {
                'OBA': 21, 'PHM': 25, '2JN': 13, '3JN': 15, 'JUD': 25
            };

            const bookCode = passageId.split('.')[0];
            if (singleChapBooks[bookCode]) {
                const maxVerses = singleChapBooks[bookCode];
                ref = `${ref}:1-${maxVerses}`;
            }

            const url = `https://bible-api.com/${ref}?translation=almeida`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('Falha na API Externa');
            const json = await res.json();

            // Gerar HTML estilo YouVersion (Texto corrido com spans)
            let html = `<div class="yv-content">`;

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
