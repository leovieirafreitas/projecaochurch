export interface Bible {
  id: string;
  name: string;
  abbreviation: string;
  language: {
    id: string;
    name: string;
  };
  description?: string;
}

export interface Book {
  id: string;
  name: string;
  abbreviation: string;
  testament: 'OLD' | 'NEW';
}

export interface Chapter {
  id: string;
  number: number;
  book_id: string;
}

export interface Verse {
  id: string;
  number: number;
  text: string;
  chapter_id: string;
}

export interface Passage {
  id: string;
  content: string;
  reference: string;
  verses: {
    id: string;
    number: number;
  }[];
}

export interface BibleCollection {
  data: Bible[];
  next_page_token?: string;
}

export interface BookCollection {
  data: Book[];
}

export interface ChapterCollection {
  data: Chapter[];
}

export interface VerseCollection {
  data: Verse[];
}
