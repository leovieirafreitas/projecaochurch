# Holyrics Bible API Proxy - Guia de Instalação

## Passo 1: Instalar o Script no Holyrics

1. Abra o **Holyrics**
2. Vá em **Ferramentas** → **JavaScript**
3. Clique em **"Novo Script"** ou **"+"**
4. Cole o conteúdo do arquivo `holyrics-bible-proxy.js`
5. Salve com o nome: **"Bible API Proxy"**
6. **Execute o script** (botão Play)

## Passo 2: Testar o Script

Abra o PowerShell e teste:

```powershell
# Teste 1: Listar versões
$response = Invoke-RestMethod -Uri "http://localhost:8091/api/ApiAction?token=4h7sSD4oabhZJ0TR" -Method POST -ContentType "application/json" -Body '{"action":"get_bible_versions"}'
$response | ConvertTo-Json

# Teste 2: Listar livros
$response = Invoke-RestMethod -Uri "http://localhost:8091/api/ApiAction?token=4h7sSD4oabhZJ0TR" -Method POST -ContentType "application/json" -Body '{"action":"get_bible_books"}'
$response | ConvertTo-Json

# Teste 3: Obter versículo (João 3:16)
$body = @{
    action = "get_bible_text"
    params = @{
        version = "pt_nvi"
        reference = "João 3:16"
    }
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8091/api/ApiAction?token=4h7sSD4oabhZJ0TR" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json
```

## Passo 3: Integrar na Aplicação Next.js

Crie um arquivo `lib/holyrics-api.ts`:

```typescript
const HOLYRICS_API = 'http://localhost:8091/api/ApiAction';
const TOKEN = '4h7sSD4oabhZJ0TR';

async function callHolyrics(action: string, params?: any) {
  const response = await fetch(`${HOLYRICS_API}?token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params })
  });
  
  return response.json();
}

export async function getBibleVersions() {
  return callHolyrics('get_bible_versions');
}

export async function getBibleBooks() {
  return callHolyrics('get_bible_books');
}

export async function getBibleText(version: string, reference: string) {
  return callHolyrics('get_bible_text', { version, reference });
}
```

## Endpoints Disponíveis

### 1. Listar Versões
```javascript
POST /api/ApiAction?token=TOKEN
{
  "action": "get_bible_versions"
}
```

### 2. Listar Livros
```javascript
POST /api/ApiAction?token=TOKEN
{
  "action": "get_bible_books"
}
```

### 3. Obter Versículos
```javascript
POST /api/ApiAction?token=TOKEN
{
  "action": "get_bible_text",
  "params": {
    "version": "pt_nvi",
    "reference": "João 3:16"
  }
}
```

## Formatos de Referência Aceitos

- Versículo único: `"João 3:16"`
- Múltiplos versículos: `"João 3:16-18"`
- Capítulo completo: `"Gênesis 1"`
- Múltiplas referências: `"Rm 12:2 Gn 1:1-3 Sl 23"`

## Troubleshooting

### Erro: "Unknown action"
- Verifique se o script está rodando no Holyrics
- Verifique se salvou com o nome correto

### Erro: "Invalid token"
- Verifique se o token está correto
- Verifique se as permissões estão ativadas

### Erro: "Could not get presentation"
- O Holyrics precisa estar aberto
- Aguarde alguns segundos e tente novamente

## Próximos Passos

1. Instale o script no Holyrics
2. Teste os endpoints
3. Integre na aplicação Next.js
4. Aproveite sua Bíblia Online com dados do Holyrics! 🎉
