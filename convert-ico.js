
const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.png');
const icoPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.ico');

try {
    const png = fs.readFileSync(pngPath);

    // Header ICO (6 bytes)
    // 0-1: Reservado (0)
    // 2-3: Tipo (1 = ICO)
    // 4-5: Número de imagens (1)
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);

    // Diretório da Imagem (16 bytes)
    // 0: Largura (0 = 256)
    // 1: Altura (0 = 256)
    // 2: Cores (0 = TrueColor)
    // 3: Reservado (0)
    // 4-5: Planos de cor (1)
    // 6-7: Bits por pixel (32)
    // 8-11: Tamanho da imagem em bytes
    // 12-15: Offset (posição onde começa a imagem) -> 6 + 16 = 22
    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0); // Width 256 (0)
    entry.writeUInt8(0, 1); // Height 256 (0)
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(22, 12); // 6 (header) + 16 (entry)

    const ico = Buffer.concat([header, entry, png]);
    fs.writeFileSync(icoPath, ico);

    console.log('ICO gerado com sucesso!');
} catch (e) {
    console.error('Erro:', e);
    process.exit(1);
}
