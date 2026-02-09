# 📚 ARQUITETURA DO SISTEMA - PROJECTION CHURCH

**Versão:** V9 (Final Estável)  
**Data:** 29/01/2026  
**Objetivo:** Documentação completa para manutenção e evolução do sistema

---

## 🎯 VISÃO GERAL

Sistema de projeção de bíblia e louvor para igrejas, com suporte a:
- **Desktop** (Windows) - Editor principal
- **Projeção** (Tela secundária ou navegador)
- **Mobile** (Controle remoto via celular)
- **Modo Offline** (100% funcional sem internet)

---

## 🏗️ ARQUITETURA TÉCNICA

### Stack Principal
- **Frontend:** Next.js (React) + TypeScript
- **Backend Local:** Actix Web (Rust) - Porta 4523
- **Desktop:** Tauri v1.6 (Rust + WebView)
- **Banco de Dados Local:** IndexedDB (navegador)
- **Sincronização Remota (Opcional):** Supabase Realtime

### Estrutura de Diretórios
```
biblia-online/
├── components/          # Componentes React
│   ├── BibleProjection.tsx    # Editor de projeção
│   ├── BibleSearch.tsx        # Busca e seleção de versículos
│   ├── MenuBar.tsx            # Menu principal
│   └── NewProjectModal.tsx    # Modal de novo projeto
├── hooks/
│   └── useProjectionSync.ts   # Sincronização de estado
├── lib/
│   ├── project-manager.ts     # Gerenciamento de projetos .chama
│   ├── storage-helper.ts      # IndexedDB (imagens grandes)
│   └── local-bible-manager.ts # API de bíblias offline
├── pages/
│   ├── index.tsx              # Página principal (editor)
│   ├── projection.tsx         # Tela de projeção
│   └── remote.tsx             # Controle remoto mobile
├── src-tauri/
│   └── src/
│       └── main.rs            # Backend Rust (Actix + Tauri)
└── public/
    └── out/                   # Build estático do Next.js
```

---

## 🔄 FLUXO DE SINCRONIZAÇÃO

### 1. Editor → Projeção (Desktop)
```
Editor (BibleSearch.tsx)
  ↓ syncToApi()
  ↓ [Otimiza imagem se Base64 grande]
  ↓ invoke('save_image_to_app_data') → Salva em uploads/
  ↓ POST http://localhost:4523/api/status
  ↓
Actix Server (main.rs)
  ↓ Salva em AppData/status.json
  ↓
Projeção (projection.tsx)
  ↓ Polling GET http://localhost:4523/api/status
  ↓ Renderiza verso + imagem
```

### 2. Editor → Mobile (Rede Local)
```
Mobile (remote.tsx)
  ↓ Acessa http://192.168.x.x:4523/remote
  ↓ Polling GET http://192.168.x.x:4523/api/status
  ↓ [processUrl() ajusta localhost → IP real]
  ↓ Renderiza verso + imagem
```

