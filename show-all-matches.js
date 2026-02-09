const fs = require('fs');

const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update state to include allMatches
const oldState = `const [quickSearch, setQuickSearch] = useState({
        visible: false,
        stage: 'book' as 'book' | 'chapter' | 'verse',
        input: '',
        matchedBook: null as { id: string, name: string, abbr: string } | null,
        selectedChapter: null as number | null,
        chapterCount: 0,
        verseCount: 0,
        error: ''
    });`;

const newState = `const [quickSearch, setQuickSearch] = useState({
        visible: false,
        stage: 'book' as 'book' | 'chapter' | 'verse',
        input: '',
        matchedBook: null as { id: string, name: string, abbr: string } | null,
        allMatches: [] as { id: string, name: string, abbr: string }[],
        selectedChapter: null as number | null,
        chapterCount: 0,
        verseCount: 0,
        error: ''
    });`;

content = content.replace(oldState, newState);

// 2. Update initial search to store all matches
content = content.replace(
    /setQuickSearch\(\{\s+visible: true,\s+stage: 'book',\s+input: char,\s+matchedBook: matches\[0\] \|\| null,\s+selectedChapter: null,\s+chapterCount: 0,\s+verseCount: 0,\s+error: matches\.length === 0 \? 'Livro não encontrado' : ''\s+\}\);/,
    `setQuickSearch({
                            visible: true,
                            stage: 'book',
                            input: char,
                            matchedBook: matches[0] || null,
                            allMatches: matches,
                            selectedChapter: null,
                            chapterCount: 0,
                            verseCount: 0,
                            error: matches.length === 0 ? 'Livro não encontrado' : ''
                        });`
);

// 3. Update typing handler to store all matches
content = content.replace(
    /setQuickSearch\(prev => \(\{ \s+\.\.\.prev, \s+input: newInput, \s+matchedBook: matches\[0\] \|\| null, \s+error: matches\.length === 0 \? 'Livro não encontrado' : '' \s+\}\)\);/g,
    `setQuickSearch(prev => ({ 
                            ...prev, 
                            input: newInput, 
                            matchedBook: matches[0] || null,
                            allMatches: matches,
                            error: matches.length === 0 ? 'Livro não encontrado' : '' 
                        }));`
);

// 4. Update modal display to show all matches
const oldBookDisplay = `{/* Book Stage */}
                                {quickSearch.stage === 'book' && (
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '18px', color: '#666', marginBottom: '12px', fontWeight: '600' }}>
                                            Livro
                                        </div>
                                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#000', marginBottom: '8px' }}>
                                            {quickSearch.matchedBook?.name || '...'}
                                        </div>
                                        {quickSearch.error && (
                                            <div style={{ fontSize: '14px', color: '#dc2626', marginTop: '12px' }}>
                                                {quickSearch.error}
                                            </div>
                                        )}
                                    </div>
                                )}`;

const newBookDisplay = `{/* Book Stage */}
                                {quickSearch.stage === 'book' && (
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '18px', color: '#666', marginBottom: '12px', fontWeight: '600' }}>
                                            Livro
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#999', marginBottom: '16px' }}>
                                            {quickSearch.input || '_'}
                                        </div>
                                        {quickSearch.allMatches.length > 0 ? (
                                            <div style={{ fontSize: '20px', color: '#666', marginBottom: '12px' }}>
                                                {quickSearch.allMatches.map((book, idx) => (
                                                    <div key={book.id} style={{ 
                                                        fontSize: idx === 0 ? '36px' : '24px',
                                                        fontWeight: idx === 0 ? 'bold' : 'normal',
                                                        color: idx === 0 ? '#000' : '#999',
                                                        marginBottom: '8px'
                                                    }}>
                                                        {book.name}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ccc' }}>
                                                ...
                                            </div>
                                        )}
                                        {quickSearch.error && (
                                            <div style={{ fontSize: '14px', color: '#dc2626', marginTop: '12px' }}>
                                                {quickSearch.error}
                                            </div>
                                        )}
                                    </div>
                                )}`;

content = content.replace(oldBookDisplay, newBookDisplay);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Quick Search atualizado!');
console.log('- Mostra TODAS as opções de livros');
console.log('- Primeira opção em destaque');
console.log('- Digite "JO" e veja: Josué, Joel, Jonas, João, Jó');
