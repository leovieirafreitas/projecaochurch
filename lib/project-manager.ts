
const APP_DIR = 'ChamaChurch';
const PROJECTS_DIR = 'Projetos';
const RECENTS_KEY = 'recent_projects';

// Helper seguro para importar Tauri apenas quando disponível
const getTauriApi = async () => {
    if (typeof window === 'undefined' || !(window as any).__TAURI__) {
        console.warn('Tauri API não disponível neste ambiente.');
        return null;
    }
    try {
        const dialog = await import('@tauri-apps/api/dialog');
        const fs = await import('@tauri-apps/api/fs');
        const path = await import('@tauri-apps/api/path');
        const shell = await import('@tauri-apps/api/shell');
        return { dialog, fs, path, shell };
    } catch (e) {
        console.error('Falha ao carregar módulos Tauri:', e);
        return null;
    }
};

export const ProjectManager = {
    async getProjectsDir() {
        const tauri = await getTauriApi();
        if (!tauri) return null;

        try {
            const docDir = await tauri.path.documentDir();
            const path = await tauri.path.join(docDir, APP_DIR, PROJECTS_DIR);

            // Garantir que existe
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
        const tauri = await getTauriApi();
        if (!tauri) return;

        const dir = await this.getProjectsDir();
        if (dir) {
            await tauri.shell.open(dir);
        }
    },

    async saveProject(data: any = null) {
        const tauri = await getTauriApi();
        if (!tauri) {
            alert('Esta funcionalidade só está disponível no aplicativo Desktop.');
            return;
        }

        try {
            // Se não passar dados, pega do estado atual (simulado aqui, idealmente passaria como arg)
            if (!data) {
                // Tenta capturar do localStorage como backup
                const settings = localStorage.getItem('bible_settings');
                const version = localStorage.getItem('bible_version');
                data = {
                    version: version || 'NVI',
                    settings: settings ? JSON.parse(settings) : {},
                    timestamp: new Date().toISOString()
                };
            }

            const defaultPath = await this.getProjectsDir();

            const filePath = await tauri.dialog.save({
                title: 'Salvar Projeto Chama Church',
                defaultPath: defaultPath ? `${defaultPath}/culto.chama` : 'culto.chama',
                filters: [{
                    name: 'Projeto Chama Church',
                    extensions: ['chama']
                }]
            });

            if (filePath) {
                await tauri.fs.writeTextFile(filePath, JSON.stringify(data, null, 2));

                // Salvar como recente
                this.addToRecents(filePath);

                // Atualizar título da janela (opcional)
                const appWindow = (await import('@tauri-apps/api/window')).appWindow;
                const fileName = filePath.split(/[\\/]/).pop();
                await appWindow.setTitle(`Projection Church - ${fileName}`);
                localStorage.setItem('current_project_path', filePath);

                return filePath;
            }
        } catch (e) {
            console.error('Erro ao salvar:', e);
            alert('Erro ao salvar projeto.');
        }
        return null;
    },

    async openProject() {
        const tauri = await getTauriApi();
        if (!tauri) {
            alert('Esta funcionalidade só está disponível no aplicativo Desktop.');
            return;
        }

        try {
            const defaultPath = await this.getProjectsDir();

            const selected = await tauri.dialog.open({
                multiple: false,
                directory: false,
                defaultPath: defaultPath || undefined,
                filters: [{
                    name: 'Projeto Chama Church',
                    extensions: ['chama']
                }]
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
        const tauri = await getTauriApi();
        if (!tauri) return null;

        try {
            if (await tauri.fs.exists(path)) {
                const content = await tauri.fs.readTextFile(path);
                const data = JSON.parse(content);

                // APLICAR DADOS (Lógica Centralizada)
                // Aqui salvamos no localStorage e recarregamos/notificamos a UI
                if (data.settings) {
                    localStorage.setItem('bible_settings', JSON.stringify(data.settings));
                }
                if (data.version) {
                    localStorage.setItem('bible_version', data.version);
                }

                // Atualizar Recentes e Título
                this.addToRecents(path);
                localStorage.setItem('current_project_path', path);

                const appWindow = (await import('@tauri-apps/api/window')).appWindow;
                const fileName = path.split(/[\\/]/).pop();
                await appWindow.setTitle(`Projection Church - ${fileName}`);

                // Forçar recarga ou emitir evento
                window.location.reload();

                return data;
            }
        } catch (e) {
            console.error('Erro ao carregar arquivo:', e);
            alert('Arquivo corrompido ou inválido.');
        }
        return null;
    },

    addToRecents(path: string) {
        try {
            let recents = this.getRecents();
            // Remove se já existir para mover pro topo
            recents = recents.filter(p => p !== path);
            recents.unshift(path);
            // Manter apenas 10
            recents = recents.slice(0, 10);
            localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));

            // Disparar evento customizado para atualizar Menu
            window.dispatchEvent(new Event('recents-updated'));
        } catch (e) { }
    },

    getRecents(): string[] {
        try {
            const data = localStorage.getItem(RECENTS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }
};
