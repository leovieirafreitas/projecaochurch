const fs = require('fs');
const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE VERSE HIGHLIGHT LOGIC TO USE REFERENCE MATCH
const startMarker = '{previewVerses.length > 0 ? (';
const endMarker = ') : (';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex + startMarker.length);
    const after = content.substring(endIndex);

    const newContent = `
                            previewVerses.map(v => {
                                // FIXED: Compare by Reference matches EXACTLY (e.g. "Mateus 28:20")
                                const bookName = BIBLE_BOOKS_DATA[selectedBookId]?.name || selectedBookId;
                                const chapNum = selectedChapterId.split('.')[1] || selectedChapterId;
                                const verseRef = \`\${bookName} \${chapNum}:\${v.num}\`;
                                const isSelected = activeSlide?.ref === verseRef;
                                
                                return (
                                    <div
                                        key={v.num}
                                        onClick={() => projectVerse(v)}
                                        className={\`flex gap-2 px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition items-start group \${isSelected ? 'bg-blue-500' : ''}\`}
                                    >
                                        <span className={\`text-xs font-bold w-6 pt-0.5 text-right shrink-0 \${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}\`}>{v.num}</span>
                                        <p className={\`text-sm leading-snug \${isSelected ? 'text-white font-semibold' : 'text-gray-600'}\`}>{v.text}</p>
                                    </div>
                                );
                            })
                        `;

    content = before + newContent + after;
    console.log('✅ Verse Highlight logic updated to Ref Match');
} else {
    console.log('❌ Could not find map block');
}

// 2. ENSURE QUICK SEARCH PROJECTS CLEAN TEXT
// Check if we need to update the projection logic in Quick Search (legacy or partially updated)
if (content.includes("const verseText = verseEl.textContent?.trim() || '';")) {
    content = content.replace(
        "const verseText = verseEl.textContent?.trim() || '';",
        `// Clean number
                                        const rawText = verseEl.textContent?.trim() || '';
                                        const verseText = rawText.replace(/^\\d+\\s*/, '');`
    );
    console.log('✅ Quick Search projection text cleaned');
}

// 3. ENSURE UI UPDATES (Set Selected Book)
// Verify if setSelectedBookId is called in Quick Search
if (!content.includes('setSelectedBookId(match.id);') && content.includes('YouVersionClient.getChapters(currentVersion, match.id)')) {
    content = content.replace(
        /YouVersionClient\.getChapters\(currentVersion, match\.id\)\.then\(chapters => \{\s+setQuickSearch/g,
        `setSelectedBookId(match.id);
                        YouVersionClient.getChapters(currentVersion, match.id).then(chapters => {
                            setChapterList(chapters);
                            setQuickSearch`
    );
    console.log('✅ Quick Search UI update (Orange) added');
}

fs.writeFileSync(filePath, content, 'utf8');
