const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuração
const KEY_STRING = "ProjChurch_Bible_Secure_Key_2025";
const KEY = Buffer.from(KEY_STRING, 'utf8'); // 32 bytes
const SRC_DIR = path.join(__dirname, '../src-tauri/resources/bibles_src');
const DEST_DIR = path.join(__dirname, '../src-tauri/resources/bibles');

// Garantir que a chave tenha 32 bytes
if (KEY.length !== 32) {
    console.error('ERRO: Chave deve ter 32 bytes. Atual: ' + KEY.length);
    process.exit(1);
}

function encryptFile(filePath, destPath) {
    try {
        const content = fs.readFileSync(filePath);

        // 1. Gera Nonce (12 bytes)
        const nonce = crypto.randomBytes(12);

        // 2. Cria Cifra
        const cipher = crypto.createCipheriv('aes-256-gcm', KEY, nonce);

        // 3. Criptografa
        const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);

        // 4. Obtém Tag (16 bytes)
        const tag = cipher.getAuthTag();

        // 5. Constrói Payload: [NONCE 12] + [ENCRYPTED] + [TAG 16]
        // Rust 'aes-gcm' crate (Aead trait) retorna: ciphertext + tag.
        // Meu código Rust espera: [NONCE] + [CIPHERTEXT + TAG]
        // Então deve ser: NONCE + ENCRYPTED + TAG
        const finalBuffer = Buffer.concat([nonce, encrypted, tag]);

        // 6. Garante diretório de destino
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.writeFileSync(destPath, finalBuffer);
        // console.log(`Criptografado: ${path.basename(filePath)}`);
    } catch (e) {
        console.error(`Erro ao criptografar ${filePath}:`, e);
    }
}

function processDirectory(src, dest) {
    if (!fs.existsSync(src)) {
        console.error(`Diretório fonte não encontrado: ${src}`);
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            processDirectory(srcPath, destPath);
        } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'metadata.json') {
            encryptFile(srcPath, destPath);
        } else if (entry.isFile()) {
            // Copia outros arquivos (incluindo metadata.json que precisa ser lido para listagem)
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Iniciando criptografia das Bíblias...');
console.log(`Fonte: ${SRC_DIR}`);
console.log(`Destino: ${DEST_DIR}`);

// Limpa destino anterior
if (fs.existsSync(DEST_DIR)) {
    fs.rmSync(DEST_DIR, { recursive: true, force: true });
}

processDirectory(SRC_DIR, DEST_DIR);
console.log('Concluído!');
