const fs = require('fs');

const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace 1: Change first find to filter with auto-advance
content = content.replace(
    /\/\/ Find matching book\s+const bookList = Object\.entries\(BIBLE_BOOKS_DATA\)\.map\(\(\[id, data\]\) => \(\{ id, \.\.\.data \}\)\);\s+const match = bookList\.find\(b =>\s+b\.name\.toUpperCase\(\)\.startsWith\(char\) \|\|\s+b\.abbr\.toUpperCase\(\)\.startsWith\(char\)\s+\);\s+setQuickSearch\(\{\s+visible: true,\s+stage: 'book',\s+input: char,\s+matchedBook: match \|\| null,\s+selectedChapter: null,\s+chapterCount: 0,\s+verseCount: 0,\s+error: match \? '' : 'Livro não encontrado'\s+\}\);/,
    `const bookList = Object.entries(BIBLE_BOOKS_DATA).map(([id, data]) => ({ id, ...data }));
                    const matches = bookList.filter(b => 
                        b.name.toUpperCase().startsWith(char) || 
                        b.abbr.toUpperCase().startsWith(char)
                    );
                    
                    if (matches.length === 1) {
                        const match = matches[0];
                        YouVersionClient.getChapters(currentVersion, match.id).then(chapters => {
                            setQuickSearch({
                                visible: true,
                                stage: 'chapter',
                                input: '',
                                matchedBook: match,
                                selectedChapter: null,
                                chapterCount: chapters.length,
                                verseCount: 0,
                                error: ''
                            });
                        });
                    } else {
                        setQuickSearch({
                            visible: true,
                            stage: 'book',
                            input: char,
                            matchedBook: matches[0] || null,
                            selectedChapter: null,
                            chapterCount: 0,
                            verseCount: 0,
                            error: matches.length === 0 ? 'Livro não encontrado' : ''
                        });
                    }`
);

// Replace 2: Support numbers and auto-advance on typing
content = content.replace(
    /} else if \(e\.key\.length === 1 && \/\[a-zA-Z\]\/\.test\(e\.key\)\) \{\s+e\.preventDefault\(\);\s+const newInput = quickSearch\.input \+ e\.key\.toUpperCase\(\);\s+const bookList = Object\.entries\(BIBLE_BOOKS_DATA\)\.map\(\(\[id, data\]\) => \(\{ id, \.\.\.data \}\)\);\s+const match = bookList\.find\(b =>\s+b\.name\.toUpperCase\(\)\.startsWith\(newInput\) \|\|\s+b\.abbr\.toUpperCase\(\)\.startsWith\(newInput\)\s+\);\s+setQuickSearch\(prev => \(\{ \.\.\.prev, input: newInput, matchedBook: match \|\| null, error: match \? '' : 'Livro não encontrado' \}\)\);/,
    `} else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
                    e.preventDefault();
                    const newInput = quickSearch.input + e.key.toUpperCase();
                    const bookList = Object.entries(BIBLE_BOOKS_DATA).map(([id, data]) => ({ id, ...data }));
                    const matches = bookList.filter(b => 
                        b.name.toUpperCase().startsWith(newInput) || 
                        b.abbr.toUpperCase().startsWith(newInput)
                    );
                    
                    if (matches.length === 1) {
                        const match = matches[0];
                        YouVersionClient.getChapters(currentVersion, match.id).then(chapters => {
                            setQuickSearch(prev => ({
                                ...prev,
                                stage: 'chapter',
                                input: '',
                                matchedBook: match,
                                chapterCount: chapters.length,
                                error: ''
                            }));
                        });
                    } else {
                        setQuickSearch(prev => ({ 
                            ...prev, 
                            input: newInput, 
                            matchedBook: matches[0] || null, 
                            error: matches.length === 0 ? 'Livro não encontrado' : '' 
                        }));
                    }`
);

// Also support numbers in initial trigger
let firstOccurrence = true;
content = content.replace(/if \(e\.key\.length === 1 && \/\[a-zA-Z\]\/\.test\(e\.key\)\) \{/g, (match) => {
    if (firstOccurrence) {
        firstOccurrence = false;
        return 'if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {';
    }
    return match;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Quick Search updated!');
console.log('- Auto-advance when unique match');
console.log('- Support for numbered books (1, 2, 3)');
