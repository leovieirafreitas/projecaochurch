const fs = require('fs');
const path = require('path');

const baseDocsDir = 'c:\\Users\\03738917250\\Documents';
const projDir = path.join(baseDocsDir, 'ProjecaoChurch');
const bibliasDir = path.join(projDir, 'BIBLIAS', 'biblias');
const outputBaseDir = path.join(baseDocsDir, 'CHAMA_ONLINE_BIBLES');
const prefFile = path.join(bibliasDir, 'BibleData.proPref');

if (!fs.existsSync(outputBaseDir)) {
    fs.mkdirSync(outputBaseDir, { recursive: true });
}

function parseBibleDataPref(prefPath) {
    const bibles = {};
    try {
        if (fs.existsSync(prefPath)) {
            const content = fs.readFileSync(prefPath, 'utf8');
            const match = content.match(/InstalledBiblesNew=\[(.*?)\];/s);
            if (match && match[1]) {
                const itemsStr = match[1];
                const itemRegex = /"([^"]*)"/g;
                let itemMatch;
                while ((itemMatch = itemRegex.exec(itemsStr)) !== null) {
                    const parts = itemMatch[1].split('|');
                    if (parts.length >= 3) {
                        bibles[parts[0]] = { abbr: parts[1], name: parts[2] };
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error parsing Prefs:', e);
    }
    return bibles;
}

function parseMetadataXml(metadataPath) {
    const bookMap = {};
    try {
        const content = fs.readFileSync(metadataPath, 'utf8');
        const tagRegex = /<content\s+([^>]*)\/>/g;
        let match;
        while ((match = tagRegex.exec(content)) !== null) {
            const attrs = match[1];
            const srcMatch = attrs.match(/src="([^"]*)"/);
            const roleMatch = attrs.match(/role="([^"]*)"/);
            if (srcMatch && roleMatch) {
                bookMap[roleMatch[1]] = srcMatch[1];
            }
        }
    } catch (e) {
        console.error(`Error parsing metadata ${metadataPath}:`, e);
    }
    return bookMap;
}

function parseUsx(usxPath) {
    const chapters = {};
    try {
        const content = fs.readFileSync(usxPath, 'utf8');
        const tokens = content.split(/(<[^>]+>)/);
        let currentChap = null;
        let currentVerseNum = null;
        let currentVerseText = [];

        function flushVerse() {
            if (currentChap && currentVerseNum) {
                if (!chapters[currentChap]) chapters[currentChap] = [];
                const text = currentVerseText.join('').replace(/\s+/g, ' ').trim();
                // Filter out headers/titles if they got mixed in? usx usually separates them.
                if (text) chapters[currentChap].push({ number: currentVerseNum, text });
            }
            currentVerseText = [];
        }

        for (const token of tokens) {
            if (token.startsWith('<')) {
                if (token.startsWith('<chapter')) {
                    flushVerse();
                    const numMatch = token.match(/number="(\d+)"/);
                    if (numMatch) {
                        currentChap = numMatch[1];
                        currentVerseNum = null;
                    }
                } else if (token.startsWith('<verse')) {
                    flushVerse();
                    const numMatch = token.match(/number="(\d+)"/);
                    if (numMatch) {
                        currentVerseNum = numMatch[1];
                    }
                } else if (token.startsWith('<para')) {
                    if (currentVerseText.length > 0) currentVerseText.push(' ');
                }
            } else {
                if (currentChap && currentVerseNum) {
                    currentVerseText.push(token);
                }
            }
        }
        flushVerse();
    } catch (e) { }
    return chapters;
}

function generateHtml(verses, bookId, chapNum) {
    let html = '<div class="yv-content">';
    verses.forEach(v => {
        const passageId = `${bookId}.${chapNum}.${v.number}`;
        html += `<span class="verse" data-usfm="${passageId}">`;
        html += `<span class="label">${v.number}</span>`;
        html += `<span class="content"> ${v.text} </span>`;
        html += `</span> `;
    });
    html += '</div>';
    return html;
}

const KNOWN_BIBLES = {
    'ACF': 'Almeida Corrigida Fiel',
    'ARA': 'Almeida Revista e Atualizada',
    'ARC': 'Almeida Revista e Corrigida',
    'NVT': 'Nova Versão Transformadora',
    'NVI': 'Nova Versão Internacional',
    'KJA': 'King James Atualizada',
    'KJF': 'King James Fiel',
    'NAA': 'Nova Almeida Atualizada',
    'NBV': 'Nova Bíblia Viva',
    'OL': 'O Livro',
    'NTLH': 'Nova Tradução na Linguagem de Hoje',
    'AS21': 'Almeida Século 21',
    'KJ': 'King James'
};

