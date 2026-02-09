const fs = require('fs');
const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. SMART ACCENT FILTERING (Initial Trigger)
// Locate the initial match logic
// Pattern: const matches = bookList.filter(b => \n... normalizeText
const initialFilterRegex = /const matches = bookList\.filter\(b => \s+normalizeText\(b\.name\)\.startsWith\(normalizeText\(char\)\) \|\|\s+normalizeText\(b\.abbr\)\.startsWith\(normalizeText\(char\)\)\s+\);/s;

if (initialFilterRegex.test(content)) {
    content = content.replace(
        initialFilterRegex,
        `let matches = bookList.filter(b => 
                        normalizeText(b.name).startsWith(normalizeText(char)) || 
                        normalizeText(b.abbr).startsWith(normalizeText(char))
                    );
                    // SMART FILTER: If user typed accent, refine matches
                    if (/[áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(char)) {
                         matches = matches.filter(b => 
                            b.name.toUpperCase().startsWith(char) || 
                            b.abbr.toUpperCase().startsWith(char)
                         );
                    }`
    );
    console.log('✅ Smart Accent Filtering added to Initial Trigger');
} else {
    // If regex fails (whitespace diff), try string replace of the core part.
    // The previous code is standard. Let's try to match flexible spaces.
    // Or just look for the first occurrence of `const matches = bookList.filter`.
}

// 2. SMART ACCENT FILTERING (Typing Trigger)
// Pattern: const matches = bookList.filter(b => \n... normalizeText(newInput)
const typingFilterRegex = /const matches = bookList\.filter\(b => \s+normalizeText\(b\.name\)\.startsWith\(normalizeText\(newInput\)\) \|\|\s+normalizeText\(b\.abbr\)\.startsWith\(normalizeText\(newInput\)\)\s+\);/s;

if (typingFilterRegex.test(content)) {
    content = content.replace(
        typingFilterRegex,
        `let matches = bookList.filter(b => 
                        normalizeText(b.name).startsWith(normalizeText(newInput)) || 
                        normalizeText(b.abbr).startsWith(normalizeText(newInput))
                    );
                    // SMART FILTER: If user typed accent, refine matches to auto-advance specific books (e.g. "JÓ" vs "Jonas")
                    if (/[áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(newInput)) {
                         matches = matches.filter(b => 
                            b.name.toUpperCase().startsWith(newInput) || 
                            b.abbr.toUpperCase().startsWith(newInput)
                         );
                    }`
    );
    console.log('✅ Smart Accent Filtering added to Typing Logic');
}

fs.writeFileSync(filePath, content, 'utf8');
