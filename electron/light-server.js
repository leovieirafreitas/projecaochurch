const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');
// Tenta importar formidable, lida com erro se não existir (mas deve existir)
let formidable;
try { formidable = require('formidable'); } catch (e) { }

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOSTNAME = '0.0.0.0';

// Configuração do Supabase (Client-side anon key é segura para expor aqui se necessário, 
// mas idealmente usamos env vars passadas pelo main.js)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

// Cache em memória para Projection Status
let projectionCache = null;

// Caminho do DB de Músicas
const userDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
// Em prod, o main.js deve definir userData corretamente se possível, mas aqui usamos fallback
// O ideal é passar o caminho correto via main.js, mas vamos tentar inferir ou usar diretório local em dev
const IS_DEV = process.env.NODE_ENV !== 'production';
const SONGS_DB_PATH = IS_DEV
    ? path.join(__dirname, '..', 'songs_db.json')
    : path.join(process.resourcesPath || __dirname, 'songs_db.json'); // Ajustar se necessário para userData do Electron

// Utilitário para servir arquivos estáticos
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const STATIC_DIR = path.join(__dirname, '..', 'out');

/**
 * Servidor Leve Otimizado para Electron
 */
const server = http.createServer(async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // --- API ROUTES ---

    // 1. YouVersion Proxy (/api/proxy)
    if (pathname === '/api/proxy') {
        return handleProxy(req, res, parsedUrl);
    }

    // 2. Status / Projeção (/api/status)
    if (pathname === '/api/status') {
        return handleStatus(req, res);
    }

    // 3. Músicas (/api/songs)
    if (pathname === '/api/songs') {
        return handleSongs(req, res, parsedUrl);
    }

    // 4. IP Local (/api/local-ip)
    if (pathname === '/api/local-ip') {
        return handleLocalIp(req, res);
    }

    // 5. Upload (/api/upload)
    if (pathname === '/api/upload') {
        return handleUpload(req, res);
    }

    // --- STATIC FILE SERVING ---
    // Se não for API, tenta servir arquivo estático da pasta 'out'

    // Normalizar caminho (ex: / -> /index.html)
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');

    // Roteamento Next.js Style (se for rota limpa, busca .html)
    let filePath = path.join(STATIC_DIR, safePath);

    // Se for pasta, tenta index.html
    if (req.url === '/' || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    // Se arquivo não existe, tenta adicionar .html (roteamento de páginas)
    else if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
        filePath += '.html';
    }

    // Verificar se arquivo existe
    fs.readFile(filePath, (err, data) => {
        if (err) {
            // 404 - Tenta servir 404.html customizado ou index.html (SPA Fallback)
            // Para SPA (Next.js export), muitas vezes queremos servir index.html em 404s se for navegação
            // Mas aqui vamos retornar 404 simples por enquanto
            res.writeHead(404);
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// --- HANDLERS ---

// Handler: Proxy YouVersion
async function handleProxy(req, res, parsedUrl) {
    const endpoint = parsedUrl.query.endpoint;
    if (!endpoint) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint required' }));
        return;
    }

    const APP_KEY = process.env.YOUVERSION_API_KEY || '8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7';
    const cleanEndpoint = endpoint.replace(/^\//, '');
    const BASE_URL = 'https://api.youversion.com/v1';

    const targetUrlStr = `${BASE_URL}/${cleanEndpoint}`;
    const targetUrl = new URL(targetUrlStr);

    // Passar query params adiante
    Object.keys(parsedUrl.query).forEach(key => {
        if (key !== 'endpoint') {
            targetUrl.searchParams.append(key, parsedUrl.query[key]);
        }
    });

    console.log(`[Proxy] ${targetUrl.toString()}`);

    const options = {
        hostname: targetUrl.hostname,
        port: 443,
        path: targetUrl.pathname + targetUrl.search,
        method: 'GET',
        headers: {
            'x-yvp-app-key': APP_KEY,
            'Accept': 'application/json',
            'User-Agent': 'PostmanRuntime/7.26.8'
        }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        let rawData = '';
        proxyRes.setEncoding('utf8');
        proxyRes.on('data', chunk => rawData += chunk);
        proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode || 200, { 'Content-Type': 'application/json' });
            res.end(rawData);
        });
    });

    proxyReq.on('error', (e) => {
        console.error(`[Proxy Error] ${e.message}`);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
    });

    proxyReq.end();
}

// Handler: Status / Cache
async function handleStatus(req, res) {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const currentData = JSON.parse(body);
                // 1. Cache Local Instant
                projectionCache = currentData;

                // 2. Persistir Supabase (Background)
                if (supabase) {
                    supabase.from('projection_state')
                        .update({ data: currentData, updated_at: new Date().toISOString() })
                        .eq('id', 1)
                        .then(({ error }) => {
                            if (error) console.error("Supabase Save Error", error);
                        });
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, mode: 'cached-light' }));
            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        // GET
        if (projectionCache) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(projectionCache));
            return;
        }

        // Fallback Supabase
        if (supabase) {
            const { data, error } = await supabase.from('projection_state').select('data').eq('id', 1).single();
            if (!error && data) {
                projectionCache = data.data || {};
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(projectionCache));
                return;
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
    }
}

// Handler: Local IP
function handleLocalIp(req, res) {
    const interfaces = os.networkInterfaces();
    const results = {};

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
}

// Handler: Songs (CRUD) simplificado
function handleSongs(req, res, parsedUrl) {
    // Helper DB
    const getSongs = () => {
        if (!fs.existsSync(SONGS_DB_PATH)) return [];
        return JSON.parse(fs.readFileSync(SONGS_DB_PATH, 'utf-8'));
    };
    const saveSongs = (songs) => fs.writeFileSync(SONGS_DB_PATH, JSON.stringify(songs, null, 2));

    if (req.method === 'GET') {
        const songs = getSongs();
        songs.sort((a, b) => a.title.localeCompare(b.title));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(songs));
    } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const song = JSON.parse(body);
            if (!song.title || !song.text) {
                res.writeHead(400); res.end('Invalid data'); return;
            }
            if (!song.id) song.id = Date.now().toString();

            const songs = getSongs();
            const idx = songs.findIndex(s => s.id === song.id);
            if (idx >= 0) songs[idx] = song;
            else songs.push(song);

            saveSongs(songs);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(song));
        });
    } else if (req.method === 'DELETE') {
        const id = parsedUrl.query.id;
        let songs = getSongs();
        songs = songs.filter(s => s.id !== id);
        saveSongs(songs);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
    }
}

// Handler: Upload (Simples)
function handleUpload(req, res) {
    if (!formidable) {
        res.writeHead(500); res.end('Formidable not installed'); return;
    }

    // Configurar diretório de upload
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads');

    // Tenta criar pasta se não existir (no Electron isso pode ser problema se public estiver dentro de asar,
    // o ideal seria user userData. Ajuste conforme necessidade real.)
    if (!fs.existsSync(uploadDir)) {
        try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) { }
    }

    const form = new formidable.IncomingForm({
        uploadDir: uploadDir,
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024
    });

    form.parse(req, (err, fields, files) => {
        if (err) {
            res.writeHead(500); res.end('Upload error'); return;
        }

        const file = Array.isArray(files.file) ? files.file[0] : files.file;
        if (!file) {
            res.writeHead(400); res.end('No file'); return;
        }

        const fileName = path.basename(file.filepath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url: `/uploads/${fileName}` }));
    });
}

// Iniciar
server.listen(PORT, HOSTNAME, () => {
    console.log(`> Light Server ready on http://${HOSTNAME}:${PORT}`);
    if (process.send) process.send('ready');
});
