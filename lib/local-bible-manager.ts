
const BIBLES_DIR = 'bibles';

// Helper to get Tauri APIs safely from window object
const getTauri = () => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        return (window as any).__TAURI__;
    }
    return null;
};

/**
 * Gerencia o armazenamento local de Bíblias para acesso offline.
 * Estrutura: AppData/bibles/{versionId}/{bookId}/{chapterId}.json
 * Usa window.__TAURI__ para evitar problemas de importação com versões diferentes do Tauri.
 */
export class LocalBibleManager {
    private static cache: Map<string, any> = new Map();

    private static async getDocRoot(tauri: any) {
        // User downloads go to Documents (writable, user-accessible)
        const docDir = await tauri.path.documentDir();
        return await tauri.path.join(docDir, 'CHAMA_ONLINE_BIBLES');
    }

    private static async getResourceRoot(tauri: any) {
        const resDir = await tauri.path.resourceDir();
        const path1 = await tauri.path.join(resDir, 'resources', 'bibles');
        if (await tauri.fs.exists(path1)) return path1;

        const path2 = await tauri.path.join(resDir, 'bibles');
        if (await tauri.fs.exists(path2)) return path2;

        return path1; // Fallback
    }

    private static async getRoot(tauri: any) {
        return this.getDocRoot(tauri);
    }

    /**
     * Helper para logar em arquivo (debug)
     */
    /**
     * Helper para logar em arquivo (debug)
     * PERFORMANCE FIX: Desabilitado log em arquivo pois causa gargalo massivo no download.
     */
    private static async logToFile(message: string) {
        // Log apenas no console para evitar I/O de disco bloqueante durante loops
        // console.log('[LocalBibleManager]', message);
    }


    /**
     * Salva o conteúdo de um capítulo localmente. (SEMPRE NO DOCUMENTOS)
     */
    static async saveChapter(versionId: string, bookId: string, chapterId: string, content: any) {
        const tauri = getTauri();
        if (!tauri) return false;

        try {
            await this.logToFile(`=== SAVE START: ${versionId}/${bookId}/${chapterId} ===`);
            const root = await this.getDocRoot(tauri);
            await this.logToFile(`Root path: ${root}`);
            console.log('[SAVE] Root path:', root);

            // CRITICAL: Ensure root directory exists first
            const rootExists = await tauri.fs.exists(root);
            await this.logToFile(`Root exists: ${rootExists}`);
            if (!rootExists) {
                await this.logToFile(`Creating root...`);
                console.log('[SAVE] Creating root directory:', root);
                try {
                    await tauri.fs.createDir(root, { recursive: true });
                    await this.logToFile(`Root created OK`);
                    console.log('[SAVE] Root created successfully');
                } catch (err: any) {
                    await this.logToFile(`Root create FAILED: ${err.message}`);
                    throw err;
                }
            } else {
                console.log('[SAVE] Root already exists');
            }

            const versionDir = await tauri.path.join(root, versionId);
            const bookDir = await tauri.path.join(versionDir, bookId);
            await this.logToFile(`Version dir: ${versionDir}`);
            await this.logToFile(`Book dir: ${bookDir}`);
            console.log('[SAVE] Version dir:', versionDir);
            console.log('[SAVE] Book dir:', bookDir);

            try {
                const versionExists = await tauri.fs.exists(versionDir);
                await this.logToFile(`Version dir exists: ${versionExists}`);
                if (!versionExists) {
                    await this.logToFile(`Creating version dir...`);
                    console.log('[SAVE] Creating version dir');
                    await tauri.fs.createDir(versionDir, { recursive: true });
                    await this.logToFile(`Version dir created OK`);
                }
            } catch (vErr: any) {
                await this.logToFile(`Version dir create FAILED: ${vErr?.message || JSON.stringify(vErr)}`);
                throw vErr;
            }

            try {
                const bookExists = await tauri.fs.exists(bookDir);
                await this.logToFile(`Book dir exists: ${bookExists}`);
                if (!bookExists) {
                    await this.logToFile(`Creating book dir...`);
                    console.log('[SAVE] Creating book dir');
                    await tauri.fs.createDir(bookDir, { recursive: true });
                    await this.logToFile(`Book dir created OK`);
                }
            } catch (bErr: any) {
                await this.logToFile(`Book dir create FAILED: ${bErr?.message || JSON.stringify(bErr)}`);
                throw bErr;
            }


            const filePath = await tauri.path.join(bookDir, `${chapterId.replace('.', '_')}.json`);
            await this.logToFile(`Writing file: ${filePath}`);
            console.log('[SAVE] Writing file:', filePath);

            try {
                await tauri.fs.writeTextFile(filePath, JSON.stringify(content));
                await this.logToFile(`File write SUCCESS`);
                console.log('[SAVE] SUCCESS!');
            } catch (wErr: any) {
                await this.logToFile(`File write FAILED: ${wErr?.message || JSON.stringify(wErr)}`);
                throw wErr;
            }

            this.cache.set(`${versionId}/${bookId}/${chapterId}`, content);
            await this.logToFile(`=== SAVE SUCCESS ===`);
            return true;
        } catch (e: any) {
            const errorMsg = e?.message || e?.toString() || 'Unknown error';
            const errorStack = e?.stack || 'No stack trace';
            const errorJson = JSON.stringify(e, Object.getOwnPropertyNames(e));

            await this.logToFile(`=== SAVE ERROR ===`);
            await this.logToFile(`Error message: ${errorMsg}`);
            await this.logToFile(`Error stack: ${errorStack}`);
            await this.logToFile(`Error JSON: ${errorJson}`);
            await this.logToFile(`Error type: ${typeof e}`);

            console.error('[SAVE] ERROR:', e);
            console.error('[SAVE] Error message:', errorMsg);
            console.error('[SAVE] Error stack:', errorStack);
            return false;
        }
    }

