'use client';

import { Chapter } from '@/types/bible';

interface ChapterSelectorProps {
    chapters: Chapter[];
    selectedChapter: Chapter | null;
    onSelectChapter: (chapter: Chapter) => void;
    bookName: string;
}

export default function ChapterSelector({
    chapters,
    selectedChapter,
    onSelectChapter,
    bookName
}: ChapterSelectorProps) {
    return (
        <div className="glass-card p-6 animate-slide-up">
            <h3 className="text-lg font-bold mb-4 gradient-text">
                Capítulos de {bookName}
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                {chapters.map((chapter) => (
                    <button
                        key={chapter.id}
                        onClick={() => onSelectChapter(chapter)}
                        className={`aspect-square rounded-lg font-semibold transition-all duration-200 ${selectedChapter?.id === chapter.id
                                ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 scale-110'
                                : 'glass hover:shadow-lg hover:scale-105'
                            }`}
                    >
                        {chapter.number}
                    </button>
                ))}
            </div>
        </div>
    );
}
