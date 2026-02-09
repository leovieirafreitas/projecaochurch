
/**
 * Utilitário para lidar com armazenamento de imagens grandes (ex: backgrounds)
 * usando IndexedDB, contornando o limite de 5MB do LocalStorage.
 */

const DB_NAME = 'ProjectionChurchDB';
const STORE_NAME = 'Backgrounds';
const THEMES_STORE = 'Themes';
const DB_VERSION = 2; // Version bumped for new store

export const StorageHelper = {
    async initDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
                if (!db.objectStoreNames.contains(THEMES_STORE)) {
                    db.createObjectStore(THEMES_STORE);
                }
            };
        });
    },

    async setBackground(storageKey: string, data: string | null): Promise<void> {
        if (!data) {
            await this.removeBackground(storageKey);
            return;
        }

        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data, storageKey);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async getBackground(storageKey: string): Promise<string | null> {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(storageKey);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || 'Erro ao carregar do IndexedDB');
        });
    },

    async removeBackground(storageKey: string): Promise<void> {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(storageKey);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // --- TEMAS (User Themes) ---
    async saveUserThemes(themes: any[]): Promise<void> {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([THEMES_STORE], 'readwrite');
            const store = transaction.objectStore(THEMES_STORE);
            const request = store.put(themes, 'user_themes_list');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || 'Erro ao salvar temas');
        });
    },

    async getUserThemes(): Promise<any[]> {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([THEMES_STORE], 'readonly');
            const store = transaction.objectStore(THEMES_STORE);
            const request = store.get('user_themes_list');
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error || 'Erro ao carregar temas');
        });
    }
};
