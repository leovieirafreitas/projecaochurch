const APP_DIR = 'MediaChurch';
const PROJECTS_DIR = 'Projetos';
const RECENTS_KEY = 'recent_projects';

// Helper to get Tauri APIs safely from window object (Global Tauri)
const getTauri = () => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        return (window as any).__TAURI__;
    }
    return null;
};

import { StorageHelper } from './storage-helper';
import { showToast, hideToast } from './toast-manager';

export const ProjectManager = {
    async getProjectsDir() {
        const tauri = getTauri();
        if (!tauri) return null;

        try {
            const docDir = await tauri.path.documentDir();
            const path = await tauri.path.join(docDir, APP_DIR, PROJECTS_DIR);

            if (!(await tauri.fs.exists(path))) {
                await tauri.fs.createDir(path, { recursive: true });
            }
            return path;
        } catch (e) {
            console.error('Erro ao obter diretório de projetos:', e);
            return null;
        }
    },

    async openProjectsFolder() {
        if ((window as any).electronAPI) {
            return (window as any).electronAPI.openProjectsFolder();
        }

        const tauri = getTauri();
        if (!tauri) return;

        try {
            await tauri.invoke('open_projects_folder_native');
            return;
        } catch (e) {
            console.warn('Native folder open failed, trying shell open...', e);
        }

        const dir = await this.getProjectsDir();
        if (dir) {
            try {
                await tauri.shell.open(dir);
            } catch (e) {
                console.error("Shell open failed", e);
                alert("Não foi possível abrir a pasta.");
            }
        }
    },

    async exitApp() {
        if ((window as any).electronAPI) {
            window.close();
            return;
        }

        const tauri = getTauri();
        if (tauri) {
            try {
                await tauri.invoke('quit_app');
            } catch (e) {
                console.error('Quit app failed', e);
                window.close();
            }
        } else {
            window.close();
        }
    },

    async createNewProject(name: string) {
        let safeName = name.replace(/[^a-zA-Z0-9 \-_áéíóúÁÉÍÓÚñÑçÇ]/g, '').trim();
        if (!safeName.toLowerCase().endsWith('.chama')) {
            safeName += '.chama';
        }

        const data = {
            version: localStorage.getItem('bible_version') || 'NVI',
            settings: JSON.parse(localStorage.getItem('bible_settings') || '{}'),
            history: [],
            timestamp: new Date().toISOString()
        };

        if ((window as any).electronAPI) {
            return this.saveProject(data, true);
        }

        const tauri = getTauri();
        if (!tauri) return;

        try {
            const projectsDir = await this.getProjectsDir();
            if (!projectsDir) throw new Error("Diretório não encontrado");

            const filePath = await tauri.path.join(projectsDir, safeName);

            if (await tauri.fs.exists(filePath)) {
                if (!confirm(`O projeto "${safeName}" já existe. Deseja substituir?`)) {
                    return null;
                }
            }

            await tauri.fs.writeTextFile(filePath, JSON.stringify(data, null, 2));
            await this.handleProjectData(filePath, data);
            return filePath;

        } catch (e) {
            console.error('Erro ao criar projeto:', e);
            throw e;
        }
    },

    async saveProject(data: any = null, forceDialog = false) {
        if (!data) {
            const settingsStr = localStorage.getItem('bible_settings');
            const version = localStorage.getItem('bible_version');
            const historyStr = localStorage.getItem('recent_history');
            const settings = settingsStr ? JSON.parse(settingsStr) : {};

            if (!settings.backgroundImage) {
                const indexedBg = await StorageHelper.getBackground('bible_settings');
                if (indexedBg) settings.backgroundImage = indexedBg;
            }

            data = {
                version: version || 'NVI',
                settings: settings,
                history: historyStr ? JSON.parse(historyStr) : [],
                timestamp: new Date().toISOString()
            };
        }

        const currentPath = localStorage.getItem('current_project_path');

        if ((window as any).electronAPI) {
            const path = await (window as any).electronAPI.saveProject(data);
            if (path) {
                this.addToRecents(path);
                localStorage.setItem('current_project_path', path);
                return path;
            }
            return null;
        }

        const tauri = getTauri();
        if (!tauri) {
            alert('Apenas Desktop.');
            return;
        }

        try {
            if (!forceDialog && currentPath && await tauri.fs.exists(currentPath)) {
                showToast('Salvando projeto...', 'loading');
                await tauri.fs.writeTextFile(currentPath, JSON.stringify(data, null, 2));
                window.dispatchEvent(new Event('project-saved'));
                hideToast();
                showToast('Projeto salvo com sucesso!', 'success', 2000);
                return currentPath;
            }

            const defaultPath = await this.getProjectsDir();
            let savePath = 'culto.chama';
            if (defaultPath) {
                savePath = await tauri.path.join(defaultPath, 'culto.chama');
            }

            const filePath = await tauri.dialog.save({
                title: 'Salvar Projeto MediaChurch',
                defaultPath: savePath,
                filters: [{ name: 'Projeto MediaChurch', extensions: ['chama'] }]
            });

            if (filePath) {
                showToast('Salvando projeto...', 'loading');
                await tauri.fs.writeTextFile(filePath, JSON.stringify(data, null, 2));

                this.addToRecents(filePath);
                localStorage.setItem('current_project_path', filePath);
                this.updateTitleCompat(filePath);
                window.dispatchEvent(new Event('recents-updated'));
                window.dispatchEvent(new Event('project-saved'));

                hideToast();
                showToast('Projeto salvo com sucesso!', 'success', 2000);
                return filePath;
            }
        } catch (e) {
            console.error('Erro ao salvar:', e);
            hideToast();
            showToast('Erro ao salvar projeto', 'error', 3000);
        }
        return null;
    },

    async openProject() {
        if ((window as any).electronAPI) {
            const result = await (window as any).electronAPI.openProject();
            if (result && result.path && result.data) {
                return this.handleProjectData(result.path, result.data);
            }
            return null;
        }

        const tauri = getTauri();
        if (!tauri) {
            alert('Apenas Desktop.');
            return;
        }

        try {
            const defaultPath = await this.getProjectsDir();
            const selected = await tauri.dialog.open({
                multiple: false,
                directory: false,
                defaultPath: defaultPath || undefined,
                filters: [{ name: 'Projeto MediaChurch', extensions: ['chama'] }]
            });

            if (selected && typeof selected === 'string') {
                return await this.loadFromFile(selected);
            }
        } catch (e) {
            console.error('Erro ao abrir:', e);
        }
        return null;
    },

    async loadFromFile(path: string) {
        showToast('Carregando...', 'loading');
        window.dispatchEvent(new Event('project-loading-start'));

        if ((window as any).electronAPI) {
            const data = await (window as any).electronAPI.loadFromFile(path);
            if (data) {
                const res = await this.handleProjectData(path, data);
                hideToast();
                showToast('Projeto Carregado', 'success');
                return res;
            }
            return null;
        }

        const tauri = getTauri();
        if (!tauri) return null;

        try {
            if (await tauri.fs.exists(path)) {
                const content = await tauri.fs.readTextFile(path);
                const data = JSON.parse(content);
                const res = await this.handleProjectData(path, data);

                hideToast();
                showToast('Projeto Carregado', 'success');
                return res;
            } else {
                showToast('Arquivo não encontrado: ' + path, 'error');
            }
        } catch (e) {
            console.error('Erro ao carregar arquivo:', e);
            hideToast();
            showToast('Erro ao carregar: ' + e, 'error', 4000);
        }
        return null;
    },

    async handleProjectData(path: string, data: any) {
        // LIMPEZA RADICAL: Remove resquícios anteriores por segurança
        localStorage.removeItem('bible_settings');
        await StorageHelper.removeBackground('bible_settings');

        if (data.settings) {
            // PROTEÇÃO CONTRA QUOTA EXCEEDED
            // Separa a imagem pesada do JSON leve
            const cleanSettings = { ...data.settings };
            const heavyImage = cleanSettings.backgroundImage;

            // Se for base64 longo, remove do JSON que vai pro LocalStorage (limite 5MB)
            if (heavyImage && (heavyImage.startsWith('data:') || heavyImage.length > 5000)) {
                cleanSettings.backgroundImage = null;
            }

            try {
                localStorage.setItem('bible_settings', JSON.stringify(cleanSettings));
            } catch (e) {
                console.error("QuotaExceeded recuperado - Salvando settings mínimos");
                // Fallback extremo: remove tudo que for pesado
                cleanSettings.backgroundImage = null;
                localStorage.setItem('bible_settings', JSON.stringify(cleanSettings));
            }

            // A imagem real vai para o IndexedDB que aguenta Gigabytes
            if (heavyImage) {
                await StorageHelper.setBackground('bible_settings', heavyImage);
            } else {
                // Redundância: Garante que se não tem imagem, o banco fica limpo
                await StorageHelper.removeBackground('bible_settings');
            }
        }

        if (data.version) {
            localStorage.setItem('bible_version', data.version);
        }

        // DELAY CRÍTICO: Garante que o IndexedDB terminou de gravar ANTES de avisar a outra janela
        // Se disparar o evento antes, a janela de projeção vai ler dados antigos do cache
        await new Promise(resolve => setTimeout(resolve, 500));

        // COMUNICAÇÃO TAURI (V17): Substitui BroadcastChannel por Evento Global do Tauri
        // Isso atravessa barreiras de Webview garantindo que a janela de projeção receba o sinal
        try {
            const tauri = getTauri();
            if (tauri && data.settings) {
                // Remove imagem pesada do payload de mensagem por segurança
                const safeSettings = { ...data.settings };
                if (safeSettings.backgroundImage && safeSettings.backgroundImage.length > 5000) {
                    safeSettings.backgroundImage = null;
                }
                safeSettings.syncTimestamp = Date.now();
                safeSettings.projectPath = path; // ID único do projeto para cache busting

                // Emite evento global que a outra janela vai ouvir com certeza
                await tauri.event.emit('bible-projection-update', safeSettings);
                console.log("Evento Tauri emitido: bible-projection-update", path);
            }
        } catch (e) {
            console.error("Erro ao emitir evento Tauri:", e);
        }

        // V24: BROADCAST VIA LOCAL SERVER (Para navegadores externos - Chrome/Mobile)
        // Usa cliente nativo do Tauri para evitar bloqueios de CORS/Net do WebView
        try {
            const payload = {
                type: 'reload-signal',
                projectPath: path,
                timestamp: Date.now(),
                // Limpa o estado visual no servidor também
                verseText: '',
                reference: '',
                style: (data.settings && data.settings.backgroundImage && data.settings.backgroundImage.length < 5000)
                    ? data.settings
                    : { ...data.settings, backgroundImage: null }
            };

            const tauri = getTauri();
            if (tauri && tauri.http) {
                // Usa API nativa HTTP do Tauri (requer allowlist configurada)
                // Isso garante que a requisição saia do backend Rust, ignorando restrições do browser
                const client = await tauri.http.getClient();
                const Body = tauri.http.Body;

                const ports = [4523, 4524];
                for (const port of ports) {
                    try {
                        await client.request({
                            method: 'POST',
                            url: `http://localhost:${port}/api/status`,
                            body: Body.json(payload)
                        });
                        console.log(`Sinal de Reload enviado via Tauri HTTP para porta ${port}`);
                    } catch (innerE) {
                        // Falha silenciosa para porta errada
                    }
                }
            } else {
                // Fallback para fetch normal se Tauri HTTP não estiver disponível
                const ports = [4523, 4524];
                ports.forEach(port => {
                    fetch(`http://localhost:${port}/api/status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).catch(() => { });
                });
            }
        } catch (e) {
            console.error("Erro no Broadcast Local:", e);
        }

        this.addToRecents(path);
        localStorage.setItem('current_project_path', path);
        this.updateTitleCompat(path);

        window.dispatchEvent(new Event('project-loaded'));

        // V27: FORÇA RELOAD DO SISTEMA (Restaurado v74)
        // Isso garante que o cache visual seja limpo e o projeto carregue "do zero" ao TROCAR de projeto.
        // O Salvar (Ctrl+S) continua sem reload.
        setTimeout(() => {
            window.location.reload();
        }, 100);

        window.dispatchEvent(new Event('recents-updated'));
        window.dispatchEvent(new Event('project-saved')); // V73: Novo evento para forçar sync visual
        return data;

        return data;
    },

    async checkRecents() {
        let recents = this.getRecents();
        const validRecents = [];

        if ((window as any).electronAPI) {
            for (const path of recents) {
                try {
                    const result = await (window as any).electronAPI.loadFromFile(path);
                    if (result !== null) validRecents.push(path);
                } catch (e) { }
            }
        } else {
            const tauri = getTauri();
            if (!tauri) return;

            for (const path of recents) {
                try {
                    if (await tauri.fs.exists(path)) {
                        validRecents.push(path);
                    }
                } catch (e) { }
            }
        }

        if (validRecents.length !== recents.length) {
            localStorage.setItem(RECENTS_KEY, JSON.stringify(validRecents));
            window.dispatchEvent(new Event('recents-updated'));
        }
    },

    async getFriendlyPath(fullPath: string) {
        try {
            const tauri = getTauri();
            if (!tauri) return fullPath;

            const name = fullPath.split(/[\\/]/).pop();
            const docDir = await tauri.path.documentDir();
            const downloadDir = await tauri.path.downloadDir();

            const normPath = fullPath.replace(/\\/g, '/').toLowerCase();
            const normDoc = docDir.replace(/\\/g, '/').toLowerCase();
            const normDownload = downloadDir.replace(/\\/g, '/').toLowerCase();

            if (normPath.includes((normDoc + '/' + APP_DIR + '/' + PROJECTS_DIR).toLowerCase())) {
                return `PastaProjetos/${name}`;
            }
            if (normPath.includes(normDownload)) {
                return `Downloads/${name}`;
            }
            if (normPath.includes('desktop') || normPath.includes('área de trabalho')) {
                return `Desktop/${name}`;
            }

            return name || fullPath;
        } catch (e) {
            return fullPath.split(/[\\/]/).pop() || fullPath;
        }
    },

    addToRecents(path: string) {
        try {
            let recents = this.getRecents();
            recents = recents.filter(p => p !== path);
            recents.unshift(path);
            recents = recents.slice(0, 10);
            localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
            window.dispatchEvent(new Event('recents-updated'));
        } catch (e) { }
    },

    getRecents(): string[] {
        try {
            const data = localStorage.getItem(RECENTS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },

    async getRecentsWithLabels(): Promise<{ path: string, label: string }[]> {
        await this.checkRecents();
        const paths = this.getRecents();
        const result = [];
        for (const path of paths) {
            const label = await this.getFriendlyPath(path);
            result.push({ path, label });
        }
        return result;
    },

    async getCurrentProjectInfo() {
        const path = localStorage.getItem('current_project_path');
        if (!path) return null;

        const tauri = getTauri();
        if (tauri) {
            try {
                if (!(await tauri.fs.exists(path))) {
                    console.warn(`Projeto atual não encontrado: ${path}`);
                    localStorage.removeItem('current_project_path');
                    return null;
                }
            } catch (e) {
                console.warn(`Erro ao verificar projeto atual: ${e}`);
                localStorage.removeItem('current_project_path');
                return null;
            }
        }

        const displayName = await this.getFriendlyPath(path);

        try {
            const parts = path.split(/[\\/]/);
            const name = parts.pop() || 'Sem Título';
            const parentFolder = parts.pop() || '';
            const driveMatch = path.match(/^([a-zA-Z]:)/);
            const drive = driveMatch ? driveMatch[1] : '';

            let display = 'Projeto';
            if (drive) display += `/${drive}`;
            if (parentFolder) display += `/${parentFolder}`;
            display += `/${name}`;

            return { path, display };
        } catch (e) {
            return { path, display: displayName };
        }
    },

    updateTitleCompat(path: string) {
        if (typeof window === 'undefined') return;
        const fileName = path.split(/[\\/]/).pop();
        const tauri = getTauri();

        if (tauri && tauri.window) {
            const appWindow = tauri.window.appWindow;
            if (appWindow) {
                appWindow.setTitle(`Projection Church - ${fileName}`);
            }
        } else {
            document.title = `Projection Church - ${fileName}`;
        }
    }
};
