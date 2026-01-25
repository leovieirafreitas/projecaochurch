
export interface MusicSearchResult {
    id: string;
    text: string; // Letra completa
    title: string;
    artist: string;
}

export const VagalumeClient = {
    async searchMusic(query: string): Promise<MusicSearchResult[]> {
        // Usa o proxy local para evitar CORS
        try {
            const res = await fetch(`/api/vagalume-proxy?type=search&q=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (!data.response || !data.response.docs) return [];

            const results: MusicSearchResult[] = [];

            for (const doc of data.response.docs) {
                // Filtra para pegar apenas músicas (title e band)
                if (doc.title && doc.band) {
                    results.push({
                        id: doc.id,
                        title: doc.title,
                        artist: doc.band,
                        text: ''
                    });
                }
            }
            return results;
        } catch (e) {
            console.error('Erro na busca Vagalume Proxy:', e);
            return [];
        }
    },

    async getLyrics(id: string): Promise<MusicSearchResult | null> {
        // Usa o proxy local para buscar letra via ID
        try {
            const res = await fetch(`/api/vagalume-proxy?type=lyrics&id=${id}`);
            const data = await res.json();

            if (data.type === 'exact' || data.type === 'aprox') {
                const mus = data.mus[0];
                return {
                    id: mus.id,
                    text: mus.text,
                    title: mus.name,
                    artist: data.art.name
                };
            }
            return null;
        } catch (e) {
            console.error('Erro ao pegar letra via Proxy:', e);
            return null;
        }
    }
};
