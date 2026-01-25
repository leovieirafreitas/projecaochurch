'use client';

import { Book } from '@/types/bible';

interface BookNavigatorProps {
    books: Book[];
    selectedBook: Book | null;
    onSelectBook: (book: Book) => void;
}

export default function BookNavigator({ books, selectedBook, onSelectBook }: BookNavigatorProps) {
    const oldTestament = books.filter(book => book.testament === 'OLD');
    const newTestament = books.filter(book => book.testament === 'NEW');

    const BookButton = ({ book }: { book: Book }) => (
        <button
            onClick={() => onSelectBook(book)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${selectedBook?.id === book.id
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                    : 'glass hover:shadow-lg hover:scale-105'
                }`}
        >
            {book.name}
        </button>
    );

    return (
        <div className="space-y-6">
            {oldTestament.length > 0 && (
                <div className="glass-card p-6 animate-slide-up">
                    <h3 className="text-lg font-bold mb-4 gradient-text">Antigo Testamento</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {oldTestament.map(book => (
                            <BookButton key={book.id} book={book} />
                        ))}
                    </div>
                </div>
            )}

            {newTestament.length > 0 && (
                <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <h3 className="text-lg font-bold mb-4 gradient-text">Novo Testamento</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {newTestament.map(book => (
                            <BookButton key={book.id} book={book} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
