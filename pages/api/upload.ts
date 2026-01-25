
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
    api: {
        bodyParser: false, // Desativa o bodyParser padrão para suportar upload de arquivos
    },
};

export default async function handler(req: any, res: any) {
    if (req.method === 'POST') {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');

        // Garante que a pasta existe
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const form = new IncomingForm({
            uploadDir: uploadDir,
            keepExtensions: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB limite
        });

        form.parse(req, (err, fields, files) => {
            if (err) {
                console.error("Erro no upload:", err);
                return res.status(500).json({ error: 'Erro ao processar imagem' });
            }

            // Pega o arquivo enviado (pode vir como array ou objeto simples dependendo da versão do formidable)
            const file = Array.isArray(files.file) ? files.file[0] : files.file;

            if (!file) {
                return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            }

            // Retorna URL pública
            const fileName = path.basename(file.filepath);
            const publicUrl = `/uploads/${fileName}`;

            res.status(200).json({ url: publicUrl });
        });
    } else {
        res.status(405).json({ error: 'Método não permitido' });
    }
}