    /**
     * Tenta obter um capítulo do armazenamento local (Doc ou Resource).
     */
    static async getChapter(versionId: string, bookId: string, chapterId: string) {
        const cacheKey = `${versionId}/${bookId}/${chapterId}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const tauri = getTauri();
        if (!tauri) {
            // WEB/MOBILE FALLBACK
            // 1. TENTA ROTA RELATIVA
            try {
                const res = await fetch(`/api/offline/chapter/${versionId}/${bookId}/${chapterId}`);
                if (res.ok) {
                    const content = await res.json();
                    this.cache.set(cacheKey, content);
                    return content;
                }
            } catch (e) { }

            // 2. FALLBACK 4523 (Dynamic Hostname for Mobile)
            try {
                const hostname = window.location.hostname;
                const res = await fetch(`http://${hostname}:4523/api/offline/chapter/${versionId}/${bookId}/${chapterId}`);
                if (res.ok) {
                    const content = await res.json();
                    this.cache.set(cacheKey, content);
                    return content;
                }
            } catch (e) { }
            return null;
        }

        try {
            const filename = `${chapterId.replace('.', '_')}.json`;

            // 1. Tentar Meus Documentos
            const docRoot = await this.getDocRoot(tauri);
            const docPath = await tauri.path.join(docRoot, versionId, bookId, filename);
            if (await tauri.fs.exists(docPath)) {
                const content = JSON.parse(await tauri.fs.readTextFile(docPath));
                this.cache.set(cacheKey, content);
                return content;
            }

            // 2. Tentar Resources (Bundled)
            const resRoot = await this.getResourceRoot(tauri);
            const resPath = await tauri.path.join(resRoot, versionId, bookId, filename);
            if (await tauri.fs.exists(resPath)) {
                const content = JSON.parse(await tauri.fs.readTextFile(resPath));
                this.cache.set(cacheKey, content);
                return content;
            }

        } catch (e) { }
        return null;
    }

    /**
     * Verifica se existe uma pasta para essa versão (indica download iniciado/parcial).
     */
    static async hasVersion(versionId: string) {
        const tauri = getTauri();
        if (!tauri) {
            const versions = await this.getLocalVersions();
            return versions.some((v: any) => v.id === versionId);
        }
        try {
            const docRoot = await this.getDocRoot(tauri);
            const versionDir = await tauri.path.join(docRoot, versionId);
            if (await tauri.fs.exists(versionDir)) return true;

            const resRoot = await this.getResourceRoot(tauri);
            const resVersionDir = await tauri.path.join(resRoot, versionId);
            return await tauri.fs.exists(resVersionDir);
        } catch (e) { return false; }
    }

    // MAPA DE NOMES para quando estiver totalmente offline/sem metadata
    private static BOOK_NAMES: Record<string, string> = {
        'GEN': 'Gênesis', 'EXO': 'Êxodo', 'LEV': 'Levítico', 'NUM': 'Números', 'DEU': 'Deuteronômio',
        'JOS': 'Josué', 'JDG': 'Juízes', 'RUT': 'Rute', '1SA': '1 Samuel', '2SA': '2 Samuel',
        '1KI': '1 Reis', '2KI': '2 Reis', '1CH': '1 Crônicas', '2CH': '2 Crônicas', 'EZR': 'Esdras',
        'NEH': 'Neemias', 'EST': 'Ester', 'JOB': 'Jó', 'PSA': 'Salmos', 'PRO': 'Provérbios',
        'ECC': 'Eclesiastes', 'SNG': 'Cânticos', 'ISA': 'Isaías', 'JER': 'Jeremias', 'LAM': 'Lamentações',
        'EZK': 'Ezequiel', 'DAN': 'Daniel', 'HOS': 'Oseias', 'JOL': 'Joel', 'AMO': 'Amós',
        'OBA': 'Obadias', 'JON': 'Jonas', 'MIC': 'Miqueias', 'NAM': 'Naum', 'HAB': 'Habacuque',
        'ZEP': 'Sofonias', 'HAG': 'Ageu', 'ZEC': 'Zacarias', 'MAL': 'Malaquias',
        'MAT': 'Mateus', 'MRK': 'Marcos', 'LUK': 'Lucas', 'JHN': 'João', 'ACT': 'Atos',
        'ROM': 'Romanos', '1CO': '1 Coríntios', '2CO': '2 Coríntios', 'GAL': 'Gálatas', 'EPH': 'Efésios',
        'PHP': 'Filipenses', 'COL': 'Colossenses', '1TH': '1 Tessalonicenses', '2TH': '2 Tessalonicenses',
        '1TI': '1 Timóteo', '2TI': '2 Timóteo', 'TIT': 'Tito', 'PHM': 'Filemom', 'HEB': 'Hebreus',
        'JAS': 'Tiago', '1PE': '1 Pedro', '2PE': '2 Pedro', '1JN': '1 João', '2JN': '2 João',
        '3JN': '3 João', 'JUD': 'Judas', 'REV': 'Apocalipse'
    };

    static processBooks(books: string[], ORDER: string[]) {
        return books.map((b: string) => {
            const code = b.toUpperCase();
            return {
                id: code,
                usfm: code,
                abbreviation: code.charAt(0) + code.slice(1).toLowerCase(),
                name: this.BOOK_NAMES[code] || code
            };
        }).sort((a: any, b: any) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    }

    static async getVersionBooks(versionId: string): Promise<any[]> {
        const ORDER = Object.keys(this.BOOK_NAMES);

        const tauri = getTauri();
        if (!tauri) {
            // WEB/MOBILE FALLBACK
            // 1. TENTA ROTA RELATIVA
            try {
                const res = await fetch(`/api/offline/books/${versionId}`);
                if (res.ok) {
                    const books = await res.json();
                    return this.processBooks(books, ORDER);
                }
            } catch (e) { }

            // 2. FALLBACK 4523
            try {
                const hostname = window.location.hostname;
                const res = await fetch(`http://${hostname}:4523/api/offline/books/${versionId}`);
                if (res.ok) {
                    const books = await res.json();
                    return this.processBooks(books, ORDER);
                }
            } catch (e) { }
            return [];
        }

        try {
            let root = await this.getDocRoot(tauri);
            let versionDir = await tauri.path.join(root, versionId);

            // Se não achar em Doc, tenta Res
            if (!(await tauri.fs.exists(versionDir))) {
                root = await this.getResourceRoot(tauri);
                versionDir = await tauri.path.join(root, versionId);
            }

            if (!(await tauri.fs.exists(versionDir))) return [];

            const entries = await tauri.fs.readDir(versionDir);
            const books = [];

            for (const entry of entries) {
                if (entry.children || entry.isDirectory) {
                    const code = entry.name.toUpperCase();
                    if (this.BOOK_NAMES[code]) {
                        books.push({
                            id: code,
                            usfm: code,
                            abbreviation: code.charAt(0) + code.slice(1).toLowerCase(),
                            name: this.BOOK_NAMES[code]
                        });
                    }
                }
            }
            return books.sort((a: any, b: any) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
        } catch (e) { return []; }
    }

    static async getVersionChapters(versionId: string, bookId: string): Promise<any[]> {
        const tauri = getTauri();
        if (!tauri) {
            // WEB/MOBILE FALLBACK
            // 1. TENTA ROTA RELATIVA
            try {
                const res = await fetch(`/api/offline/chapters/${versionId}/${bookId}`);
                if (res.ok) {
                    return await res.json();
                }
            } catch (e) { }

            // 2. FALLBACK 4523
            try {
                const hostname = window.location.hostname;
                const res = await fetch(`http://${hostname}:4523/api/offline/chapters/${versionId}/${bookId}`);
                if (res.ok) {
                    return await res.json();
                }
            } catch (e) { }
            return [];
        }

        try {
            let root = await this.getDocRoot(tauri);
            let bookDir = await tauri.path.join(root, versionId, bookId);

            if (!(await tauri.fs.exists(bookDir))) {
                root = await this.getResourceRoot(tauri);
                bookDir = await tauri.path.join(root, versionId, bookId);
            }
            if (!(await tauri.fs.exists(bookDir))) return [];

            const entries = await tauri.fs.readDir(bookDir);
            const chapters = [];

            for (const entry of entries) {
                const match = entry.name.match(/_(\d+)\.json$/);
                if (match) {
                    const num = parseInt(match[1]);
                    chapters.push({ id: `${bookId}.${num}`, usfm: `${bookId}.${num}`, number: String(num) });
                }
            }
            return chapters.sort((a, b) => parseInt(a.number) - parseInt(b.number));
        } catch (e) { return []; }
    }

    static async listDownloadedVersions(): Promise<{ id: string, source: 'user' | 'system', name?: string, installedName?: string }[]> {
        // Alias for getLocalVersions
        return await this.getLocalVersions();
    }

    static async deleteVersion(versionId: string) {
        // Apenas deleta do DOCroot. Resource é imutável.
        const tauri = getTauri();
        if (!tauri) return false;
        try {
            const root = await this.getDocRoot(tauri);
            const versionDir = await tauri.path.join(root, versionId);
            if (await tauri.fs.exists(versionDir)) {
                await tauri.fs.removeDir(versionDir, { recursive: true });
                // clear cache
                const keys = Array.from(this.cache.keys());
                for (const key of keys) { if (key.startsWith(versionId + '/')) this.cache.delete(key); }
                return true;
            }
        } catch (e) { return false; }
        return false;
    }

    static async getLocalVersions(): Promise<any[]> {
        const tauri = getTauri();
        if (!tauri) {
            // WEB/MOBILE FALLBACK

            // 1. TENTA ROTA RELATIVA (Ideal para Mobile / Produção / IP Remoto / IP:4523)
            try {
                const res = await fetch('/api/offline/versions');
                if (res.ok) {
                    return await res.json();
                }
            } catch (e) {
                // Ignora erro e tenta fallback
            }

            // 2. FALLBACK 4523
            try {
                const hostname = window.location.hostname;
                const apiUrl = `http://${hostname}:4523/api/offline/versions`;
                const res = await fetch(apiUrl, { signal: AbortSignal.timeout(1000) });

                if (res.ok) {
                    return await res.json();
                }
            } catch (e) {
                // Silenciosamente ignora
            }

            return [];
        }

        const versionsMap = new Map<string, any>();

        try {
            // Helper to scan a root
            const scan = async (root: string) => {
                if (!(await tauri.fs.exists(root))) return;
                const entries = await tauri.fs.readDir(root);
                for (const entry of entries) {
                    if (entry.children || entry.isDirectory) {
                        const vid = entry.name;
                        const metaPath = await tauri.path.join(root, vid, 'metadata.json');
                        if (await tauri.fs.exists(metaPath)) {
                            try {
                                const content = await tauri.fs.readTextFile(metaPath);
                                const meta = JSON.parse(content);
                                versionsMap.set(vid, meta);
                            } catch (e) { }
                        } else {
                            if (!versionsMap.has(vid)) {
                                versionsMap.set(vid, {
                                    id: vid, abbreviation: vid, name: vid, local_title: vid,
                                    description: 'Offline Bible', lang: 'local'
                                });
                            }
                        }
                    }
                }
            };

            // Scan Resources FIRST (default)
            await scan(await this.getResourceRoot(tauri));
            // Scan Docs SECOND (overrides/updates)
            await scan(await this.getDocRoot(tauri));

            return Array.from(versionsMap.values());
        } catch (e) { return []; }
    }

    static async getBiblesPath() {
        const tauri = getTauri();
        if (!tauri) return 'Armazenamento Temporário (Web)';
        return await this.getDocRoot(tauri);
    }
    /**
     * Salva o metadata da versão para exibição correta offline.
     */
    static async saveVersionMetadata(versionId: string, meta: any) {
        const tauri = getTauri();
        if (!tauri) return false;
        try {
            const root = await this.getDocRoot(tauri);
            const versionDir = await tauri.path.join(root, versionId);

            if (!(await tauri.fs.exists(versionDir))) {
                await tauri.fs.createDir(versionDir, { recursive: true });
            }

            const metaPath = await tauri.path.join(versionDir, 'metadata.json');
            await tauri.fs.writeTextFile(metaPath, JSON.stringify(meta, null, 2));
            return true;
        } catch (e) {
            console.error('Failed to save metadata', e);
            return false;
        }
    }

    /**
     * Tenta reparar metadados de todas as versões baixadas localmente.
     * Gera estatísticas de livros/capítulos/versículos para versões incompletas.
     */
    static async fixAllMetadata() {
        const tauri = getTauri();
        if (!tauri) return { success: false, msg: 'Tauri not found' };

        try {
            const root = await this.getDocRoot(tauri);
            if (!(await tauri.fs.exists(root))) return { success: true, count: 0 };

            const entries = await tauri.fs.readDir(root);
            let repairedCount = 0;

            for (const entry of entries) {
                if (entry.children || entry.isDirectory) {
                    const vid = entry.name;
                    await this.repairVersionMetadata(tauri, root, vid);
                    repairedCount++;
                }
            }
            return { success: true, count: repairedCount };
        } catch (e: any) {
            console.error('Fix Metadata Error', e);
            return { success: false, msg: e.message };
        }
    }

    private static async repairVersionMetadata(tauri: any, root: string, vid: string) {
        try {
            const versionDir = await tauri.path.join(root, vid);
            const metaPath = await tauri.path.join(versionDir, 'metadata.json');

            let meta: any = {};
            if (await tauri.fs.exists(metaPath)) {
                try {
                    const content = await tauri.fs.readTextFile(metaPath);
                    meta = JSON.parse(content);
                } catch { meta = {}; }
            }

            // Se já tem stats completos, pula (ou força update se parecer antigo?)
            // Vamos forçar update se não tiver 'booksStats'
            if (meta.booksStats && Object.keys(meta.booksStats).length > 0) return;

            console.log(`[Repair] Reparando metadata para ${vid}...`);

            // Escanear diretórios de livros
            const booksStats: any = {};
            const bookEntries = await tauri.fs.readDir(versionDir);

            for (const bEntry of bookEntries) {
                if (bEntry.children || bEntry.isDirectory) {
                    const bid = bEntry.name;
                    if (bid === 'metadata.json' || bid.includes('.')) continue;

                    booksStats[bid] = { chapters: 0, verses: [] };
                    const bookDir = await tauri.path.join(versionDir, bid);

                    // Escanear capítulos
                    const chapEntries = await tauri.fs.readDir(bookDir);
                    for (const cEntry of chapEntries) {
                        if (cEntry.name?.endsWith('.json')) {
                            const chapId = cEntry.name.replace('.json', '');
                            const chapNum = parseInt(chapId.split('.').pop() || '0');

                            if (chapNum > 0) {
                                booksStats[bid].chapters = Math.max(booksStats[bid].chapters, chapNum);

                                // Opcional: Ler arquivo para contar versículos
                                // Para não demorar muito, vamos fazer uma leitura
                                try {
                                    const cPath = await tauri.path.join(bookDir, cEntry.name);
                                    const content = await tauri.fs.readTextFile(cPath);
                                    const json = JSON.parse(content);
                                    const html = json.content || json.data?.content || '';

                                    // Count verses regex
                                    const matches = html.match(/<span[^>]*class="[^"]*(?:label|v|verse-number|versenum)[^"]*"[^>]*>([\d]+)<\/span>/gi);
                                    let vCount = matches ? matches.length : 0;

                                    if (vCount === 0) {
                                        const matches2 = html.match(/data-usfm="[^"]+\.[^"]+\.(\d+)"/gi);
                                        vCount = matches2 ? matches2.length : 0;
                                    }

                                    // Garante array
                                    while (booksStats[bid].verses.length < chapNum) booksStats[bid].verses.push(0);
                                    booksStats[bid].verses[chapNum - 1] = vCount > 0 ? vCount : 50;

                                } catch { }
                            }
                        }
                    }
                }
            }

            meta.booksStats = booksStats;
            meta.availableBooks = Object.keys(booksStats);
            meta.id = vid;

            // Tenta corrigir nome se for numérico
            const { VERSION_FULL_NAMES, OLD_TESTAMENT_BOOKS } = await import('./bible-data');

            if (!meta.name || !isNaN(Number(meta.name))) {
                if (meta.abbreviation) {
                    meta.name = VERSION_FULL_NAMES[meta.abbreviation.toUpperCase()] || meta.abbreviation;
                } else {
                    meta.name = VERSION_FULL_NAMES[vid.toUpperCase()] || vid;
                }
            }

            // Detecta NT
            const hasOT = Object.keys(booksStats).some(bid => OLD_TESTAMENT_BOOKS.has(bid));
            if (!hasOT && meta.name && !meta.name.includes('(Novo Testamento)') && !Object.keys(booksStats).includes('GEN')) {
                meta.name += ' (Novo Testamento)';
            }

            await tauri.fs.writeTextFile(metaPath, JSON.stringify(meta, null, 2));
            console.log(`[Repair] Metadata salvo para ${vid}`);

        } catch (e) {
            console.error(`[Repair] Falha ao reparar ${vid}`, e);
        }
    }
}
