
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceImg = path.join(__dirname, 'src-tauri', 'icons', 'ICONE_PROCTIONCHURCH.png');
const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
const destPng = path.join(iconsDir, 'icon.png');
const destIco = path.join(iconsDir, 'icon.ico');

console.log('1. Copiando imagem original...');
try {
    if (fs.existsSync(sourceImg)) {
        fs.copyFileSync(sourceImg, destPng);
        console.log('Imagem copiada para:', destPng);
    } else {
        console.error('Imagem de origem não encontrada:', sourceImg);
        process.exit(1);
    }
} catch (e) {
    console.error('Erro ao copiar:', e);
    process.exit(1);
}

console.log('2. Convertendo para ICO...');
try {
    const png = fs.readFileSync(destPng);

    // Header ICO (6 bytes)
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reservado
    header.writeUInt16LE(1, 2); // Tipo ICO
    header.writeUInt16LE(1, 4); // 1 Imagem

    // Entry (16 bytes)
    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0); // Width 256
    entry.writeUInt8(0, 1); // Height 256
    entry.writeUInt8(0, 2); // Colors
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Planes
    entry.writeUInt16LE(32, 6); // BPP
    entry.writeUInt32LE(png.length, 8); // Size
    entry.writeUInt32LE(22, 12); // Offset

    const ico = Buffer.concat([header, entry, png]);
    fs.writeFileSync(destIco, ico);
    console.log('ICO válido gerado em:', destIco);
} catch (e) {
    console.error('Erro ao converter:', e);
    process.exit(1);
}

console.log('3. Limpando build anterior...');
try {
    const targetDir = path.join(__dirname, 'src-tauri', 'target');
    if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
    }
} catch (e) {
    console.log('Aviso ao limpar target (pode ser ignorado):', e.message);
}

console.log('4. Iniciando Build...');
try {
    execSync('npm run tauri build', { stdio: 'inherit' });
} catch (e) {
    console.error('Erro no build:', e);
    process.exit(1);
}
