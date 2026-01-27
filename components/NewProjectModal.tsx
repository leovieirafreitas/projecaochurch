import React, { useState } from 'react';
import { ProjectManager } from '../lib/project-manager';

interface Props {
    onClose: () => void;
}

export default function NewProjectModal({ onClose }: Props) {
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            await ProjectManager.createNewProject(name.trim());
            onClose();
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao criar projeto: ${error.message || error}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#222] border border-[#444] rounded-lg shadow-2xl w-full max-w-md p-6 text-white relative">

                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="text-blue-500"></span> Novo Projeto
                </h2>

                <form onSubmit={handleCreate}>
                    <div className="mb-6">
                        <label className="block text-xs uppercase font-bold text-gray-400 mb-2">Nome do Projeto</label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Culto Domingo"
                            className="w-full bg-black/40 border border-[#444] rounded p-3 text-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
                        />
                        <p className="text-[10px] text-gray-500 mt-2">
                            Será salvo em: Documents/MediaChurch/Projetos
                        </p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded text-sm hover:bg-[#333] transition-colors text-gray-300"
                            disabled={isLoading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim() || isLoading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-bold shadow-lg transition-all"
                        >
                            {isLoading ? 'Criando...' : 'Criar Projeto'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
