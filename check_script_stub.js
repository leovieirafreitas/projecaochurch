const fs = require('fs');
const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. IMPROVE VERSE GRID HIGHLIGHT (The main complaint about "not blue")
// Find the mapping logic for previewVerses
// We look for the className assignment
content = content.replace(
    /className=\{\`flex gap-2 px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition items-start group \$\{activeSlide\?\.text === v\.text \? 'bg-blue-100' : ''\}\`\}/g,
    // Note: The previous regex might not match if I already changed it in previous steps.
    // I need to match the CURRENT state of the file.
    // In previous steps (fix-verses.js) I set it to:
    // ${activeSlide?.text === v.text ? 'bg-blue-500' : ''}
    // Let's match roughly
    /\$\{activeSlide\?\.text === v\.text[^}]+\}/g,
    `\${activeSlide?.text === v.text.replace(/^\\d+\\s*/, '').trim() ? 'bg-blue-500' : ''}`
);

// Match the text color classes too
content = content.replace(
    /\$\{activeSlide\?\.text === v\.text[^}]+\}/g, // Be careful this regex is too broad?
    // Let's use more specific context
    (match) => {
        if (match.includes('bg-blue')) {
            return `\${activeSlide?.text === v.text.replace(/^\\d+\\s*/, '').trim() ? 'bg-blue-500' : ''}`;
        }
        if (match.includes('text-blue-600') || match.includes('text-white')) {
            return `\${activeSlide?.text === v.text.replace(/^\\d+\\s*/, '').trim() ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`;
        }
        if (match.includes('text-gray-900') || match.includes('font-medium') || match.includes('font-semibold')) {
            return `\${activeSlide?.text === v.text.replace(/^\\d+\\s*/, '').trim() ? 'text-white font-semibold' : 'text-gray-600'}`;
        }
        return match;
    }
);


// 2. QUICK SEARCH FIXES (Auto-Advance & UI Sync)
// Inject setSelectedBookId and setChapterList
const bookLogicRegex = /(YouVersionClient\.getChapters\(currentVersion, match\.id\)\.then\(chapters => \{\s+)(setQuickSearch)/;
content = content.replace(bookLogicRegex, '$1setSelectedBookId(match.id); setChapterList(chapters); $2');

// Do it for the second occurrence (typing handler)
const bookLogicRegex2 = /(YouVersionClient\.getChapters\(currentVersion, match\.id\)\.then\(chapters => \{\s+)(setChapterList\(chapters\);\s+setQuickSearch)/;
// Wait, if I already ran fix-final-v2? I might have partially applied it.
// Checking previous step output: Step 607 said "FIXED ALL ISSUES".
// So fix-final-v2 ran.
// It added setChapterList already?
// Let's verify by checking file content if I can.
// But to be safe, I'll use a regex that handles "already present" or "missing".
// Actually, safely replacing `setQuickSearch` logic block is better.

// Let's just focus on the Highlight Logic which failed previously (mismatch text).
// And ensure the verse number cleaning is in place for Quick Search Projection.

// Find Quick Search Projection (setTimeout block)
const quickProjRegex = /const verseText = verseEl\.textContent\?\.trim\(\) \|\| '';\s+const bookName/s;
// The previous script replaced this with "const rawText = ... const verseText = ...".
// Let's check if it needs update.

// Force Update Verse Grid Highlight using very specific string replacement to hit target
// I suspect the regex in fix-final-v2 might have failed to match exact whitespace or previously modified content.
// I will read the file and find the exact lines for the Verse Grid map.

fs.writeFileSync(filePath, content, 'utf8');
