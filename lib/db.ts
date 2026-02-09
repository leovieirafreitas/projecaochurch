import Database from "@tauri-apps/plugin-sql";

// Singleton Database instance
let dbInstance: Database | null = null;

export const DB = {
    async connect() {
        if (dbInstance) return dbInstance;
        try {
            // "sqlite:projects.db" cria o arquivo no AppData do usuário
            dbInstance = await Database.load("sqlite:projects.db");
            return dbInstance;
        } catch (e) {
            console.error("Falha ao conectar no SQLite:", e);
            throw e;
        }
    },

    async init() {
        try {
            const db = await this.connect();
            await db.execute(`
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    data TEXT NOT NULL,
                    updated_at INTEGER
                )
            `);
            console.log("Banco de Dados (SQLite) inicializado com sucesso.");
        } catch (e) {
            console.error("Erro ao inicializar DB:", e);
        }
    },

    // Salva um projeto. Se id for fornecido, atualiza. Senão, cria novo.
    // Retorna o ID do projeto salvo.
    async saveProject(name: string, data: any, id?: number) {
        const db = await this.connect();
        const json = JSON.stringify(data);
        const now = Date.now();

        if (id) {
            await db.execute(
                `UPDATE projects SET name = $1, data = $2, updated_at = $3 WHERE id = $4`,
                [name, json, now, id]
            );
            console.log(`Projeto ${id} atualizado no DB.`);
            return id;
        } else {
            const result = await db.execute(
                `INSERT INTO projects (name, data, updated_at) VALUES ($1, $2, $3)`,
                [name, json, now]
            );
            console.log(`Novo projeto criado no DB.`);
            return result.lastInsertId;
        }
    },

    // Carrega um projeto pelo ID
    async getProject(id: number) {
        const db = await this.connect();
        const result = await db.select<any[]>("SELECT * FROM projects WHERE id = $1", [id]);
        if (result.length > 0) {
            try {
                return {
                    ...result[0],
                    data: JSON.parse(result[0].data)
                };
            } catch (e) {
                console.error("Erro ao parsear dados do projeto do DB:", e);
                return null;
            }
        }
        return null;
    },

    // Lista todos os projetos (apenas metadados para menu)
    async listProjects() {
        const db = await this.connect();
        return await db.select<any[]>("SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC");
    },

    // Deleta projeto
    async deleteProject(id: number) {
        const db = await this.connect();
        await db.execute("DELETE FROM projects WHERE id = $1", [id]);
    }
};
