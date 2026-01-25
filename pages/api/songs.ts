
import type { NextApiRequest, NextApiResponse } from 'next';
import { DB, Song } from '../../lib/db';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method === 'GET') {
            const songs = DB.getAll();
            // Ordenar alfabeticamente
            songs.sort((a, b) => a.title.localeCompare(b.title));
            res.status(200).json(songs);
        }
        else if (req.method === 'POST') {
            const song = req.body as Song;
            if (!song.title || !song.text) return res.status(400).json({ error: 'Dados inválidos' });

            // Se não tiver ID (nova criação), gera um
            if (!song.id) song.id = Date.now().toString();

            const saved = DB.save(song);
            res.status(200).json(saved);
        }
        else if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'ID necessário' });
            DB.delete(id as string);
            res.status(200).json({ success: true });
        }
        else {
            res.status(405).end();
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