function processBible(uuid, folderName) {
    const uuidDir = path.join(bibliasDir, uuid);
    const metadataPath = path.join(uuidDir, 'metadata.xml');

    if (!fs.existsSync(metadataPath)) {
        console.log(`Metadata not found for ${uuid}`);
        return;
    }

    // 1. Get file map
    const bookMap = parseMetadataXml(metadataPath);
    if (Object.keys(bookMap).length === 0) return;

    // 2. Detect Identity from Content
    let realAbbr = folderName; // fallback
    let realName = folderName;
    let detected = false;

    // Probe first available USX
    const booksToProbe = ['GEN', 'MAT', 'JON', 'PSA', 'JHN'];
    let probePath = null;

    // Find a valid probe file
    for (const b of booksToProbe) {
        if (bookMap['book-' + b.toLowerCase()]) {
            const rel = bookMap['book-' + b.toLowerCase()];
            const p = path.join(uuidDir, rel);
            if (fs.existsSync(p)) { probePath = p; break; }
        }
    }
    if (!probePath) {
        // Pick first whatever
        const rel = Object.values(bookMap)[0];
        const p = path.join(uuidDir, rel);
        if (fs.existsSync(p)) probePath = p;
    }

    if (probePath) {
        try {
            const content = fs.readFileSync(probePath, 'utf8');
            // <book code="GEN" style="id">Gênesis (ACF)</book>
            const headerMatch = content.match(/<book[^>]*>([^<]+)<\/book>/);
            if (headerMatch) {
                const title = headerMatch[1].trim(); // "Jonas (ACF)"
                const parenMatch = title.match(/\(([^)]+)\)$/);
                if (parenMatch) {
                    const code = parenMatch[1].replace(/[^A-Z0-9]/g, ''); // "ACF"
                    if (code && code.length > 1 && code.length < 8) {
                        realAbbr = code;
                        detected = true;
                    }
                }
            }
        } catch (e) { }
    }

    if (KNOWN_BIBLES[realAbbr]) {
        realName = KNOWN_BIBLES[realAbbr];
    } else if (detected) {
        realName = `${realAbbr} (Importada)`;
    }

    console.log(`Processing ${uuid} -> Detected: ${realAbbr} (${realName})`);

    const versionOutDir = path.join(outputBaseDir, realAbbr);
    if (!fs.existsSync(versionOutDir)) {
        fs.mkdirSync(versionOutDir, { recursive: true });
    }

    let count = 0;
    for (const [key, relPath] of Object.entries(bookMap)) {
        // key is "book-gen" usually, we want "GEN"
        const bookCodeMatch = key.match(/book-(.*)/);
        const bookCode = bookCodeMatch ? bookCodeMatch[1].toUpperCase() : key.toUpperCase();

        let usxPath = path.join(uuidDir, relPath);
        if (!fs.existsSync(usxPath)) usxPath = path.join(uuidDir, relPath.replace(/\//g, path.sep));
        if (!fs.existsSync(usxPath)) continue;

        const bookOutDir = path.join(versionOutDir, bookCode);
        if (!fs.existsSync(bookOutDir)) fs.mkdirSync(bookOutDir, { recursive: true });

        const chapters = parseUsx(usxPath);
        for (const [chapNum, verses] of Object.entries(chapters)) {
            const filePath = path.join(bookOutDir, `${bookCode}_${chapNum}.json`);
            const json = {
                id: `${bookCode}.${chapNum}`,
                content: generateHtml(verses, bookCode, chapNum),
                reference: `${realAbbr} ${bookCode} ${chapNum}`
            };
            fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
        }
        if (Object.keys(chapters).length > 0) count++;
    }

    // Metadata
    const metaFile = path.join(versionOutDir, 'metadata.json');
    const meta = {
        id: realAbbr,
        abbreviation: realAbbr,
        name: realName,
        local_title: realName,
        description: 'Bíblia Local',
        lang: 'pt'
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');
    console.log(`  Saved ${count} books to ${realAbbr}`);
}

function main() {
    console.log("Starting Advanced Bible Converter...");
    // Iterate directories
    if (fs.existsSync(bibliasDir)) {
        const entries = fs.readdirSync(bibliasDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                processBible(entry.name, entry.name);
            }
        }
    }
    console.log("Done.");
}

main();
