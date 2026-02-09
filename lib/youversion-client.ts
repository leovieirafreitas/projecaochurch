import { LocalBibleManager } from './local-bible-manager';
import { SbtbClient } from './sbtb-client';
import { VERSION_FULL_NAMES, OLD_TESTAMENT_BOOKS, BIBLE_BOOKS_DATA } from './bible-data';

const YOUVERSION_BASE_URL = 'https://api.youversion.com/v1';
const APP_KEY = '8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7';

// --- BIBLE BRAIN (DBT) CONFIG ---
// Usa a chave do ambiente (NEXT_PUBLIC para frontend, ou variável de servidor)
const DBT_KEY = process.env.NEXT_PUBLIC_BIBLEBRAIN_API_KEY || process.env.BIBLEBRAIN_API_KEY || "db346576-060a-4787-8bc2-5386e8e3be8d";
const DBT_BIBLES: Record<string, any> = {
    'PORACF': { id: 'PORACF', name: 'Almeida Corrigida Fiel', abbr: 'ACF', ot: 'PORACF', nt: 'PORACF' },
    // Mapeando ACF legado para usar a infraestrutura rápida da Bible Brain (DBT) em vez de SOAP lento
    'ACF': { id: 'PORACF', name: 'Almeida Corrigida Fiel', abbr: 'ACF', ot: 'PORACF', nt: 'PORACF', hidden: true },
    'ACF_SBTB': { id: 'PORACF', name: 'Almeida Corrigida Fiel (SBTB)', abbr: 'ACF', ot: 'PORACF', nt: 'PORACF', hidden: true },

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

    private static isRepairing = false;

    static async getVersions(): Promise<any[]> {
        // Converter DBT BIBLES para formato YouVersion
        const dbtList = Object.values(DBT_BIBLES)
            .filter((b: any) => !b.hidden)
            .map(b => ({
                id: b.id,
                abbreviation: b.abbr,
                name: b.name,
                local_title: b.name,
                description: 'Via Bible Brain',
                lang: 'pt-br'
            }));

        // Versões locais (Offline/Importadas)
        const localVersions = await LocalBibleManager.getLocalVersions();

        // AUTO-REPAIR BACKGROUND CHECK
        // Verifica se alguma versão local está precaria (sem stats) e repara silenciosamente
        if (!this.isRepairing && typeof window !== 'undefined') {
            const needsFix = localVersions.some((v: any) => !v.booksStats || Object.keys(v.booksStats).length === 0 || !v.name || !isNaN(Number(v.name)));
            if (needsFix) {
                this.isRepairing = true;
                console.log('[AutoRepair] Detectado versões com metadata incompleto. Iniciando reparo em background...');
                LocalBibleManager.fixAllMetadata().then(res => {
                    this.isRepairing = false;
                    if ((res.count || 0) > 0) {
                        console.log(`[AutoRepair] Corrigidas ${res.count} versões.`);
                        window.dispatchEvent(new Event('offline-bibles-changed'));
                    }
                }).catch(() => { this.isRepairing = false; });
            }
        }
        const localIds = new Set(localVersions.map((v: any) => String(v.id)));

        // Filter out DBT versions that are already local
        const uniqueDbtList = dbtList.filter(v => !localIds.has(String(v.id)));

        // Versões alternativas sempre disponíveis
        const alternativeVersions = [
            ...localVersions, // Prioridade para locais
            ...uniqueDbtList
        ];

        try {
            // Tentar buscar da API YouVersion (somente se não estiver offline forçado)
            const data = await this.request('/bibles', { 'language_ranges[]': 'por' });
            const versions = data?.data || [];

            if (versions.length > 0) {
                console.log('[YouVersion] API funcionando, retornando', versions.length, 'versões');

                // Deduplicate online versions against existing logic (local + dbt + almeida)
                const existingIds = new Set(alternativeVersions.map(v => String(v.id)));
                const uniqueOnlineVersions = versions.filter((v: any) => !existingIds.has(String(v.id)));

                // INSERT CUSTOM SBTB VERSION HERE
                const sbtbVersion = {
                    id: 'ACF_SBTB',
                    abbreviation: 'ACF (SBTB)',
                    name: 'ALMEIDA CORRIGIDA FIEL (ACF- SBTB)',
                    local_title: 'ALMEIDA CORRIGIDA FIEL (ACF- SBTB)',
                    description: 'Fonte alternativa com 66 livros',
                    lang: 'pt-br'
                };

                return [sbtbVersion, ...alternativeVersions, ...uniqueOnlineVersions];
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
        // 1. Tentar Local/Offline primeiro
        const localBooks = await LocalBibleManager.getVersionBooks(bibleId);
        if (localBooks && localBooks.length > 0) {
            console.log(`[YouVersion] Usando livros locais para ${bibleId}`);
            return localBooks;
        }

        if (bibleId === 'ALMEIDA_EXTERNA' || bibleId === 'ACF_SBTB' || DBT_BIBLES[bibleId]) {
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
        // 1. Tentar Local/Offline primeiro
        const localChapters = await LocalBibleManager.getVersionChapters(bibleId, bookId);
        if (localChapters && localChapters.length > 0) {
            return localChapters;
        }

        // --- INTEGRAÇÃO SBTB (REMOVIDA EM FAVOR DA DBT/BIBLE BRAIN MAIS RÁPIDA) ---
        // A API SOAP da SBTB era muito lenta (2 requests por call).
        // Agora ACF e ACF_SBTB são roteados para DBT_BIBLES automaticamente.

        // Mesma lógica: usa estrutura da NVI (129) para navegação
        const realId = (bibleId === 'ALMEIDA_EXTERNA' || DBT_BIBLES[bibleId]) ? '129' : bibleId;
        const data = await this.request(`/bibles/${realId}/books/${bookId}/chapters`);
        return data?.data || [];
    }

    static async getPassage(bibleId: string, passageId: string): Promise<any> {
        // 1. Tentar Offline Local (Arquivos Baixados)
        // (Nota: mantemos a verificação para não bloquear downloads em andamento se houver)
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

        // --- INTEGRAÇÃO SBTB (REMOVIDA EM FAVOR DA DBT/BIBLE BRAIN MAIS RÁPIDA) ---
        // A lógica abaixo agora cai no bloco DBT_BIBLES

        // SE FOR VERSÃO EXTERNA BIBLE-API
        if (bibleId === 'ALMEIDA_EXTERNA') {
            return await this.fetchExternalBibleApi(passageId);
        }

        // SE FOR BIBLE BRAIN (DBT) - ACF, ACF_SBTB, PORACF caem aqui agora!
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
    /**
     * Baixa uma versão inteira para acesso offline.
     * VERSÃO OTIMIZADA: Download paralelo massivo
     */
    static async downloadVersion(versionId: string, onProgress: (msg: string, pct: number) => void, shouldStop: () => boolean, metadata?: any) {
        try {
            console.log(`[Download] Iniciando download OTIMIZADO da versão ${versionId}`);

            // 1. Setup inicial e Sanitização de Nome
            onProgress('Obtendo lista de livros...', 0);

            // Tenta obter lista de livros
            // Tenta obter lista de livros
            let books: any[] = [];
            try {
                books = await this.getBooks(versionId);
            } catch (e) {
                console.warn(`[Download] Falha ao obter livros da API: ${versionId}`);
            }

            // FALLBACK: Se API falhar ou retornar vazio, usa lista padrão interna (Crucial para IDs numéricos como 1967/4360)
            if (!books || books.length === 0) {
                console.log(`[Download] Usando lista de livros interna para ${versionId}`);
                books = Object.keys(BIBLE_BOOKS_DATA).map(bid => ({
                    id: bid,
                    usfm: bid,
                    name: BIBLE_BOOKS_DATA[bid].name,
                    abbreviation: BIBLE_BOOKS_DATA[bid].abbr
                }));
            }

            if (!books || books.length === 0) throw new Error("Não foi possível listar os livros.");

            // Sanitização do Metadata
            let finalMetadata = metadata || {};

            // Garante que temos um nome decente
            if (!finalMetadata.name || !isNaN(Number(finalMetadata.name))) {
                if (finalMetadata.abbreviation) {
                    finalMetadata.name = VERSION_FULL_NAMES[finalMetadata.abbreviation.toUpperCase()] || finalMetadata.abbreviation;
                } else {
                    // Tenta achar na lista interna
                    const internal = Object.values(DBT_BIBLES).find((b: any) => b.id === versionId);
                    if (internal) finalMetadata.name = internal.name;
                }
            }

            // Se ainda assim for ruim, mantém o ID mas tenta formatar
            if (!finalMetadata.name) finalMetadata.name = VERSION_FULL_NAMES[versionId] || versionId;

            // Salva metadata inicial
            await LocalBibleManager.saveVersionMetadata(versionId, finalMetadata);

            // 2. Estrutura para Coleta de Estatísticas (Versículos por Capítulo)
            // booksStats[bookId] = { chapters: number, verses: number[] (count per chapter) }
            const booksStats: Record<string, { chapters: number, verses: number[] }> = {};

            // Helper para contar versículos no HTML (rápido)
            const countVerses = (html: string) => {
                if (!html) return 0;
                // Regex expandido para capturar mais formatos de versículos
                const matches = html.match(/<span[^>]*class="[^"]*(?:label|v|verse|verse-number|versenum|num|chapternum|s1)[^"]*"[^>]*>([\d]+)<\/span>/gi);
                if (matches) return matches.length;

                // Fallback para data-usfm ou data-v
                const matches2 = html.match(/data-usfm="[^"]+\.[^"]+\.(\d+)"/gi);
                if (matches2) return matches2.length;

                // Fallback para SUP (comum em algumas versões)
                const matches3 = html.match(/<sup>\s*(\d+)\s*<\/sup>/gi);
                if (matches3) return matches3.length;

                // Fallback para IDs numéricos isolados em spans
                const matches4 = html.match(/<span[^>]*class="[^"]*(?:c-1|v-num)[^"]*"[^>]*>(\d+)<\/span>/gi);
                if (matches4) return matches4.length;

                return 0;
            };

            const ESTIMATED_TOTAL_CHAPTERS = 1189;
            let processedChapters = 0;
            let activeDownloads = 0;

            // FILA DE DOWNLOAD (Producer-Consumer pattern)
            const CONCURRENCY_LIMIT = 20;
            const DISCOVERY_CONCURRENCY = 3;

            // Estado global do download
            const queue: { bookId: string, bookName: string, chapId: string }[] = [];
            let isDiscovering = true;
            let hasError = false;

            // Função para processar a fila
            const worker = async () => {
                while ((queue.length > 0 || isDiscovering) && !shouldStop() && !hasError) {
                    if (queue.length === 0) {
                        await new Promise(r => setTimeout(r, 100));
                        continue;
                    }

                    const task = queue.shift();
                    if (!task) continue;

                    activeDownloads++;
                    try {
                        const { bookId, bookName, chapId } = task;
                        let content: any = null;

                        // Verifica cache local
                        const exists = await LocalBibleManager.getChapter(String(versionId), String(bookId), String(chapId));

                        if (exists) {
                            content = exists;
                        } else {
                            content = await this.getPassage(versionId, chapId);
                            if (content && (content.content || content.data)) {
                                await LocalBibleManager.saveChapter(
                                    String(versionId),
                                    String(bookId),
                                    String(chapId),
                                    content
                                );
                            } else {
                                console.warn(`[Download] Falha conteúdo vazio: ${chapId}`);
                            }
                        }

                        // Coleta Estatísticas para o Metadata
                        if (content) {
                            const html = content.content || content.data?.content || '';
                            const vCount = countVerses(html);

                            if (!booksStats[bookId]) {
                                booksStats[bookId] = { chapters: 0, verses: [] };
                            }

                            // Extrai número do capítulo do ID (ex: GEN.1 -> 1)
                            const chapNum = parseInt(chapId.split('.').pop() || '0');
                            if (chapNum > 0) {
                                booksStats[bookId].chapters = Math.max(booksStats[bookId].chapters, chapNum);
                                // Garante tamanho do array
                                while (booksStats[bookId].verses.length < chapNum) booksStats[bookId].verses.push(0);
                                booksStats[bookId].verses[chapNum - 1] = vCount > 0 ? vCount : 50; // Fallback 50 se parser falhar mas tiver conteúdo
                            }
                        }

                        processedChapters++;

                        // Reporta progresso (suavizado)
                        if (processedChapters % 5 === 0) {
                            const pct = Math.min(99, Math.floor((processedChapters / ESTIMATED_TOTAL_CHAPTERS) * 100));
                            onProgress(`Baixando ${bookName}... (${processedChapters} caps)`, pct);
                        }

                    } catch (e: any) {
                        console.error(`[Download] Erro task ${task?.chapId}:`, e);
                        // NÃO ABORTAR EM ERRO DE CAPÍTULO ÚNICO
                        // Apenas marca erro global para aviso, mas continua baixando o resto
                        hasError = true;
                    } finally {
                        activeDownloads--;
                    }
                }
            };

            // Inicia workers de download (Consumers)
            const downloadWorkers = Array(CONCURRENCY_LIMIT).fill(null).map(() => worker());

            // Inicia descoberta de capítulos (Producers)
            // Processa livros em pequenos lotes para não sobrecarregar API de lista
            const processBooks = async () => {
                for (let i = 0; i < books.length; i += DISCOVERY_CONCURRENCY) {
                    if (shouldStop() || hasError) break;

                    const batch = books.slice(i, i + DISCOVERY_CONCURRENCY);
                    await Promise.all(batch.map(async (book: any) => {
                        try {
                            const bookId = book.id || book.usfm || book.abbreviation;
                            const chapters = await this.getChapters(versionId, bookId);

                            // Adiciona capítulos na fila
                            chapters.forEach((chap: any) => {
                                const chapId = chap.passage_id || chap.id || chap.usfm;
                                if (chapId) {
                                    queue.push({
                                        bookId: String(bookId),
                                        bookName: book.name || bookId,
                                        chapId: String(chapId)
                                    });
                                }
                            });
                        } catch (e) {
                            console.warn(`[Download] Erro ao listar capítulos de ${book.name}`);
                        }
                    }));
                }
                isDiscovering = false; // Fim da descoberta
            };

            // Roda descoberta e espera download terminar
            await processBooks();
            await Promise.all(downloadWorkers);

            if (shouldStop()) {
                console.log('[Download] Cancelado.');
            } else {
                if (hasError) console.warn('[Download] Concluído com alguns erros parciais.');

                // GERA METADATA FINAL E ROBUSTO (MESMO COM ERROS PARCIAIS)

                console.log('[Download] Gerando Metadata Final...');

                // Converte booksStats para formato compatível (se necessário) ou salva direto
                // Vamos salvar booksStats dentro do metadata para uso futuro
                finalMetadata.booksStats = booksStats;

                // Também atualiza a lista de livros disponível
                finalMetadata.availableBooks = Object.keys(booksStats);

                // Detecta se é NT Only baseado nos livros baixados
                const hasOT = Object.keys(booksStats).some(bid => OLD_TESTAMENT_BOOKS.has(bid));
                if (!hasOT && !finalMetadata.name.includes('(Novo Testamento)')) {
                    finalMetadata.name += ' (Novo Testamento)';
                }

                await LocalBibleManager.saveVersionMetadata(versionId, finalMetadata);

                onProgress('Download Concluído!', 100);
            }

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
