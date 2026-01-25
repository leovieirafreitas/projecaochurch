'use client';

import { Passage } from '@/types/bible';

interface PassageViewerProps {
    passage: Passage | null;
    loading?: boolean;
}

export default function PassageViewer({ passage, loading }: PassageViewerProps) {
    if (loading) {
        return (
            <div className="glass-card p-8 animate-pulse">
                <div className="space-y-4">
                    <div className="h-6 bg-purple-200 dark:bg-purple-900/30 rounded w-1/3"></div>
                    <div className="space-y-3">
                        <div className="h-4 bg-purple-100 dark:bg-purple-900/20 rounded"></div>
                        <div className="h-4 bg-purple-100 dark:bg-purple-900/20 rounded"></div>
                        <div className="h-4 bg-purple-100 dark:bg-purple-900/20 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!passage) {
        return (
            <div className="glass-card p-12 text-center animate-fade-in">
                <svg className="w-20 h-20 mx-auto mb-4 text-purple-300 dark:text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-muted-foreground text-lg">
                    Selecione uma versão, livro e capítulo para começar a leitura
                </p>
            </div>
        );
    }

    // Processar o conteúdo para adicionar números de versículos
    const formatContent = (content: string, verses: { id: string; number: number }[]) => {
        // Dividir o conteúdo em parágrafos
        const paragraphs = content.split('\n\n');

        return paragraphs.map((paragraph, pIndex) => {
            if (!paragraph.trim()) return null;

            return (
                <p key={pIndex} className="mb-6 leading-relaxed text-lg">
                    {paragraph.split('\n').map((line, lIndex) => (
                        <span key={lIndex}>
                            {line}
                            {lIndex < paragraph.split('\n').length - 1 && <br />}
                        </span>
                    ))}
                </p>
            );
        });
    };

    return (
        <div className="glass-card p-8 animate-slide-up">
            <div className="mb-6 pb-4 border-b border-purple-200 dark:border-purple-800">
                <h2 className="text-2xl font-bold gradient-text">{passage.reference}</h2>
            </div>

            <div className="prose prose-lg dark:prose-invert max-w-none">
                {formatContent(passage.content, passage.verses)}
            </div>

            {/* Botões de ação */}
            <div className="mt-8 pt-6 border-t border-purple-200 dark:border-purple-800 flex gap-3 flex-wrap">
                <button
                    onClick={() => navigator.clipboard.writeText(`${passage.reference}\n\n${passage.content}`)}
                    className="glass px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar
                </button>

                <button
                    onClick={() => {
                        const shareData = {
                            title: passage.reference,
                            text: passage.content,
                        };
                        if (navigator.share) {
                            navigator.share(shareData);
                        }
                    }}
                    className="glass px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Compartilhar
                </button>
            </div>
        </div>
    );
}
