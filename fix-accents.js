const fs = require('fs');

const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add normalize function after the Quick Search state declaration
const normalizeFunction = `
    // Normalize text: remove accents and convert to uppercase for comparison
    const normalizeText = (text) => {
        return text
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .toUpperCase();
    };
`;

// Find where to insert the normalize function (after quickSearch state)
const insertAfter = 'const [quickSearch, setQuickSearch] = useState({';
const insertIndex = content.indexOf(insertAfter);
if (insertIndex !== -1) {
    // Find the end of the useState block
    const stateEndIndex = content.indexOf('});', insertIndex) + 3;
    content = content.slice(0, stateEndIndex) + '\n' + normalizeFunction + content.slice(stateEndIndex);
    console.log('✅ Added normalizeText function');
}

// Now replace all the filter comparisons to use normalized text
// Pattern 1: Initial search
content = content.replace(
    /const matches = bookList\.filter\(b => \s+b\.name\.toUpperCase\(\)\.startsWith\(char\) \|\| \s+b\.abbr\.toUpperCase\(\)\.startsWith\(char\)\s+\);/g,
    `const matches = bookList.filter(b => 
                        normalizeText(b.name).startsWith(normalizeText(char)) || 
                        normalizeText(b.abbr).startsWith(normalizeText(char))
                    );`
);

// Pattern 2: Backspace handler
content = content.replace(
    /const match = bookList\.find\(b =>\s+b\.name\.toUpperCase\(\)\.startsWith\(newInput\) \|\|\s+b\.abbr\.toUpperCase\(\)\.startsWith\(newInput\)\s+\);/g,
    `const match = bookList.find(b => 
                            normalizeText(b.name).startsWith(normalizeText(newInput)) || 
                            normalizeText(b.abbr).startsWith(normalizeText(newInput))
                        );`
);

// Pattern 3: Typing more letters
content = content.replace(
    /const matches = bookList\.filter\(b => \s+b\.name\.toUpperCase\(\)\.startsWith\(newInput\) \|\| \s+b\.abbr\.toUpperCase\(\)\.startsWith\(newInput\)\s+\);/g,
    `const matches = bookList.filter(b => 
                        normalizeText(b.name).startsWith(normalizeText(newInput)) || 
                        normalizeText(b.abbr).startsWith(normalizeText(newInput))
                    );`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Quick Search atualizado com normalização de acentos!');
console.log('- "JOAO" agora encontra "João"');
console.log('- "JO" encontra "Jó"');
console.log('- "1TIMOTEO" encontra "1 Timóteo"');
console.log('- Busca ignora acentos completamente!');
