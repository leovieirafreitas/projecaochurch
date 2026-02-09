const fs = require('fs');
const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. FIX BOOK GRID BORDERS (Visual Bug "Tudo junto")
// Find the button class definition in the Book Grid loop
// Previous: className={`${group.color} text-white w-full h-full flex flex-col...`}
// We add `border-r border-b border-black/10` to simulate grid lines better, or `gap` fix.
// Actually, `gap-[1px]` with `bg-zinc-700` creates lines. If buttons are `w-full`, they fill the cell.
// Maybe `ring` or `border` inside the button helps distinctness.
content = content.replace(
    /className=\{\`\$\{group\.color\} text-white w-full h-full flex flex-col/g,
    `className={\`\${group.color} text-white w-full h-full flex flex-col border border-black/20`
);

// 2. VERIFY AND RE-APPLY VERSE HIGHLIGHT LOGIC (If missing)
// I'll search for the clean regex logic I added previously.
// If it's there, I'll replace it with the Ref Match logic which is superior.
if (content.includes('v.text.replace(/^\\d+\\s*/')) {
    // Current logic uses text replacement. Let's switch to REF Match.
    // We need to match the whole Map block again.
    const startMarker = '{previewVerses.length > 0 ? (';
    const endMarker = ') : (';
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker, startIndex);

    if (startIndex !== -1) {
        const newContent = `
                            previewVerses.map(v => {
                                // FIXED: Compare by Reference (Attempt 2)
                                const bookObj = BIBLE_BOOKS_DATA[selectedBookId];
                                const bookName = bookObj ? bookObj.name : selectedBookId;
                                const chapNum = selectedChapterId.includes('.') ? selectedChapterId.split('.')[1] : selectedChapterId;
                                const verseRef = \`\${bookName} \${chapNum}:\${v.num}\`;
                                // Robust comparison: Check exact ref OR suffix match (fallback for edge cases)
                                const isSelected = activeSlide?.ref === verseRef || (activeSlide?.ref && activeSlide.ref.endsWith(\`:\${v.num}\`) && activeSlide.ref.includes(bookName));
                                
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
        // Replace carefully
        const before = content.substring(0, startIndex + startMarker.length);
        const after = content.substring(endIndex);
        content = before + newContent + after;
        console.log('✅ Re-applied Verse Highlight using Robust Reference Match');
    }
}

// 3. FIX PROJECTION TEXT WRAPPING (Layout Bug)
// In PreviewContent component
content = content.replace(
    /whiteSpace: 'pre-wrap',/g,
    `whiteSpace: 'pre-wrap', wordBreak: 'break-word', hyphens: 'auto',`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Borders added to Books Grid');
console.log('✅ Projection text wrapping improved');
