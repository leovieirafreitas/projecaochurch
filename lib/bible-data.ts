export const BOOK_GROUPS = [
    { type: 'Pentateuco', color: 'bg-zinc-800', books: ['GEN', 'EXO', 'LEV', 'NUM', 'DEU'] },
    { type: 'Históricos', color: 'bg-zinc-800', books: ['JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST'] },
    { type: 'Poéticos', color: 'bg-zinc-800', books: ['JOB', 'PSA', 'PRO', 'ECC', 'SNG'] },
    { type: 'Profetas Maiores', color: 'bg-zinc-800', books: ['ISA', 'JER', 'LAM', 'EZK', 'DAN'] },
    { type: 'Profetas Menores', color: 'bg-zinc-800', books: ['HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'] },
    { type: 'Evangelhos', color: 'bg-zinc-800', books: ['MAT', 'MRK', 'LUK', 'JHN'] },
    { type: 'Histórico NT', color: 'bg-zinc-800', books: ['ACT'] },
    { type: 'Cartas Paulo', color: 'bg-zinc-800', books: ['ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM'] },
    { type: 'Cartas Gerais', color: 'bg-zinc-800', books: ['HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD'] },
    { type: 'Revelação', color: 'bg-zinc-800', books: ['REV'] },
];

export const BIBLE_BOOKS_DATA: Record<string, { name: string, abbr: string, chapters: number }> = {
    'GEN': { name: 'Gênesis', abbr: 'Gn', chapters: 50 }, 'EXO': { name: 'Êxodo', abbr: 'Ex', chapters: 40 }, 'LEV': { name: 'Levítico', abbr: 'Lv', chapters: 27 },
    'NUM': { name: 'Números', abbr: 'Nm', chapters: 36 }, 'DEU': { name: 'Deuteronômio', abbr: 'Dt', chapters: 34 },
    'JOS': { name: 'Josué', abbr: 'Js', chapters: 24 }, 'JDG': { name: 'Juízes', abbr: 'Jz', chapters: 21 }, 'RUT': { name: 'Rute', abbr: 'Rt', chapters: 4 },
    '1SA': { name: '1 Samuel', abbr: '1Sm', chapters: 31 }, '2SA': { name: '2 Samuel', abbr: '2Sm', chapters: 24 },
    '1KI': { name: '1 Reis', abbr: '1Rs', chapters: 22 }, '2KI': { name: '2 Reis', abbr: '2Rs', chapters: 25 },
    '1CH': { name: '1 Crônicas', abbr: '1Cr', chapters: 29 }, '2CH': { name: '2 Crônicas', abbr: '2Cr', chapters: 36 },
    'EZR': { name: 'Esdras', abbr: 'Ed', chapters: 10 }, 'NEH': { name: 'Neemias', abbr: 'Ne', chapters: 13 }, 'EST': { name: 'Ester', abbr: 'Et', chapters: 10 },
    'JOB': { name: 'Jó', abbr: 'Jó', chapters: 42 }, 'PSA': { name: 'Salmos', abbr: 'Sl', chapters: 150 }, 'PRO': { name: 'Provérbios', abbr: 'Pv', chapters: 31 },
    'ECC': { name: 'Eclesiastes', abbr: 'Ec', chapters: 12 }, 'SNG': { name: 'Cânticos', abbr: 'Ct', chapters: 8 },
    'ISA': { name: 'Isaías', abbr: 'Is', chapters: 66 }, 'JER': { name: 'Jeremias', abbr: 'Jr', chapters: 52 }, 'LAM': { name: 'Lamentações', abbr: 'Lm', chapters: 5 },
    'EZK': { name: 'Ezequiel', abbr: 'Ez', chapters: 48 }, 'DAN': { name: 'Daniel', abbr: 'Dn', chapters: 12 },
    'HOS': { name: 'Oseias', abbr: 'Os', chapters: 14 }, 'JOL': { name: 'Joel', abbr: 'Jl', chapters: 3 }, 'AMO': { name: 'Amós', abbr: 'Am', chapters: 9 },
    'OBA': { name: 'Obadias', abbr: 'Ob', chapters: 1 }, 'JON': { name: 'Jonas', abbr: 'Jn', chapters: 4 }, 'MIC': { name: 'Miqueias', abbr: 'Mq', chapters: 7 },
    'NAM': { name: 'Naum', abbr: 'Na', chapters: 3 }, 'HAB': { name: 'Habacuque', abbr: 'Hc', chapters: 3 }, 'ZEP': { name: 'Sofonias', abbr: 'Sf', chapters: 3 },
    'HAG': { name: 'Ageu', abbr: 'Ag', chapters: 2 }, 'ZEC': { name: 'Zacarias', abbr: 'Zc', chapters: 14 }, 'MAL': { name: 'Malaquias', abbr: 'Ml', chapters: 4 },
    'MAT': { name: 'Mateus', abbr: 'Mt', chapters: 28 }, 'MRK': { name: 'Marcos', abbr: 'Mc', chapters: 16 }, 'LUK': { name: 'Lucas', abbr: 'Lc', chapters: 24 }, 'JHN': { name: 'João', abbr: 'Jo', chapters: 21 },
    'ACT': { name: 'Atos', abbr: 'At', chapters: 28 }, 'ROM': { name: 'Romanos', abbr: 'Rm', chapters: 16 },
    '1CO': { name: '1 Coríntios', abbr: '1Co', chapters: 16 }, '2CO': { name: '2 Coríntios', abbr: '2Co', chapters: 13 },
    'GAL': { name: 'Gálatas', abbr: 'Gl', chapters: 6 }, 'EPH': { name: 'Efésios', abbr: 'Ef', chapters: 6 }, 'PHP': { name: 'Filipenses', abbr: 'Fp', chapters: 4 },
    'COL': { name: 'Colossenses', abbr: 'Cl', chapters: 4 }, '1TH': { name: '1 Tessalonicenses', abbr: '1Ts', chapters: 5 }, '2TH': { name: '2 Tessalonicenses', abbr: '2Ts', chapters: 3 },
    '1TI': { name: '1 Timóteo', abbr: '1Tm', chapters: 6 }, '2TI': { name: '2 Timóteo', abbr: '2Tm', chapters: 4 }, 'TIT': { name: 'Tito', abbr: 'Tt', chapters: 3 }, 'PHM': { name: 'Filemom', abbr: 'Fm', chapters: 1 },
    'HEB': { name: 'Hebreus', abbr: 'Hb', chapters: 13 }, 'JAS': { name: 'Tiago', abbr: 'Tg', chapters: 5 },
    '1PE': { name: '1 Pedro', abbr: '1Pe', chapters: 5 }, '2PE': { name: '2 Pedro', abbr: '2Pe', chapters: 3 },
    '1JN': { name: '1 João', abbr: '1Jo', chapters: 5 }, '2JN': { name: '2 João', abbr: '2Jo', chapters: 1 }, '3JN': { name: '3 João', abbr: '3Jo', chapters: 1 },
    'JUD': { name: 'Judas', abbr: 'Jd', chapters: 1 }, 'REV': { name: 'Apocalipse', abbr: 'Ap', chapters: 22 }
};

