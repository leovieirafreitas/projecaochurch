const fs = require('fs');
const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. FIX NUMERIC GRID HIGHLIGHT & BORDERS (Right Column)
const gridMarker = "style={{ gridTemplateColumns: 'repeat(10, 1fr)', gridAutoRows: 'minmax(0, 1fr)' }}>";
const gridIndex = content.indexOf(gridMarker);

if (gridIndex !== -1) {
    // Find the start of the map inside this grid container
    const mapStartIndex = content.indexOf('{previewVerses.map(v => (', gridIndex);

    // Find the closing of the map. It ends with '}))}' or '))}' depending on implementation.
    // In original code (implicit return): '))} '
    const mapEndIndex = content.indexOf('))}', mapStartIndex);

    if (mapStartIndex !== -1 && mapEndIndex !== -1) {
        // Replacement block
        const newMapLogic = `{previewVerses.map(v => {
                                        // FIXED: Numeric Grid Highlight logic & Visual Borders
                                        const bookName = BIBLE_BOOKS_DATA[selectedBookId]?.name || selectedBookId;
                                        const chapNum = selectedChapterId.split('.')[1] || selectedChapterId;
                                        const verseRef = \`\${bookName} \${chapNum}:\${v.num}\`;
                                        const isSelected = activeSlide?.ref === verseRef;
                                        
                                        return (
                                            <button
                                                key={v.num}
                                                onClick={() => projectVerse(v)}
                                                className={\`w-full h-full text-xs font-bold flex items-center justify-center transition-all border border-black/20 \${isSelected ? 'bg-blue-600 text-white shadow-lg z-10 ring-1 ring-white relative' : 'bg-[#333] text-gray-400 hover:bg-[#444] hover:text-white'}\`}
                                                title={v.text}
                                            >
                                                {v.num}
                                            </button>
                                        );
                                    })}`; // Closing with }) instead of ))


        const before = content.substring(0, mapStartIndex);
        const after = content.substring(mapEndIndex + 3); // skip '))}'

        content = before + newMapLogic + after;
        console.log('✅ Numeric Grid (Right) Highlight logic updated to Ref Match');
        console.log('✅ Numeric Grid (Right) Borders added');
    } else {
        console.log('❌ Could not find Numeric Grid map bounds');
        // Fallback: try regex replacement if exact string match fails (e.g. whitespace differences)
    }
} else {
    console.log('❌ Could not find Numeric Grid container');
}

// 2. FIX CHAPTER GRID BORDERS (Consistency)
// Look for chapter grid button class
const chapRegex = /className=\{\`w-full h-full text-xs font-bold flex items-center justify-center transition-all \$\{isSelected/g;
if (chapRegex.test(content)) {
    content = content.replace(
        chapRegex,
        `className={\`w-full h-full text-xs font-bold flex items-center justify-center transition-all border border-black/20 \${isSelected`
    );
    console.log('✅ Chapter Grid Borders added');
}

fs.writeFileSync(filePath, content, 'utf8');
