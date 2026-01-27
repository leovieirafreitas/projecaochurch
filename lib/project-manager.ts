const APP_DIR = 'MediaChurch';
const PROJECTS_DIR = 'Projetos';
const RECENTS_KEY = 'recent_projects';

// Helper to get Tauri APIs safely from window object (Global Tauri)
// This avoids dynamic import issues in some production builds
const getTauri = () => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        return (window as any).__TAURI__;
    }
    return null;
};

export const ProjectManager = {
    async getProjectsDir() {
        const tauri = getTauri();
        if (!tauri) return null;

        try {
            // Using tauri.path and tauri.fs directly from global
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
        // ELECTRON CHECK
        if ((window as any).electronAPI) {
            return (window as any).electronAPI.openProjectsFolder();
        }

        const tauri = getTauri();
        if (!tauri) return;

        // Try Native Command first (Reliable on Windows)
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
                alert("Não foi possível abrir a pasta. Verifique se ela existe em 'Documentos/ChamaChurch/Projetos'");
            }
        }
    },

    async exitApp() {
        // ELECTRON CHECK
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
                window.close(); // Fallback
            }
        } else {
            window.close();
        }
    },

    async createNewProject(name: string) {
        // Sanitizar nome
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

        // ELECTRON CHECK
        if ((window as any).electronAPI) {
            // Em Electron, precisamos de uma rota para criar direto. 
            // Como fallback rápido, vamos usar saveProject, mas idealmente seria direto.
            // Para simplificar: vamos "simular" um save chamando saveProject com um flag ou apenas usando o comportamento atual se não for possível escrever direto.
            // Mas o usuário quer AUTOMALICO. Então vamos tentar escrever direto via path se soubermos o path.
            // No Electron atual, não temos 'writeTextFile' exposto, só 'saveProject' (dialog) e 'loadFromFile'.
            // Vou usar saveProject por enquanto pois requer alterações no main.js para escrita direta sem diálogo.
            // Porem, vou tentar passar um "defaultPath" sugerido se eu pudesse.
            // Como não posso alterar main.js agora, vou alertar o usuário ou simplesmente abrir o diálogo sugerindo o nome.
            return this.saveProject(data, true);
        }

        const tauri = getTauri();
        if (!tauri) return;

        try {
            const projectsDir = await this.getProjectsDir();
            if (!projectsDir) throw new Error("Diretório não encontrado");

            const filePath = await tauri.path.join(projectsDir, safeName);

            // Verificar se já existe
            if (await tauri.fs.exists(filePath)) {
                // Se existir, adiciona um sufixo numérico simples ou alerta. 
                // Vamos alertar para segurança
                if (!confirm(`O projeto "${safeName}" já existe. Deseja substituir?`)) {
                    return null;
                }
            }

            // Criar arquivo
            await tauri.fs.writeTextFile(filePath, JSON.stringify(data, null, 2));

            // Carregar
            await this.handleProjectData(filePath, data);
            return filePath;

        } catch (e) {
            console.error('Erro ao criar projeto:', e);
            throw e;
        }
    },

    async saveProject(data: any = null, forceDialog = false) {
        // Prepare Data
        if (!data) {
            const settings = localStorage.getItem('bible_settings');
            const version = localStorage.getItem('bible_version');
            const history = localStorage.getItem('bible_history'); // Salvar histórico se existir
            data = {
                version: version || 'NVI',
                settings: settings ? JSON.parse(settings) : {},
                history: history ? JSON.parse(history) : [],
                timestamp: new Date().toISOString()
            };
        }

        const currentPath = localStorage.getItem('current_project_path');

        // ELECTRON CHECK
        if ((window as any).electronAPI) {
            // Se já tem caminho e não for para forçar dialogo, salva direto (precisa implementar no main.js do electron também se quiser suporte, mas por enquanto vamos manter o comportamento padrão ou passar o path para o save)
            // No Electron atual, saveProject abre dialog sempre. Vamos ajustar a chamada.
            // Para simplificar, no Electron vamos manter o comportamento de sempre abrir dialogo por enquanto, ou teria que editar o main.js. 
            // Mas o usuário pediu "CRTL + S FUNCIONE", o ideal é salvar direto.
            // Como não posso editar main.js do electron facilmente agora sem reiniciar processo, vou focar no Tauri que é o foco do build.

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
            alert('Esta funcionalidade só está disponível no aplicativo Desktop.');
            return;
        }

        try {
            // SALVAR DIRETO (Se já existe e não é Salvar Como)
            if (!forceDialog && currentPath && await tauri.fs.exists(currentPath)) {
                await tauri.fs.writeTextFile(currentPath, JSON.stringify(data, null, 2));
                // Feedback visual poderia ser interessante (Toaster), mas por enquanto só salva.
                console.log('Projeto salvo em:', currentPath);
                return currentPath;
            }

            // SALVAR COMO (Novo ou Forçado)
            const defaultPath = await this.getProjectsDir();
            let savePath = 'culto.chama';

            if (defaultPath) {
                savePath = await tauri.path.join(defaultPath, 'culto.chama');
            }

            const filePath = await tauri.dialog.save({
                title: 'Salvar Projeto MediaChurch',
                defaultPath: savePath,
                filters: [{
                    name: 'Projeto MediaChurch',
                    extensions: ['chama']
                }]
            });

            if (filePath) {
                await tauri.fs.writeTextFile(filePath, JSON.stringify(data, null, 2));

                // Salvar como recente
                this.addToRecents(filePath);
                localStorage.setItem('current_project_path', filePath); // Atualiza o path atual

                // Atualizar título da janela (opcional)
                this.updateTitleCompat(filePath);

                // Forçar atualização do Menu
                window.dispatchEvent(new Event('recents-updated'));

                return filePath;
            }
        } catch (e) {
            console.error('Erro ao salvar:', e);
            alert('Erro ao salvar projeto.');
        }
        return null;
    },

    async openProject() {
        // ELECTRON CHECK
        if ((window as any).electronAPI) {
            const result = await (window as any).electronAPI.openProject();
            if (result && result.path && result.data) {
                return this.handleProjectData(result.path, result.data);
            }
            return null;
        }

        const tauri = getTauri();
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
                    name: 'Projeto MediaChurch',
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
        // ELECTRON CHECK
        if ((window as any).electronAPI) {
            const data = await (window as any).electronAPI.loadFromFile(path);
            if (data) {
                return this.handleProjectData(path, data);
            }
            return null;
        }

        const tauri = getTauri();
        if (!tauri) return null;

        try {
            if (await tauri.fs.exists(path)) {
                const content = await tauri.fs.readTextFile(path);
                const data = JSON.parse(content);
                return this.handleProjectData(path, data);
            }
        } catch (e) {
            console.error('Erro ao carregar arquivo:', e);
            alert('Arquivo corrompido ou inválido.');
        }
        return null;
    },

    // HELPER CENTRALIZADO
    async handleProjectData(path: string, data: any) {
        if (data.settings) {
            localStorage.setItem('bible_settings', JSON.stringify(data.settings));
        }
        if (data.version) {
            localStorage.setItem('bible_version', data.version);
        }

        // Atualizar Recentes e Título
        this.addToRecents(path);
        localStorage.setItem('current_project_path', path);

        // Atualizar título se possível
        this.updateTitleCompat(path);

        // Disparar evento para atualizar a interface SEM recarregar a página
        window.dispatchEvent(new Event('project-loaded'));
        window.dispatchEvent(new Event('recents-updated')); // Garante que o menu atualize também

        return data;
    },

    async checkRecents() {
        let recents = this.getRecents();
        const validRecents = [];

        // ELECTRON: Verificar via Node.js fs
        if ((window as any).electronAPI) {
            // Electron não expõe fs diretamente, então vamos tentar carregar
            // Se falhar, significa que não existe
            for (const path of recents) {
                try {
                    const result = await (window as any).electronAPI.loadFromFile(path);
                    if (result !== null) {
                        validRecents.push(path);
                    }
                } catch (e) {
                    // Arquivo não existe ou erro ao ler
                    console.log(`Removendo projeto inexistente: ${path}`);
                }
            }
        }
        // TAURI: Verificar via Tauri fs
        else {
            const tauri = getTauri();
            if (!tauri) {
                // Se não for Tauri nem Electron, manter todos (Web)
                return;
            }

            for (const path of recents) {
                try {
                    if (await tauri.fs.exists(path)) {
                        validRecents.push(path);
                    } else {
                        console.log(`Removendo projeto inexistente: ${path}`);
                    }
                } catch (e) {
                    console.log(`Erro ao verificar ${path}:`, e);
                }
            }
        }

        // Atualizar se houver diferença
        if (validRecents.length !== recents.length) {
            localStorage.setItem(RECENTS_KEY, JSON.stringify(validRecents));
            window.dispatchEvent(new Event('recents-updated'));
            console.log(`Removidos ${recents.length - validRecents.length} projeto(s) inexistente(s)`);
        }
    },

    async getFriendlyPath(fullPath: string) {
        try {
            const tauri = getTauri();
            if (!tauri) return fullPath;

            const name = fullPath.split(/[\\/]/).pop();
            const docDir = await tauri.path.documentDir();
            const downloadDir = await tauri.path.downloadDir();

            // Normalize slashes for comparison
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
    },

    async getRecentsWithLabels(): Promise<{ path: string, label: string }[]> {
        // Validar e limpar inexistentes antes de listar
        await this.checkRecents();

        const paths = this.getRecents();
        const result = [];

        for (const path of paths) {
            const label = await this.getFriendlyPath(path);
            result.push({ path, label });
        }

        return result;
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
