const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

async function convertToIco() {
    const inputPath = path.join(__dirname, 'src-tauri', 'icons', 'ICONE_PROJECITONCHURH1.png');
    const outputPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.ico');

    console.log('🎨 Convertendo logo para formato .ico...');

    try {
        // Criar múltiplos tamanhos para o .ico
        const sizes = [16, 32, 48, 64, 128, 256];
        const buffers = [];

        for (const size of sizes) {
            console.log(`   Gerando tamanho ${size}x${size}...`);
            const buffer = await sharp(inputPath)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toBuffer();
            buffers.push(buffer);
        }

        // Converter para .ico
        const icoBuffer = await toIco(buffers);
        fs.writeFileSync(outputPath, icoBuffer);

        console.log('✅ Ícone .ico criado com sucesso!');
        console.log(`   Salvo em: ${outputPath}`);

        // Também criar os PNGs de diferentes tamanhos
        console.log('\n🎨 Criando ícones PNG adicionais...');

        await sharp(inputPath)
            .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(path.join(__dirname, 'src-tauri', 'icons', '32x32.png'));
        console.log('   ✅ 32x32.png');

        await sharp(inputPath)
            .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(path.join(__dirname, 'src-tauri', 'icons', '128x128.png'));
        console.log('   ✅ 128x128.png');

        await sharp(inputPath)
            .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(path.join(__dirname, 'src-tauri', 'icons', '128x128@2x.png'));
        console.log('   ✅ 128x128@2x.png');

        await sharp(inputPath)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(path.join(__dirname, 'src-tauri', 'icons', 'icon.png'));
        console.log('   ✅ icon.png');

        console.log('\n🎉 Todos os ícones foram atualizados com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao converter ícone:', error);
        process.exit(1);
    }
}

convertToIco();
