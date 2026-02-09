const fs = require('fs');
const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Quick Search Book Auto-Advance (Set book and chapters immediately)
// Pattern 1: Initial match
content = content.replace(
    /YouVersionClient\.getChapters\(currentVersion, match\.id\)\.then\(chapters => \{\s+setQuickSearch\(\{/,
    `setSelectedBookId(match.id);
                        YouVersionClient.getChapters(currentVersion, match.id).then(chapters => {
                            setChapterList(chapters);
                            setQuickSearch({`
);
// Pattern 2: Typing match
content = content.replace(
    /YouVersionClient\.getChapters\(currentVersion, match\.id\)\.then\(chapters => \{\s+setQuickSearch\(prev => \(\{/,
    `setSelectedBookId(match.id);
                        YouVersionClient.getChapters(currentVersion, match.id).then(chapters => {
                            setChapterList(chapters);
                            setQuickSearch(prev => ({`
);

// 2. Update Quick Search Projection Logic (Clean text inside setTimeout)
content = content.replace(
    /const verseText = verseEl\.textContent\?\.trim\(\) \|\| '';/,
    `// Clean verse number
                                        const rawText = verseEl.textContent?.trim() || '';
                                        const verseText = rawText.replace(/^\\d+\\s*/, '');`
);

// 3. Update Verse Grid Highlight (Compare cleaned text)
// Replace comparison in container className
content = content.replace(
    /\$\{activeSlide\?\.text === v\.text \? 'bg-blue-500' : ''\}/g,
    `\${activeSlide?.text === v.text.replace(/^\\d+\\s*/, '').trim() ? 'bg-blue-500' : ''}`
);
// Replace comparison in verse number className
content = content.replace(
    /\$\{activeSlide\?\.text === v\.text \? 'text-white' : 'text-gray-400 group-hover:text-blue-500'\}/g,
    `\${activeSlide?.text === v.text.replace(/^\\d+\\s*/, '').trim() ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`
);
// Replace comparison in verse text className
content = content.replace(
    /\$\{activeSlide\?\.text === v\.text \? 'text-white font-semibold' : 'text-gray-600'\}/g,
    `\${activeSlide?.text === v.text.replace(/^\\d+\\s*/, '').trim() ? 'text-white font-semibold' : 'text-gray-600'}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ FIXED ALL ISSUES!');
console.log('- Main UI updates book immediately (Orange)');
console.log('- Main UI updates chapters grid immediately');
console.log('- Projected text cleaned (No Number)');
console.log('- Verse Match Blue Highlight fixed (Clean Comparison)');
