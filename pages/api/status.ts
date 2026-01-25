
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: any, res: any) {
    // Definir CORS para funcionar em iframes/cross-origin se necessario
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            // Recebe o estado completo do Editor e salva no Banco
            // Isso persiste o estado "live" para qualquer cliente (vMix, Celular) ler
            const currentData = req.body;

            const { error } = await supabase
                .from('projection_state')
                .update({
                    data: currentData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (error) {
                console.error("Supabase Error:", error);
                throw error;
            }

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error("Erro ao salvar status no DB:", error);
            return res.status(500).json({ error: 'Falha ao salvar status' });
        }
    } else {
        // GET - vMix/Projeção lê daqui
        try {
            const { data, error } = await supabase
                .from('projection_state')
                .select('data')
                .eq('id', 1)
                .single();

            if (error) {
                // Se não achar (ainda não inicializado?), retorna default
                if (error.code === 'PGRST116') {
                    return res.status(200).json({ text: '' });
                }
                throw error;
            }

            // Retorna o objeto JSON que está dentro da coluna 'data'
            return res.status(200).json(data?.data || {});
        } catch (error) {
            console.error("Erro ao ler status do DB:", error);
            return res.status(500).json({ error: 'Falha ao ler status' });
        }
    }
}
