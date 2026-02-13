
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

    // Novo Root: Direto na pasta de recursos da instalação (onde ficam as bíblias embutidas)
    // Requer instalação 'currentUser' para ter permissão de escrita.
    private static async getStorageRoot(tauri: any) {
        const resDir = await tauri.path.resourceDir();
        // Tenta caminho padrão 'bibles' dentro de resources
        return await tauri.path.join(resDir, 'bibles');
    }

    // Legado: Meus Documentos (apenas leitura para migração se necessário, mas o foco é unificar)
    private static async getLegacyRoot(tauri: any) {
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
        return this.getStorageRoot(tauri);
    }

    /**
     * Helper para logar em arquivo (debug)
     */
    private static async logToFile(message: string) {
        // console.log('[LocalBibleManager]', message);
    }


    /**
     * Salva o conteúdo de um capítulo localmente. (SEMPRE NO APPDATA AGORA)
     */
    static async saveChapter(versionId: string, bookId: string, chapterId: string, content: any) {
        const tauri = getTauri();
        if (!tauri) return false;

        try {
            await this.logToFile(`=== SAVE START: ${versionId}/${bookId}/${chapterId} ===`);
            const root = await this.getStorageRoot(tauri); // USA APPDATA
            await this.logToFile(`Root path: ${root}`);
            console.log('[SAVE] Root path:', root);

            // CRITICAL: Ensure root directory exists first
            const rootExists = await tauri.fs.exists(root);
            if (!rootExists) {
                try {
                    await tauri.fs.createDir(root, { recursive: true });
                } catch (err: any) {
                    throw err;
                }
            }

            const versionDir = await tauri.path.join(root, versionId);
            const bookDir = await tauri.path.join(versionDir, bookId);

            try {
                if (!(await tauri.fs.exists(versionDir))) {
                    await tauri.fs.createDir(versionDir, { recursive: true });
                }
            } catch (vErr: any) { throw vErr; }

            try {
                if (!(await tauri.fs.exists(bookDir))) {
                    await tauri.fs.createDir(bookDir, { recursive: true });
                }
            } catch (bErr: any) { throw bErr; }

            const filePath = await tauri.path.join(bookDir, `${chapterId.replace('.', '_')}.json`);
            console.log('[SAVE] Writing SECURE file:', filePath);

            try {
                // USA COMANDO DE CRIPTOGRAFIA
                await tauri.invoke('write_file_secure', {
                    path: filePath,
                    content: JSON.stringify(content)
                });
                console.log('[SAVE] SECURE SUCCESS!');
            } catch (wErr: any) {
                console.error('[SAVE] Secure Write Failed', wErr);
                throw wErr;
            }

            this.cache.set(`${versionId}/${bookId}/${chapterId}`, content);
            return true;
        } catch (e: any) {
            console.error('[SAVE] ERROR:', e);
            return false;
        }
    }

    /**
     * Tenta obter um capítulo do armazenamento local (AppData, Doc ou Resource).
     */
    static async getChapter(versionId: string, bookId: string, chapterId: string) {
        const cacheKey = `${versionId}/${bookId}/${chapterId}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const tauri = getTauri();
        if (!tauri) {
            // WEB/MOBILE FALLBACK
            try {
                const res = await fetch(`/api/offline/chapter/${versionId}/${bookId}/${chapterId}`);
                if (res.ok) {
                    const content = await res.json();
                    this.cache.set(cacheKey, content);
                    return content;
                }
            } catch (e) { }

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

            // Helper para tentar ler de um root
            const tryRead = async (root: string) => {
                const docPath = await tauri.path.join(root, versionId, bookId, filename);
                if (await tauri.fs.exists(docPath)) {
                    // USA LEITURA SEGURA (Tenta descriptografar ou ler plano)
                    const contentStr = await tauri.invoke('read_file_secure', { path: docPath }) as string;
                    const content = JSON.parse(contentStr);
                    this.cache.set(cacheKey, content);
                    return content;
                }
                return null;
            };

            // 1. Tentar AppData (Novo Padrão)
            let result = await tryRead(await this.getStorageRoot(tauri));
            if (result) return result;

            // 2. Tentar Meus Documentos (Legado)
            result = await tryRead(await this.getLegacyRoot(tauri));
            if (result) return result;

            // 3. Tentar Resources (Bundled - sempre read_file_secure também, pois main.rs usa isso)
            result = await tryRead(await this.getResourceRoot(tauri));
            if (result) return result;

        } catch (e) { }
        return null;
    }

    /**
     * Faz o download de uma versão completa (Livros e Capítulos).
     * @param versionId ID da versão (ex: ARA, NVI)
     * @param onProgress Callback (0-100)
     */
    static async downloadVersion(versionId: string, onProgress: (prog: number, msg: string) => void) {
        const { YouVersionClient } = await import('./youversion-client');
        try {
            onProgress(0, 'Iniciando...');
            const books = await YouVersionClient.getBooks(versionId);
            if (!books || books.length === 0) throw new Error('Falha ao listar livros');

            await this.saveVersionMetadata(versionId, { id: versionId, date: new Date().toISOString() });

            // Estimate total: 66 books * avg 20 chapters = ~1300
            let totalChapters = 1189;
            let current = 0;

            for (const book of books) {
                const chapters = await YouVersionClient.getChapters(versionId, book.id);
                if (chapters) {
                    for (const chap of chapters) {
                        const chapId = chap.passage_id || chap.id;

                        const content = await YouVersionClient.getPassage(versionId, chapId);
                        if (content) {
                            await this.saveChapter(versionId, book.id, chapId, content);
                        }

                        current++;
                        const pct = Math.min(99, (current / totalChapters) * 100);
                        onProgress(pct, `Baixando ${book.name} ${chapId}`);
                        await new Promise(r => setTimeout(r, 20)); // throttle
                    }
                }
            }
            // Re-index stats
            await this.repairVersionMetadata(getTauri(), await this.getStorageRoot(getTauri()), versionId);

            onProgress(100, 'Concluído!');
            return true;
        } catch (e: any) {
            console.error(e);
            onProgress(0, 'Erro no download');
            return false;
        }
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
            const roots = [
                await this.getStorageRoot(tauri),
                await this.getLegacyRoot(tauri),
                await this.getResourceRoot(tauri)
            ];

            for (const root of roots) {
                const versionDir = await tauri.path.join(root, versionId);
                if (await tauri.fs.exists(versionDir)) return true;
            }
            return false;
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
            try {
                const res = await fetch(`/api/offline/books/${versionId}`);
                if (res.ok) return this.processBooks(await res.json(), ORDER);
            } catch (e) { }
            try {
                const hostname = window.location.hostname;
                const res = await fetch(`http://${hostname}:4523/api/offline/books/${versionId}`);
                if (res.ok) return this.processBooks(await res.json(), ORDER);
            } catch (e) { }
            return [];
        }

        try {
            // Tenta achar em qualquer root
            const roots = [
                await this.getStorageRoot(tauri),
                await this.getLegacyRoot(tauri),
                await this.getResourceRoot(tauri)
            ];

            for (const root of roots) {
                const versionDir = await tauri.path.join(root, versionId);
                if (await tauri.fs.exists(versionDir)) {
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
                    if (books.length > 0) return books.sort((a: any, b: any) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
                }
            }
            return [];
        } catch (e) { return []; }
    }

    static async getVersionChapters(versionId: string, bookId: string): Promise<any[]> {
        const tauri = getTauri();
        if (!tauri) {
            try {
                const res = await fetch(`/api/offline/chapters/${versionId}/${bookId}`);
                if (res.ok) return await res.json();
            } catch (e) { }
            try {
                const hostname = window.location.hostname;
                const res = await fetch(`http://${hostname}:4523/api/offline/chapters/${versionId}/${bookId}`);
                if (res.ok) return await res.json();
            } catch (e) { }
            return [];
        }

        try {
            const roots = [
                await this.getStorageRoot(tauri),
                await this.getLegacyRoot(tauri),
                await this.getResourceRoot(tauri)
            ];

            for (const root of roots) {
                const bookDir = await tauri.path.join(root, versionId, bookId);
                if (await tauri.fs.exists(bookDir)) {
                    const entries = await tauri.fs.readDir(bookDir);
                    const chapters = [];
                    for (const entry of entries) {
                        const match = entry.name.match(/_(\d+)\.json$/);
                        if (match) {
                            const num = parseInt(match[1]);
                            chapters.push({ id: `${bookId}.${num}`, usfm: `${bookId}.${num}`, number: String(num) });
                        }
                    }
                    if (chapters.length > 0) return chapters.sort((a, b) => parseInt(a.number) - parseInt(b.number));
                }
            }
            return [];
        } catch (e) { return []; }
    }

    static async listDownloadedVersions(): Promise<{ id: string, source: 'user' | 'system', name?: string, installedName?: string }[]> {
        return await this.getLocalVersions();
    }

    static async deleteVersion(versionId: string) {
        const tauri = getTauri();
        if (!tauri) return false;
        try {
            // Tenta deletar de ambos (Storage e Legacy)
            let deleted = false;

            const storageRoot = await this.getStorageRoot(tauri);
            const vDir1 = await tauri.path.join(storageRoot, versionId);
            if (await tauri.fs.exists(vDir1)) {
                await tauri.fs.removeDir(vDir1, { recursive: true });
                deleted = true;
            }

            const legacyRoot = await this.getLegacyRoot(tauri);
            const vDir2 = await tauri.path.join(legacyRoot, versionId);
            if (await tauri.fs.exists(vDir2)) {
                await tauri.fs.removeDir(vDir2, { recursive: true });
                deleted = true;
            }

            if (deleted) {
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
            try {
                const res = await fetch('/api/offline/versions');
                if (res.ok) return await res.json();
            } catch (e) { }
            try {
                const hostname = window.location.hostname;
                const res = await fetch(`http://${hostname}:4523/api/offline/versions`, { signal: AbortSignal.timeout(1000) });
                if (res.ok) return await res.json();
            } catch (e) { }
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
                                // SECURE READ
                                const content = await tauri.invoke('read_file_secure', { path: metaPath }) as string;
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

            await scan(await this.getResourceRoot(tauri));
            await scan(await this.getLegacyRoot(tauri)); // Legado sobrescreve Resource
            await scan(await this.getStorageRoot(tauri)); // Storage novo sobrescreve tudo (prioridade)

            return Array.from(versionsMap.values());
        } catch (e) { return []; }
    }

    static async getBiblesPath() {
        const tauri = getTauri();
        if (!tauri) return 'Armazenamento Temporário (Web)';
        return await this.getStorageRoot(tauri);
    }

    static async saveVersionMetadata(versionId: string, meta: any) {
        const tauri = getTauri();
        if (!tauri) return false;
        try {
            const root = await this.getStorageRoot(tauri); // AppData
            const versionDir = await tauri.path.join(root, versionId);

            if (!(await tauri.fs.exists(versionDir))) {
                await tauri.fs.createDir(versionDir, { recursive: true });
            }

            const metaPath = await tauri.path.join(versionDir, 'metadata.json');
            // SECURE WRITE
            await tauri.invoke('write_file_secure', {
                path: metaPath,
                content: JSON.stringify(meta, null, 2)
            });
            return true;
        } catch (e) {
            console.error('Failed to save metadata', e);
            return false;
        }
    }

    static async fixAllMetadata() {
        const tauri = getTauri();
        if (!tauri) return { success: false, msg: 'Tauri not found' };

        try {
            // Fix apenas no StorageRoot e LegacyRoot (Resource é RO)
            let count = 0;

            // 1. Storage
            let root = await this.getStorageRoot(tauri);
            if (await tauri.fs.exists(root)) {
                const entries = await tauri.fs.readDir(root);
                for (const entry of entries) {
                    if (entry.children || entry.isDirectory) {
                        await this.repairVersionMetadata(tauri, root, entry.name);
                        count++;
                    }
                }
            }

            // 2. Legacy (opcional, se quisermos manter metadados atualizados lá também)
            // Mas só reparamos se existir
            root = await this.getLegacyRoot(tauri);
            if (await tauri.fs.exists(root)) {
                const entries = await tauri.fs.readDir(root);
                for (const entry of entries) {
                    if (entry.children || entry.isDirectory) {
                        await this.repairVersionMetadata(tauri, root, entry.name);
                        count++;
                    }
                }
            }

            return { success: true, count };
        } catch (e: any) {
            return { success: false, msg: e.message };
        }
    }

    private static async repairVersionMetadata(tauri: any, root: string, vid: string) {
        // Updated repair logic to use secure read/write
        try {
            const versionDir = await tauri.path.join(root, vid);
            const metaPath = await tauri.path.join(versionDir, 'metadata.json');

            let meta: any = {};
            if (await tauri.fs.exists(metaPath)) {
                try {
                    const content = await tauri.invoke('read_file_secure', { path: metaPath }) as string;
                    meta = JSON.parse(content);
                } catch { meta = {}; }
            }

            if (meta.booksStats && Object.keys(meta.booksStats).length > 0) return;

            console.log(`[Repair] Reparando metadata para ${vid}...`);

            const booksStats: any = {};
            const bookEntries = await tauri.fs.readDir(versionDir);

            for (const bEntry of bookEntries) {
                if (bEntry.children || bEntry.isDirectory) {
                    const bid = bEntry.name;
                    if (bid === 'metadata.json' || bid.includes('.')) continue;

                    booksStats[bid] = { chapters: 0, verses: [] };
                    const bookDir = await tauri.path.join(versionDir, bid);

                    const chapEntries = await tauri.fs.readDir(bookDir);
                    for (const cEntry of chapEntries) {
                        if (cEntry.name?.endsWith('.json')) {
                            const chapId = cEntry.name.replace('.json', '');
                            const chapNum = parseInt(chapId.split('.').pop() || '0');

                            if (chapNum > 0) {
                                booksStats[bid].chapters = Math.max(booksStats[bid].chapters, chapNum);

                                try {
                                    const cPath = await tauri.path.join(bookDir, cEntry.name);
                                    // Secure Read para contar versículos
                                    const content = await tauri.invoke('read_file_secure', { path: cPath }) as string;
                                    const json = JSON.parse(content);
                                    const html = json.content || json.data?.content || '';

                                    const matches = html.match(/<span[^>]*class="[^"]*(?:label|v|verse-number|versenum)[^"]*"[^>]*>([\d]+)<\/span>/gi);
                                    let vCount = matches ? matches.length : 0;
                                    if (vCount === 0) {
                                        const matches2 = html.match(/data-usfm="[^"]+\.[^"]+\.(\d+)"/gi);
                                        vCount = matches2 ? matches2.length : 0;
                                    }

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

            const { VERSION_FULL_NAMES, OLD_TESTAMENT_BOOKS } = await import('./bible-data');

            if (!meta.name || !isNaN(Number(meta.name))) {
                if (meta.abbreviation) {
                    meta.name = VERSION_FULL_NAMES[meta.abbreviation.toUpperCase()] || meta.abbreviation;
                } else {
                    meta.name = VERSION_FULL_NAMES[vid.toUpperCase()] || vid;
                }
            }

            const hasOT = Object.keys(booksStats).some(bid => OLD_TESTAMENT_BOOKS.has(bid));
            if (!hasOT && meta.name && !meta.name.includes('(Novo Testamento)') && !Object.keys(booksStats).includes('GEN')) {
                meta.name += ' (Novo Testamento)';
            }

            // Secure Write
            await tauri.invoke('write_file_secure', {
                path: metaPath,
                content: JSON.stringify(meta, null, 2)
            });
            console.log(`[Repair] Metadata salvo para ${vid}`);

        } catch (e) {
            console.error(`[Repair] Falha ao reparar ${vid}`, e);
        }
    }
}
