# 📊 RELATÓRIO TÉCNICO: COMO O SUPABASE CONVERSA COM SEU SISTEMA (Projection Church)

Este relatório detalha exatamente como o seu aplicativo interage com o Supabase, baseado na análise profunda do código (`useProjectionSync.ts`) e dos logs de tráfego.

## 1. O Papel do Supabase
O Supabase funciona como o **Cérebro Central** na nuvem. Ele guarda o estado atual da projeção (qual versículo está na tela) para que todos os dispositivos (PC, Celular, Tablet) vejam a mesma coisa.

---

## 2. Os 3 Canais de Comunicação

O sistema usa 3 formas diferentes de conversar com o Supabase. Entenda cada uma:

### 📡 CANAL 1: Leitura Inicial (REST GET)
**O que faz:** Assim que você abre o aplicativo (ou o projetor), ele pergunta pro Supabase: *"Qual é o versículo que está na tela agora?"* para não começar com a tela preta.
- **Técnica:** Requisição HTTP `GET` (via tabela `projection_state`).
- **Frequência Esperada:** Apenas 1 vez, quando o app abre.
- **🚨 ONDE ESTAVA O PROBLEMA:** Devido a um erro de código (loop de renderização), o app estava fazendo essa pergunta **20 vezes por segundo**, a cada frame que a tela piscava. Isso gerou os 8GB de consumo. **(CORRIGIDO NA v0.2.36)**.

### ⚡ CANAL 2: Tempo Real (Websockets / Realtime)
**O que faz:** O app mantém uma linha telefônica aberta (socket) com o Supabase.
- **Como funciona:** O app diz *"Supabase, me avise se algo mudar"*. O app fica quieto.
- **Tráfego:** Muito baixo. Só gasta dados quando você clica em um versículo novo.
- **Status:** Funcionando perfeitamente. É isso que faz a troca ser instantânea.

### 📤 CANAL 3: Envio de Comandos (REST UPDATE)
**O que faz:** Quando você (no celular ou PC) clica em um versículo.
- **Técnica:** Requisição HTTP `PATCH` ou `UPDATE`.
- **Como funciona:** O app diz *"Supabase, anote aí: agora é João 3:16"*.
- **Custo:** Mínimo. Só acontece quando você clica.

---

## 3. Resumo do Diagnóstico (O "Bug do Egress")

Identifiquei nos logs que o **CANAL 1** estava descontrolado.
- **Sintoma:** Logs infinitos de `GET /rest/v1/projection_state` (Leitura).
- **Causa:** O componente de React recriava a conexão toda vez que recebia um dado, criando um ciclo vicioso:
  `Recebe Dado` -> `Atualiza Tela` -> `Reinicia Conexão` -> `Baixa Dado de Novo` -> `Repete`.

---

## 4. Como está agora (v0.2.36)

Na versão 0.2.36, apliquei uma **Trava de Referência (useRef)** no código.
1. O App conecta no Supabase.
2. Baixa o dado inicial (1 vez).
3. **TRAVA.** Mesmo que a tela atualize mil vezes, ele **NÃO** baixa o dado inicial de novo.
4. Fica apenas ouvindo pelo Canal 2 (Tempo Real), que é super leve.

**Conclusão:** O sistema agora fala com o Supabase apenas o estritamente necessário. O consumo gigante de dados **FOI ELIMINADO**.

---
*Relatório gerado via análise de código (hooks/useProjectionSync.ts) e Logs de Egress do Supabase.*
