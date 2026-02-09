# 🔧 Solução V13: Correção do Erro de Cota (QuotaExceededError)

Felipe, o print que você mandou (`QuotaExceededError`) foi fundamental para desvendar o mistério.

**O Problema Real (Descoberto pelo seu Print):**
1. O navegador tem um limite rígido de **5MB** para o `localStorage` (onde guardamos as configs).
2. Seus projetos (`.chama`) estavam contendo imagens grandes "embutidas".
3. Quando você tentava abrir o Projeto 02, o sistema tentava escrever essas configurações na memória.
4. **O limite estourava** (Erro Vermelho), e o código **TRAVAVA** antes de conseguir mandar o sinal para atualizar a tela.
5. Por isso parecia que "não mudava nada": o processo morria no meio do caminho.

**A Solução V13:**
Implementei uma "Cirurgia de Dados" no momento do carregamento:
1. O sistema agora detecta se existe uma imagem pesada no arquivo.
2. Se existir, ele a **REMOVE** do pacote que vai para a memória limitada (localStorage).
3. E a salva com segurança no **IndexedDB** (Banco de dados interno que aguenta Gigabytes).

**Resultado:**
- Fim do erro vermelho de Cota.
- Fim do travamento na troca de projetos.
- A troca de projetos agora será fluida e imediata, pois a memória não vai mais estourar.

**Não perca tempo com a V12.** Instale direto a **V13**.
