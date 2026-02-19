const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configurações
const PROJECT_ROOT = __dirname;
const TAURI_ROOT = path.join(PROJECT_ROOT, 'src-tauri');
const ICONS_DIR = path.join(TAURI_ROOT, 'icons');
const RELEASES_DIR = path.join(PROJECT_ROOT, 'RELEASES');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');

function log(msg) {
    console.log(`\n\x1b[36m[BUILDER]\x1b[0m ${msg}`);
}

function error(msg) {
    console.error(`\n\x1b[31m[ERRO]\x1b[0m ${msg}`);
    process.exit(1);
}

function getVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
        return pkg.version || '0.0.0';
    } catch (e) {
        return '0.3.53'; // Fallback baseado no package.json lido anteriormente
    }
}

function fixIcons() {
    log('Verificando ícones...');
    // Removida a sobrescrita automática pois estava usando a imagem errada (ICONE_PROCTIONCHURCH.png).
    // O usuário confirmou que o icon.ico original é o correto.
    log('Utilizando ícones existentes em src-tauri/icons/');
}

async function run() {
    const version = getVersion();
    const releasePath = path.join(RELEASES_DIR, `v${version}`);

    console.log('\x1b[35m' + '='.repeat(50) + '\x1b[0m');
    console.log(`\x1b[35m   PROJECTION CHURCH - BUILDER PROFISSIONAL v${version}\x1b[0m`);
    console.log('\x1b[35m' + '='.repeat(50) + '\x1b[0m');

    // 1. Preparar pastas
    log('Preparando diretórios...');
    if (!fs.existsSync(RELEASES_DIR)) fs.mkdirSync(RELEASES_DIR);
    if (!fs.existsSync(releasePath)) fs.mkdirSync(releasePath, { recursive: true });

    // 2. Icon Fixing
    fixIcons();

    // 3. Limpeza Profunda
    log('Limpando cache e artefatos anteriores...');
    const bundleDir = path.join(TAURI_ROOT, 'target', 'release', 'bundle');
    const outDir = path.join(PROJECT_ROOT, 'out');

    [bundleDir, outDir].forEach(dir => {
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
                console.log(`  Limpado: ${path.relative(PROJECT_ROOT, dir)}`);
            } catch (e) {
                console.log(`  Aviso: Não foi possível limpar ${dir}`);
            }
        }
    });

    // 4. Executar o Build
    log('Iniciando o build (npm run tauri build)...');
    console.log('\x1b[2mEste processo pode levar de 3 a 8 minutos dependendo do seu computador.\x1b[0m');

    try {
        execSync('npm run tauri build', { stdio: 'inherit', cwd: PROJECT_ROOT });
    } catch (e) {
        error('O build falhou catastróficamente. Verifique os logs acima.');
    }

    // 5. Coletar artefatos
    log('Coletando novos instaladores...');
    const bundleDirs = [
        path.join(bundleDir, 'msi'),
        path.join(bundleDir, 'nsis')
    ];

    let foundAny = false;
    bundleDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                if (file.endsWith('.msi') || file.endsWith('.exe')) {
                    const src = path.join(dir, file);
                    const dest = path.join(releasePath, file);
                    fs.copyFileSync(src, dest);
                    console.log(`  \x1b[32m[OK]\x1b[0m Salvo em RELEASES: ${file}`);
                    foundAny = true;
                }
            });
        }
    });

    if (!foundAny) {
        error('Build terminado, mas nenhum instalador foi localizado em src-tauri/target/release/bundle.');
    }

    // 6. Finalização
    const buildInfo = {
        version,
        date: new Date().toLocaleString(),
        files: fs.readdirSync(releasePath)
    };
    fs.writeFileSync(path.join(releasePath, 'build_report.json'), JSON.stringify(buildInfo, null, 2));

    log(`\x1b[32mTODO CERTO! Build v${version} gerado com sucesso.\x1b[0m`);
    log(`Local dos instaladores: ${releasePath}`);
    console.log('\x1b[35m' + '='.repeat(50) + '\x1b[0m');
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
