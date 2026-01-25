
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'songs_db.json');

export interface Song {
    id: string; // UUID ou ID único
    title: string;
    artist: string;
    text: string;
    createdAt?: number;
}

export const DB = {
    getAll: (): Song[] => {
        if (!fs.existsSync(DB_PATH)) return [];
        try {
            const data = fs.readFileSync(DB_PATH, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            console.error("Erro ao ler DB", e);
            return [];
        }
    },

    save: (song: Song) => {
        const songs = DB.getAll();
        const existingIndex = songs.findIndex(s => s.id === song.id);

        // Adiciona data se não tiver
        const songToSave = {
            ...song,
            createdAt: song.createdAt || Date.now()
        };

        if (existingIndex >= 0) {
            songs[existingIndex] = songToSave; // Update
        } else {
            songs.push(songToSave); // Insert
        }

        fs.writeFileSync(DB_PATH, JSON.stringify(songs, null, 2));
        return songToSave;
    },

    delete: (id: string) => {
        let songs = DB.getAll();
        const initialLen = songs.length;
        songs = songs.filter(s => s.id !== id);
        if (songs.length !== initialLen) {
            fs.writeFileSync(DB_PATH, JSON.stringify(songs, null, 2));
        }
    }
};