// Parser Helpers
export const cleanText = (text: string) => text.replace(/\s+/g, ' ').replace(/\[\d+\]/g, '').trim();

export const VERSION_FULL_NAMES: Record<string, string> = {
    'NVI': 'Nova Versão Internacional',
    'NTLH': 'Nova Tradução na Linguagem de Hoje',
    'ARC': 'Almeida Revista e Corrigida',
    'ARA': 'Almeida Revista e Atualizada',
    'NAA': 'Nova Almeida Atualizada',
    'NVT': 'Nova Versão Transformadora',
    'KJA': 'King James Atualizada',
    'KJF': 'King James Fiel',
    'VFL': 'Versão Fácil de Ler',
    'NBV-P': 'Nova Bíblia Viva',
    'OL': 'O Livro',
    'PTNVI': 'Nova Versão Internacional (PT)',
    'ACF': 'Almeida Corrigida Fiel',
    'TB': 'Tradução Brasileira',
    // Mapeamentos para IDs do YouVersion (ex: PORACF, PORARA)
    '129': 'Nova Versão Internacional',
    '211': 'Nova Tradução na Linguagem de Hoje',
    '1608': 'King James Atualizada',
    '4360': 'Nova Versão Internacional (PT)',
    '1967': 'O Livro',
    '160': 'Almeida Revista e Atualizada',
    '212': 'Almeida Revista e Corrigida',
    'PORACF': 'Almeida Corrigida Fiel',
    'PORARA': 'Almeida Revista e Atualizada (Novo Testamento)',
    'PORARC': 'Almeida Revista e Corrigida (Novo Testamento)',
    'PORBBS': 'Bíblia Sagrada (BBS)',
    'JFAA': 'João Ferreira de Almeida Atualizada',
    'AS21': 'Almeida Século 21'
};

export const NT_ONLY_VERSIONS = ['PORARA', 'PORARC'];

export const OLD_TESTAMENT_BOOKS = new Set([
    'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
    '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
    'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
    'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'
]);
