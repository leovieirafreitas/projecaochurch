const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;
const PORT = 3000;

// Log file configuration
const logPath = path.join(app.getPath('userData'), 'app-debug.log');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    try {
        fs.appendFileSync(logPath, logMessage);
    } catch (e) {
        console.error(e);
    }
}

// Clear log on start
if (!isDev) {
    try {
        fs.writeFileSync(logPath, '--- Application Start ---\n');
    } catch (e) { }
}

function createWindow() {
    log('Creating window...');
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "Bíblia Online - Chama Church",
        icon: path.join(__dirname, '../public/favicon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // In debug mode, open the file log to show the user
    if (!isDev) {
        // Show a loading/debug screen initially
        mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
            <body style="font-family:sans-serif; background:#111; color:#fff; padding:20px;">
                <h2>Iniciando Sistema...</h2>
                <p>Aguardando servidor local...</p>
                <p><small>Logs salvos em: ${logPath.replace(/\\/g, '\\\\')}</small></p>
            </body>
        </html>`);
    }

    const url = `http://localhost:${PORT}`;

    // Retry logic for loading the page
    const checkServerAndLoad = () => {
        http.get(url, (res) => {
            log(`Server responding with status: ${res.statusCode}`);
            mainWindow.loadURL(url);
        }).on('error', (err) => {
            log(`Waiting for server... (${err.message})`);
            setTimeout(checkServerAndLoad, 1000);
        });
    };

    if (isDev) {
        mainWindow.loadURL(url);
        mainWindow.webContents.openDevTools();
    } else {
        checkServerAndLoad();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

async function startServer() {
    if (isDev) return;

    const serverPath = path.join(__dirname, 'server.js');
    log(`Attempting to start server at: ${serverPath}`);

    if (!fs.existsSync(serverPath)) {
        log(`ERROR: Server file not found at ${serverPath}`);
        dialog.showErrorBox("Erro Crítico", `Arquivo do servidor não encontrado:\n${serverPath}`);
        return;
    }

    return new Promise((resolve, reject) => {
        // Use 'silent: true' to capture stdout/stderr
        serverProcess = fork(serverPath, [], {
            env: {
                ...process.env,
                NODE_ENV: 'production',
                PORT: PORT.toString(),
                // Inject keys explicitly for production
                NEXT_PUBLIC_YOUVERSION_API_KEY: '8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7',
                YOUVERSION_API_KEY: '8CIUKFa2HDqazT1Vu4P9kpZPZVVtZMpvZiGBzt3GDggWf3q7',
                NEXT_PUBLIC_SUPABASE_URL: 'https://evrqtiibdxsgdjqllaqh.supabase.co',
                NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cnF0aWliZHhzZ2RqcWxsYXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyOTE2NTUsImV4cCI6MjA4NDg2NzY1NX0.4UNeShq1-59Y3A3UXcBDV-VuQnKFpy-rKsvSkhWSWKM',
                BIBLEBRAIN_API_KEY: 'db346576-060a-4787-8bc2-5386e8e3be8d',
                NEXT_PUBLIC_BIBLEBRAIN_API_KEY: 'db346576-060a-4787-8bc2-5386e8e3be8d'
            },
            silent: true
        });

        serverProcess.stdout.on('data', (data) => {
            log(`[SERVER STDOUT] ${data}`);
        });

        serverProcess.stderr.on('data', (data) => {
            log(`[SERVER STDERR] ${data}`);
        });

        serverProcess.on('message', (msg) => {
            if (msg === 'ready') {
                log('Server signaled ready');
                resolve();
            }
        });

        serverProcess.on('error', (err) => {
            log(`Server failed to start: ${err.message}`);
            reject(err);
        });

        // If it exits prematurely
        serverProcess.on('exit', (code) => {
            log(`Server process exited with code ${code}`);
        });
    });
}

app.whenReady().then(async () => {
    try {
        await startServer();
    } catch (e) {
        log(`Startup error: ${e.message}`);
        dialog.showErrorBox("Erro de Inicialização", e.message || "Erro desconhecido");
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
