# 🗄️ Solução Banco de Dados Local (SQLite)

Felipe, configurei o **SQLite** no seu projeto Tauri conforme a recomendação do Gemini. Agora você tem um banco de dados real e robusto para salvar múltiplos projetos.

## 1. O Que Foi Feito

1.  **Plugin Instalado:** Adicionei `tauri-plugin-sql` (com suporte a SQLite) no `Cargo.toml` e registrei no `main.rs`.
2.  **Backend Configurado:** O Tauri agora sabe gerenciar o arquivo `projects.db` na pasta AppData do usuário.
3.  **Biblioteca Criada:** Criei o arquivo `lib/db.ts` para facilitar o uso. Você não precisa escrever SQL na mão toda hora.

## 2. Como Usar no Seu Código

Você pode importar o `DB` de qualquer lugar no frontend (Editor).

### Salvar um Projeto

```typescript
import { DB } from '../lib/db';

async function salvarMeuProjeto() {
    const dadosDoProjeto = {
        cor: 'azul',
        texto: 'Olá Mundo',
        slides: [1, 2, 3]
    };

    // Salva novo projeto
    const id = await DB.saveProject("Culto Domingo", dadosDoProjeto);
    console.log("Projeto salvo com ID:", id);
    
    // Para ATUALIZAR um projeto existente, passe o ID no final
    // await DB.saveProject("Culto Domingo Editado", dadosDoProjeto, id);
}
```

### Carregar Projetos

```typescript
import { DB } from '../lib/db';

async function carregarLista() {
    // Busca todos os projetos salvos (ID e Nome)
    const lista = await DB.listProjects();
    console.log("Projetos salvos:", lista);
    
    if (lista.length > 0) {
        // Carrega os dados COMPLETOS do primeiro projeto
        const projetoCompleto = await DB.getProject(lista[0].id);
        console.log("Configurações carregadas:", projetoCompleto.data);
    }
}
```

## 3. Benefícios

*   **Persistência Real:** Os dados ficam em um arquivo `.db` seguro, não dependem da memória ou localStorage volátil.
*   **Múltiplos Projetos:** Você pode criar o "Projeto 1", "Projeto 2", "Vigília", etc., e listar todos eles.
*   **Performance:** SQLite é extremamente rápido e eficiente.

## 4. O Problema do Cache (Projeção)

Lembre-se: A Janela de Projeção (se aberta no Chrome) **NÃO TEM ACESSO** ao banco de dados diretamente (pois o Chrome não roda plugins Tauri).

Por isso, mantive a **Solução V24** ativa:
*   O Editor salva no Banco (e notifica o servidor local).
*   O Editor envia o sinal de "Reload".
*   O Chrome recarrega a página.

Assim você tem o melhor dos dois mundos: **Persistência Profissional (SQLite)** no Editor e **Sincronização Confiável** na Projeção. 🚀
