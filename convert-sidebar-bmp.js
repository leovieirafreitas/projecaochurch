
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function convertToBmp() {
    const inputPath = path.join(__dirname, 'src-tauri', 'icons', 'ICONE_PROJECITONCHURH1.png');
    // Save as sidebar.bmp in src-tauri/icons
    // Note: 'sharp' doesn't support BMP output directly out of the box in some versions, 
    // but newer versions or specific processors might. Let's check if we can format to 'bmp'.
    // If not, we might need another approach/tool or just try saving as .bmp with proper encoding.
    // Sharp docs say: output format support depends on libvips. BMP write support is usually available.

    // Actually, sharp might not support BMP write. Let's try to just resize it to ensure it fits potential constraints
    // and save it. If sharp fails on .toFormat('bmp'), we'll know.
    // Alternatively, many NSIS setups support PNG if a plugin is used, but standard MUI uses BMP.

    console.log('🎨 Convertendo imagem lateral para BMP...');

    try {
        // NSIS default sidebar dimensions are roughly 164x314 (standard) or similar aspect ratio.
        // It's safer to resize to a standard width like 164px.
        // Let's try generating a PNG first to see if that was the issue (size/depth).
        // Wait, the warning was "Unsupported format". It likely wants BMP.

        // Let's try to use 'jimp' if available? No, I don't know if jimp is installed.
        // Let's stick with sharp. If exact BMP isn't supported, we might just use a compatible PNG (no alpha, 8-bit?).
        // Actually, the warning specifically says "Unsupported format", implying the file type itself.

        // Let's try to save as .bmp.
        // Sharp typically requires: .toFormat('bmp') or just infer from extension.
        // But let's check if the current sharp version supports it.

        const outputPath = path.join(__dirname, 'src-tauri', 'icons', 'sidebar.bmp');

        await sharp(inputPath)
            .resize(164, 314, {
                fit: 'cover',
                position: 'center'
            })
            // flatten to remove alpha channel, replacing with white background (standard for installers)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .toFormat('bmp') // Requires libvips compiled with *magick or similar often, but let's try.
            .toFile(outputPath);

        console.log('✅ Imagem lateral criada: src-tauri/icons/sidebar.bmp');

    } catch (error) {
        console.error('❌ Erro ao converter para BMP via sharp (pode n?o suportar):', error);

        // Fallback: Try a non-transparent PNG, maybe NSIS just hates transparency or high color depth?
        // But standard NSIS really wants BMP.
        // If this fails, I'll recommend the user use an online converter or I use a python script if python is available?
        // I'll stick to trying this first.
    }
}

convertToBmp();
