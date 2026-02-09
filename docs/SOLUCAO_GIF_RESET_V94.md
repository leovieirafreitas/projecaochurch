# 🚨 Solução Definitiva: Reset de GIF/Animação (Padrão V114 - Blob Strategy)

**Status:** FUNCIONANDO ✅
**Versão:** 0.3.1 (V114)
**Data:** Fevereiro 2026
**Responsável:** Antigravity & Felipe Barroso

## 🛑 O Problema (Evolução)

### O Problema Original (V50)
Ao trocar de slide, se a URL da imagem de fundo for a mesma, o navegador reutiliza o estado da animação GIF, impedindo o reset.

### O Problema da Solução V94 (Query Param)
A solução V94 adicionava `?v=timestamp` para forçar o navegador a resetar.
**Efeito Colateral:** Isso forçava o re-download completo da imagem a cada troca de slide/versículo.
- Em imagens leves: OK.
- Em imagens pesadas (ex: PNG/GIF 8MB) no vMix: **LAG SEVERO** ("quicando", "empurrando"), pois o renderizador travava decodificando 8MB a cada 50ms.

---

## ✅ A Solução Definitiva: "Blob URL Cache via Memory" (Zero Lag)

Para garantir o reset 100% das vezes **SEM** tráfego de rede repetido, usamos `Blob URLs`.

### Lógica Core (`pages/projection.tsx` - ManagedBackground)

#### 1. Fetch Único + Cache em Memória
Fazemos o download da imagem (`fetch`) apenas uma vez e armazenamos o binário (`Blob`) na memória RAM.

```tsx
// Exemplo simplificado
const res = await fetch(src);
blobRef.current = await res.blob();
```

#### 2. Seed-Based Object URL Factory
A cada reset (`seed` change), geramos uma **Nova URL** apontando para o **Mesmo Blob**.

```tsx
// Cria link único (blob:http://localhost/uuid-novo)
// O navegador acha que é nova, mas o dado já está na RAM (Load Instantâneo)
const activeUrl = URL.createObjectURL(blobRef.current);
setBgUrl(activeUrl);
```

#### 3. Limpeza (Revoke)
Para evitar vazamento de memória, revogamos a URL anterior imediatamente.

```tsx
URL.revokeObjectURL(oldUrl);
```

---

## Vantagens
1.  **Reset Garantido:** A URL muda fisicamente (`blob:.../1` -> `blob:.../2`), forçando o motor de renderização a reiniciar a animação.
2.  **Zero Network Lag:** Não há requisição HTTP após o primeiro load. Tudo roda na RAM/CPU.
3.  **Compatibilidade:** Funciona para GIF, PNG, WebP e APNG.

## Fallback (CORS)
Se a imagem vier de um domínio externo que não permite CORS (Access-Control-Allow-Origin), o `fetch` falhará.
Neste caso, o sistema cai automaticamente para o **Modo Legado (V94)** com Query Param (`?t=...`), garantindo que funcione (mesmo com possível lag).
*Nota: No app Tauri (local assets), CORS não é problema.*

---

## 🚀 Como Testar
1.  Carregue um GIF ou PNG animado de 8MB+.
2.  Troque de versículo rapidamente.
3.  **Resultado:** Animação reinicia instantaneamente, sem travamentos na transição.
