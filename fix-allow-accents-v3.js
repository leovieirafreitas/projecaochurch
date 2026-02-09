const fs = require('fs');
const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Allow accents in regex
const accentRegex = "/[a-zA-Z0-9áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/";

// Pattern 1: Initial trigger (around line 276)
content = content.replace(
    /if \(e\.key\.length === 1 && \/\[a-zA-Z0-9\]\/\.test\(e\.key\)\) \{/,
    `if (e.key.length === 1 && ${accentRegex}.test(e.key)) {`
);

// Pattern 2: Typing in Book Stage (around line 351)
content = content.replace(
    /\} else if \(e\.key\.length === 1 && \/\[a-zA-Z0-9\]\/\.test\(e\.key\)\) \{/,
    `} else if (e.key.length === 1 && ${accentRegex}.test(e.key)) {`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Updated Quick Search to allow accented characters!');
console.log('- Now accepts "á", "é", "ó", etc.');
