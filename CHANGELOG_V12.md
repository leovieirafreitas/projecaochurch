# Changelog Versão V12 (Final Stable)

## Correções Críticas
### 1. Carregamento de Projetos (Correção de "Race Condition")
**Sintoma:** Ao clicar em um projeto recente, o sistema parecia carregar, mas mantinha o projeto anterior aberto ou mesclava as configurações.
**Causa:** O sistema de Salvamento Automático (Auto-Save) rodava milissegundos após o início do carregamento, salvando o estado antigo por cima do novo estado que estava sendo carregado.
**Solução:** Implementado um bloqueio semafórico. Quando um projeto começa a carregar, o Auto-Save é bloqueado por 1.5 segundos, garantindo que o novo projeto seja estabelecido antes de qualquer novo salvamento.

### 2. Limpeza de Memória (Isolamento de Projetos)
**Sintoma:** Imagens de fundo de um projeto aparecendo em outro ("vazamento").
**Solução:** Implementada limpeza radical (`localStorage.removeItem` e `StorageHelper.removeBackground`) antes de injetar os dados do novo projeto. Isso garante que não haja resquícios do projeto anterior.

### 3. Feedback Visual
**Novo Recurso:** Adicionado sistema de notificações ("Toasts").
- **Carregando...** (Azul)
- **Projeto Carregado** (Verde)
- **Erro** (Vermelho)
- **Salvando...** (Azul) -> **Salvo!** (Verde) ao usar Ctrl+S.

## Como Validar
Simplesmente instale a V12 e use o sistema de "Projetos Recentes". A troca será instantânea e confirmada pelo popup verde.
