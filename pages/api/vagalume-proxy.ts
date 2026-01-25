export default async function handler(req: any, res: any) {
    const { q, type, id } = req.query;

    try {
        let url = '';
        let externalRes: any = null;

        // BUSCA
        if (type === 'search') {
            // API.lyrics.ovh/suggest
            url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(q as string)}`;
            externalRes = await fetch(url);
        }
        // LETRA (PRECISA DE ARTISTA E TITULO)
        // O id que vem do front agora vai ser um JSON stringificado com {artist, title} ou um ID que eu gerencie
        // Mas o front manda ID.
        // Vou mudar a logica: O front vai ter que mandar artist e title se for lyrics.ovh
        // Para manter compatibilidade agora, vou hackear: Se type=lyrics, o ID será "Artista|Musica"
        else if (type === 'lyrics') {
            const [artist, title] = (id as string).split('|');

            // Estratégia de Retry Inteligente
            const tryFetch = async (artStr: string, titStr: string) => {
                const u = `https://api.lyrics.ovh/v1/${encodeURIComponent(artStr)}/${encodeURIComponent(titStr)}`;
                console.log(`[PROXY] Tentando: ${u}`);
                return fetch(u);
            };

            // 1. Tenta Exato
            externalRes = await tryFetch(artist, title);

            // 2. Tenta remover parenteses (Ao Vivo)
            if (!externalRes.ok && (title.includes('(') || title.includes('['))) {
                const cleanTitle = title.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
                console.log(`[PROXY] Retry 2 (Sem parenteses): "${cleanTitle}"`);
                externalRes = await tryFetch(artist, cleanTitle);
            }

            // 3. Tenta remover PONTUAÇÃO FINAL (?, !) além dos parenteses
            // Ex: "Quem É Esse?" -> "Quem É Esse"
            if (!externalRes.ok) {
                // Limpa parenteses de novo (caso o passo 2 não tenha rodado por não ter, mas vamos garantir)
                let cleanTitle = title.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
                // Remove pontuação
                if (cleanTitle.match(/[\?\!\.]$/)) {
                    cleanTitle = cleanTitle.replace(/[\?\!\.]+$/, '').trim();
                    console.log(`[PROXY] Retry 3 (Sem pontuação): "${cleanTitle}"`);
                    externalRes = await tryFetch(artist, cleanTitle);
                }
            }

            // 4. Fallback final: Tenta limpar Artista também
            if (!externalRes.ok && artist.includes('(')) {
                const cleanArtist = artist.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
                const cleanTitle = title.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').replace(/[\?\!\.]+$/, '').trim();
                console.log(`[PROXY] Retry 4 (Artista limpo):Artist="${cleanArtist}" Title="${cleanTitle}"`);
                externalRes = await tryFetch(cleanArtist, cleanTitle);
            }
            // 5. Fallback: Remover acentos
            if (!externalRes.ok) {
                const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                // Limpa tudo de novo
                let cleanArtist = artist.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
                let cleanTitle = title.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').replace(/[\?\!\.]+$/, '').trim();

                const noAccentArtist = normalize(cleanArtist);
                const noAccentTitle = normalize(cleanTitle);

                console.log(`[PROXY] Retry 5 (Sem acentos): Artist="${noAccentArtist}" Title="${noAccentTitle}"`);
                externalRes = await tryFetch(noAccentArtist, noAccentTitle);
            }

        } else {
            return res.status(400).json({ error: 'Tipo inválido' });
        }

        if (!externalRes || !externalRes.ok) {
            return res.status(404).json({ error: 'Não encontrado' });
        }

        const data = await externalRes.json();

        // NORMALIZAR RESPOSTA PARA PARECER COM O QUE O FRONT ESPERA (VAGALUME MOCK)
        if (type === 'search') {
            // Converter estrutura do Lyrics.ovh para Vagalume Docs
            const normalizedDocs = data.data.map((item: any) => ({
                id: `${item.artist.name}|${item.title}`, // ID hack
                title: item.title,
                band: item.artist.name
            }));

            res.status(200).json({ response: { docs: normalizedDocs } });
        } else {
            // Normalizar Letra
            // O front espera: { type: 'exact', mus: [{ text: ... }], art: { name: ... } }

            // Lyrics.ovh retorna { lyrics: "..." }
            const [artist, title] = (id as string).split('|');

            const normalizedResp = {
                type: 'exact',
                mus: [{
                    id: id,
                    name: title,
                    text: data.lyrics
                }],
                art: { name: artist }
            };
            res.status(200).json(normalizedResp);
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Falha no proxy Music' });
    }
}
