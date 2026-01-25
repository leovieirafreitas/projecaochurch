'use client';

import { Bible } from '@/types/bible';
import { useState } from 'react';

interface BibleSelectorProps {
    bibles: Bible[];
    selectedBible: Bible | null;
    onSelectBible: (bible: Bible) => void;
}

export default function BibleSelector({ bibles, selectedBible, onSelectBible }: BibleSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredBibles = bibles.filter(bible =>
        bible.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bible.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="glass-card px-6 py-3 flex items-center gap-3 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105"
            >
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <div className="text-left">
                    <div className="text-xs text-muted-foreground">Versão</div>
                    <div className="font-semibold text-sm">
                        {selectedBible ? selectedBible.abbreviation : 'Selecione uma versão'}
                    </div>
                </div>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full mt-2 w-80 glass-card p-4 z-50 animate-scale-in max-h-96 overflow-hidden flex flex-col">
                        <input
                            type="text"
                            placeholder="Buscar versão..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-purple-200 dark:border-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
                        />
                        <div className="overflow-y-auto flex-1 space-y-1">
                            {filteredBibles.map((bible) => (
                                <button
                                    key={bible.id}
                                    onClick={() => {
                                        onSelectBible(bible);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${selectedBible?.id === bible.id
                                            ? 'bg-purple-500 text-white shadow-lg'
                                            : 'hover:bg-purple-100 dark:hover:bg-purple-900/30'
                                        }`}
                                >
                                    <div className="font-semibold text-sm">{bible.abbreviation}</div>
                                    <div className="text-xs opacity-80">{bible.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
