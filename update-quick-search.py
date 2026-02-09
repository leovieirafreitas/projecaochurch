import re

# Read the file
with open(r'c:\Users\FELIPE BARROSO\Documents\CHAMA_ONLINE\biblia-online\components\BibleSearch.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# First replacement: Initial book search (around line 271-285)
old_pattern_1 = r'''                    // Find matching book
                    const bookList = Object\.entries\(BIBLE_BOOKS_DATA\)\.map\(\(\[id, data\]\) => \(\{ id, \.\.\.data \}\)\);
                    const match = bookList\.find\(b => 
                        b\.name\.toUpperCase\(\)\.startsWith\(char\) \|\| 
                        b\.abbr\.toUpperCase\(\)\.startsWith\(char\)
                    \);
                    setQuickSearch\(\{
                        visible: true,
                        stage: 'book',
                        input: char,
                        matchedBook: match \|\| null,
                        selectedChapter: null,
                        chapterCount: 0,
                        verseCount: 0,
                        error: match \? '' : 'Livro não encontrado'
                    \}\);'''

new_code_1 = '''                    const bookList = Object.entries(BIBLE_BOOKS_DATA).map(([id, data]) => ({ id, ...data }));
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
                    }'''

content = re.sub(old_pattern_1, new_code_1, content, flags=re.MULTILINE)

# Second replacement: Typing more letters (around line 322-330)
old_pattern_2 = r'''                } else if \(e\.key\.length === 1 && /\[a-zA-Z\]/\.test\(e\.key\)\) \{
                    e\.preventDefault\(\);
                    const newInput = quickSearch\.input \+ e\.key\.toUpperCase\(\);
                    const bookList = Object\.entries\(BIBLE_BOOKS_DATA\)\.map\(\(\[id, data\]\) => \(\{ id, \.\.\.data \}\)\);
                    const match = bookList\.find\(b => 
                        b\.name\.toUpperCase\(\)\.startsWith\(newInput\) \|\| 
                        b\.abbr\.toUpperCase\(\)\.startsWith\(newInput\)
                    \);
                    setQuickSearch\(prev => \(\{ \.\.\.prev, input: newInput, matchedBook: match \|\| null, error: match \? '' : 'Livro não encontrado' \}\)\);
                \}'''

new_code_2 = '''                } else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
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
                    }
                }'''

content = re.sub(old_pattern_2, new_code_2, content, flags=re.MULTILINE)

# Also update the initial key check to support numbers
content = content.replace(
    'if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {',
    'if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {',
    1  # Only first occurrence
)

# Write back
with open(r'c:\Users\FELIPE BARROSO\Documents\CHAMA_ONLINE\biblia-online\components\BibleSearch.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Quick Search updated successfully!")
print("- Auto-advance when book is uniquely identified")
print("- Support for numbered books (1 Pedro, 2 Coríntios, etc)")