### 3. Fallbacks de Sincronização (Ordem de Prioridade)
1. **BroadcastChannel** (mesma máquina, instantâneo)
2. **Polling Local** (http://localhost:4523, confiável)
3. **Supabase Realtime** (internet, opcional)

---

## 💾 SISTEMA DE PROJETOS (.chama)

### Estrutura do Arquivo .chama
```json
{
  "version": "NVI",
  "settings": {
    "fontSize": 30,
    "color": "#ffffff",
    "backgroundImage": "http://localhost:4523/uploads/1234_bg.png",
    "textAlign": "center",
    "fontFamily": "Inter, sans-serif"
  },
  "history": [],
  "timestamp": "2026-01-29T19:00:00.000Z"
}
```

### Ciclo de Vida do Projeto

#### Salvar Projeto (Ctrl+S)
```typescript
// lib/project-manager.ts - saveProject()
1. Lê localStorage('bible_settings')
2. Injeta backgroundImage do IndexedDB se não estiver no settings
3. Gera JSON com todas as configurações
4. Salva em Documents/MediaChurch/Projetos/nome.chama
5. Atualiza current_project_path
```

#### Carregar Projeto
```typescript
// lib/project-manager.ts - handleProjectData()
1. Lê arquivo .chama
2. Atualiza localStorage('bible_settings')
3. **CRÍTICO:** Sincroniza IndexedDB com backgroundImage do projeto
   - Se projeto tem imagem → StorageHelper.setBackground()
   - Se projeto não tem → StorageHelper.removeBackground()
4. Dispara evento 'project-loaded'
5. BibleProjection.tsx recarrega configurações
```

**⚠️ IMPORTANTE:** O passo 3 é ESSENCIAL para isolamento de projetos. Sem ele, a imagem do projeto anterior persiste.

---

## 🖼️ SISTEMA DE IMAGENS

### Problema Original
- Imagens Base64 (5MB+) eram enviadas pela rede a cada atualização
- Causava travamentos, "tela verde" e erro `ERR_INSUFFICIENT_RESOURCES`

### Solução Implementada (V9)

#### Upload Local (Desktop)
```typescript
// components/BibleSearch.tsx - syncToApi()
if (isTauri && backgroundImage.startsWith('data:')) {
  // 1. Detecta Base64 grande
  // 2. Chama Rust backend
  const url = await invoke('save_image_to_app_data', {
    filename: 'projection_bg.png',
    base64Data: backgroundImage
  });
  // 3. Substitui Base64 por URL
  styleToSync.backgroundImage = url; // http://localhost:4523/uploads/123_bg.png
}
```

#### Backend Rust
```rust
// src-tauri/src/main.rs - save_image_to_app_data()
1. Remove prefixo "data:image/png;base64," se existir
2. Decode Base64 → bytes
3. Salva em AppData/Roaming/Projection Church/uploads/timestamp_filename.png
4. Retorna URL: http://localhost:4523/uploads/timestamp_filename.png
```

#### Servidor de Arquivos
```rust
// src-tauri/src/main.rs - HttpServer
.service(af::Files::new("/uploads", app_data_dir.join("uploads")))
```

#### Resolução de URL no Mobile
```typescript
// pages/projection.tsx - processUrl()
const processUrl = (url: string) => {
  if (url.includes('localhost:4523') && window.location.hostname !== 'localhost') {
    return url.replace('localhost', window.location.hostname);
  }
  return url;
};
```

---

## 📖 SISTEMA DE BÍBLIAS OFFLINE

### Estrutura de Arquivos
```
Documents/CHAMA_ONLINE_BIBLES/
└── NVI/
    ├── metadata.json
    ├── GEN/
    │   ├── 1.json
    │   ├── 2.json
    │   └── ...
    └── EXO/
        └── ...
```

### Locais de Busca (Ordem)
```rust
// src-tauri/src/main.rs - get_bible_source_paths()
1. Documents/CHAMA_ONLINE_BIBLES (bíblias baixadas)
2. LocalAppData/Projection Church/resources/bibles
3. resources/bibles (dev/portable)
4. [EXECUTÁVEL]/resources/bibles (instalação MSI) ← CRÍTICO para mobile
5. [EXECUTÁVEL]/bibles
```

### API Endpoints
- `GET /api/offline/versions` → Lista versões disponíveis
- `GET /api/offline/books/{version}` → Lista livros
- `GET /api/offline/chapters/{version}/{book}` → Lista capítulos
- `GET /api/offline/chapter/{version}/{book}/{chapter}` → Retorna JSON do capítulo

---

## 🌐 MODO OFFLINE (Tolerância a Falhas)

### Problema Original
- Timeout do Supabase travava inicialização
- Erros 500/57014 poluíam console

### Solução V9
```typescript
// hooks/useProjectionSync.ts
1. Tenta carregar estado inicial do Supabase
2. Se falhar (timeout/500):
   - Loga warning silencioso
   - Ignora erro (não trava)
3. Tenta conectar Realtime
4. Se falhar (CHANNEL_ERROR):
   - Remove canal
   - Opera 100% em modo local
5. Polling local continua funcionando normalmente
```

---

## 🔧 COMANDOS IMPORTANTES

### Desenvolvimento
```bash
npm run dev          # Next.js dev (porta 3000)
npm run tauri dev    # Tauri dev (porta 4524, Actix)
```

### Build Produção
```bash
npm run tauri build  # Gera MSI + EXE em src-tauri/target/release/bundle/
```

### Estrutura de Portas
- **Dev:** Actix na porta 4524
- **Produção:** Actix na porta 4523
- **Next.js Dev:** Porta 3000 (apenas desenvolvimento)

---

## 🐛 PROBLEMAS CONHECIDOS E SOLUÇÕES

### 1. Imagem 404 no Mobile
**Causa:** Pasta `uploads` não existia na inicialização  
**Solução:** Criação automática em `main.rs` linha 526-528

### 2. Projetos Compartilham Imagem
**Causa:** IndexedDB não era limpo ao trocar projeto  
**Solução:** `project-manager.ts` linha 309-316 (sync com StorageHelper)

### 3. Bíblias Sumidas no Mobile
**Causa:** Servidor só buscava em Documents  
**Solução:** `main.rs` linha 145-151 (busca no diretório do executável)

### 4. Tela Verde na Projeção
**Causa:** Base64 pesado travava rede  
**Solução:** Upload local + URL otimizada (`BibleSearch.tsx` linha 143-174)

### 5. App Trava sem Internet
**Causa:** Supabase timeout bloqueava inicialização  
**Solução:** `useProjectionSync.ts` linha 32-45 (tratamento de erro)

---

## 📝 CHECKLIST DE TESTES

### Antes de Cada Release
- [ ] Criar Projeto A com fundo azul → Salvar
- [ ] Criar Projeto B com fundo vermelho → Salvar
- [ ] Abrir Projeto A → Verificar fundo azul
- [ ] Conectar mobile → Verificar lista de bíblias nativas
- [ ] Adicionar imagem → Verificar carregamento sem 404
- [ ] Desconectar internet → Verificar funcionamento offline
- [ ] Projetar verso → Verificar sincronia desktop/mobile

---

## 🚀 PRÓXIMAS MELHORIAS (Backlog)

1. **Sistema de Temas Persistentes**
   - Salvar temas customizados no banco
   - Galeria de temas compartilhável

2. **Histórico de Versículos**
   - Navegação rápida por versículos recentes
   - Favoritos

3. **Suporte a Vídeos de Fundo**
   - Upload e reprodução de vídeos
   - Otimização de performance

4. **Multi-idioma**
   - Interface em inglês/espanhol
   - Bíblias em outros idiomas

---

## 📞 CONTATO E SUPORTE

**Desenvolvedor:** Felipe Barroso  
**Projeto:** CHAMA_ONLINE  
**Última Atualização:** V9 - 29/01/2026

---

## 🔐 VARIÁVEIS DE AMBIENTE (Opcional)

```env
# Supabase (Opcional - apenas para sync remoto via internet)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica
```

**Nota:** O sistema funciona 100% offline sem essas variáveis.

---

**FIM DA DOCUMENTAÇÃO**
