
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
     * Salva o conteúdo de um capítulo localmente. (SEMPRE NO DOCUMENTOS)
     */
    static async saveChapter(versionId: string, bookId: string, chapterId: string, content: any) {
        const tauri = getTauri();
        if (!tauri) return false;

        try {
            const root = await this.getDocRoot(tauri);
            const versionDir = await tauri.path.join(root, versionId);
            const bookDir = await tauri.path.join(versionDir, bookId);

            if (!(await tauri.fs.exists(versionDir))) await tauri.fs.createDir(versionDir, { recursive: true });
            if (!(await tauri.fs.exists(bookDir))) await tauri.fs.createDir(bookDir, { recursive: true });

            const filePath = await tauri.path.join(bookDir, `${chapterId.replace('.', '_')}.json`);
            await tauri.fs.writeTextFile(filePath, JSON.stringify(content));
            this.cache.set(`${versionId}/${bookId}/${chapterId}`, content);
            return true;
        } catch (e: any) {
            console.error('Erro ao salvar capitulo local:', e);
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
        if (!tauri) return null;

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
        if (!tauri) return false;
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

    static async getVersionBooks(versionId: string): Promise<any[]> {
        const tauri = getTauri();
        if (!tauri) return [];

        const ORDER = Object.keys(this.BOOK_NAMES);

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
        if (!tauri) return [];
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
        const tauri = getTauri();
        if (!tauri) return [];
        const versionsMap = new Map<string, { id: string, source: 'user' | 'system', name?: string, installedName?: string }>();

        try {
            // 1. Scan Resources (System/Bundled)
            try {
                const resRoot = await this.getResourceRoot(tauri);
                if (await tauri.fs.exists(resRoot)) {
                    const entries = await tauri.fs.readDir(resRoot);
                    for (const entry of entries) {
                        if (entry.children || entry.isDirectory) {
                            let name = entry.name;
                            try {
                                const metaPath = await tauri.path.join(resRoot, entry.name, 'metadata.json');
                                if (await tauri.fs.exists(metaPath)) {
                                    const meta = JSON.parse(await tauri.fs.readTextFile(metaPath));
                                    if (meta.name) name = meta.name;
                                }
                            } catch (e) { }
                            versionsMap.set(entry.name, { id: entry.name, source: 'system', name, installedName: name });
                        }
                    }
                }
            } catch (e) { }

            // 2. Scan Documents (User/Downloaded)
            try {
                const docRoot = await this.getDocRoot(tauri);
                if (await tauri.fs.exists(docRoot)) {
                    const entries = await tauri.fs.readDir(docRoot);
                    for (const entry of entries) {
                        if (entry.children || entry.isDirectory) {
                            let name = entry.name;
                            try {
                                const metaPath = await tauri.path.join(docRoot, entry.name, 'metadata.json');
                                if (await tauri.fs.exists(metaPath)) {
                                    const meta = JSON.parse(await tauri.fs.readTextFile(metaPath));
                                    if (meta.name) name = meta.name;
                                }
                            } catch (e) { }
                            // Mark as user
                            versionsMap.set(entry.name, { id: entry.name, source: 'user', name, installedName: name });
                        }
                    }
                }
            } catch (e) { }
        } catch (e) { }

        return Array.from(versionsMap.values()).filter(v => v.id && !v.id.startsWith('.'));
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
        if (!tauri) return [];
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
}
