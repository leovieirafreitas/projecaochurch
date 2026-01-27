
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

    private static async getRoot(tauri: any) {
        const appData = await tauri.path.appDataDir();
        return await tauri.path.join(appData, BIBLES_DIR);
    }

    /**
     * Salva o conteúdo de um capítulo localmente.
     */
    static async saveChapter(versionId: string, bookId: string, chapterId: string, content: any) {
        const tauri = getTauri();
        if (!tauri) {
            console.warn('[LocalBibleManager] Tauri não detectado. Salvamento local ignorado.');
            return false;
        }

        try {
            const root = await this.getRoot(tauri);
            const versionDir = await tauri.path.join(root, versionId);
            const bookDir = await tauri.path.join(versionDir, bookId);

            // Garantir que diretório existe
            if (!(await tauri.fs.exists(bookDir))) {
                await tauri.fs.createDir(bookDir, { recursive: true });
            }

            const filePath = await tauri.path.join(bookDir, `${chapterId.replace('.', '_')}.json`);
            await tauri.fs.writeTextFile(filePath, JSON.stringify(content));

            // Grava no cache de memória também
            this.cache.set(`${versionId}/${bookId}/${chapterId}`, content);

            return true;
        } catch (e) {
            console.error('Erro ao salvar capitulo local:', e);
            return false;
        }
    }

    /**
     * Tenta obter um capítulo do armazenamento local.
     */
    static async getChapter(versionId: string, bookId: string, chapterId: string) {
        const cacheKey = `${versionId}/${bookId}/${chapterId}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const tauri = getTauri();
        if (!tauri) return null;

        try {
            const root = await this.getRoot(tauri);
            const filePath = await tauri.path.join(root, versionId, bookId, `${chapterId.replace('.', '_')}.json`);

            if (await tauri.fs.exists(filePath)) {
                const contentRaw = await tauri.fs.readTextFile(filePath);
                const content = JSON.parse(contentRaw);
                this.cache.set(cacheKey, content);
                return content;
            }
        } catch (e) {
            // Ignora erro se arquivo não existe
        }
        return null;
    }

    /**
     * Verifica se existe uma pasta para essa versão (indica download iniciado/parcial).
     */
    static async hasVersion(versionId: string) {
        const tauri = getTauri();
        if (!tauri) return false;
        try {
            const root = await this.getRoot(tauri);
            const versionDir = await tauri.path.join(root, versionId);
            return await tauri.fs.exists(versionDir);
        } catch (e) { return false; }
    }

    static async listDownloadedVersions(): Promise<string[]> {
        const tauri = getTauri();
        if (!tauri) return [];
        try {
            const root = await this.getRoot(tauri);
            if (!(await tauri.fs.exists(root))) return [];

            const entries = await tauri.fs.readDir(root);
            return entries
                .filter((e: any) => e.children || e.isDirectory)
                .map((e: any) => e.name)
                .filter((n: string) => n && !n.startsWith('.'));
        } catch (e) {
            console.error('Erro ao listar versoes:', e);
            return [];
        }
    }

    static async deleteVersion(versionId: string) {
        const tauri = getTauri();
        if (!tauri) return false;
        try {
            const root = await this.getRoot(tauri);
            const versionDir = await tauri.path.join(root, versionId);

            if (await tauri.fs.exists(versionDir)) {
                await tauri.fs.removeDir(versionDir, { recursive: true });
                const keys = Array.from(this.cache.keys());
                for (const key of keys) {
                    if (key.startsWith(versionId + '/')) this.cache.delete(key);
                }
                return true;
            }
        } catch (e) { return false; }
        return false;
    }

    static async getBiblesPath() {
        const tauri = getTauri();
        if (!tauri) return 'Armazenamento Temporário (Web)';
        try {
            const root = await this.getRoot(tauri);
            return root;
        } catch (e) { return 'Desconhecido'; }
    }
}
