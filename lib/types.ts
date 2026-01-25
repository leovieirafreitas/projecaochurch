export interface BibleVersion {
    key: string;
    version: string;
    title: string;
    language?: {
        id: string;
        name: string;
    };
}

export interface BibleBook {
    id: string;
    name: string;
    testament: string;
}

export interface BibleVerse {
    reference: string;
    version: string;
    text: string;
    slides: any[];
}
