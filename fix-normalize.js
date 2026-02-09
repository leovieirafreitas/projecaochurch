const fs = require('fs');

const filePath = 'c:\\Users\\FELIPE BARROSO\\Documents\\CHAMA_ONLINE\\biblia-online\\components\\BibleSearch.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the normalizeText function to also remove spaces
const oldNormalize = `// Normalize text: remove accents and convert to uppercase for comparison
    const normalizeText = (text) => {
        return text
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .toUpperCase();
    };`;

const newNormalize = `// Normalize text: remove accents, spaces, and convert to uppercase for comparison
    const normalizeText = (text) => {
        return text
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/\\s+/g, '')  // Remove all spaces
            .toUpperCase();
    };`;

content = content.replace(oldNormalize, newNormalize);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Normalização atualizada!');
console.log('- Remove acentos: "João" → "JOAO"');
console.log('- Remove espaços: "1 Timóteo" → "1TIMOTEO"');
console.log('- Agora "1T" encontra "1 Timóteo"');
console.log('- "JO" encontra "Jó"');
