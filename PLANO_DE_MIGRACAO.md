# 🚀 PLANO DE MIGRAÇÃO: ARQUITETURA HÍBRIDA (Local First)
**Objetivo:** Escalar para 50.000 igrejas com Custo Zero de Realtime e Dependência Mínima do Supabase.

## 1. O Novo Conceito
Atualmente, quando você clica num versículo:
`Celular` -> `Internet` -> `Supabase` -> `Internet` -> `PC`
**(Gasta Dados, Tem Delay, Custa Caro)**

Como vai ficar:
`Celular` -> `Wi-Fi Local` -> `PC`
**(Custo Zero, Instantâneo, Escala Infinita)**

O Supabase servirá APENAS para baixar **Músicas** e **Temas** (coisas que não mudam a cada segundo).

---

## 2. Etapas da Implementação

### FASE 1: O Servidor Local (Rust)
Vamos transformar o seu executável Desktop num **Servidor WebSocket Real**.
- O PC vai abrir uma porta (ex: `4523` ou `8080`).
- Ele vai aceitar conexões do Celular.
- **Tecnologia:** Vamos usar uma biblioteca Rust leve (`warp` ou `actix`) embutida no Tauri.

### FASE 2: O Cliente Mobile
O App Mobile precisa saber **onde** o PC está.
- Adicionaremos uma tela de **"Conectar ao PC"**.
- O usuário digita o IP do PC (ex: `192.168.0.5`) ou, no futuro, escaneia um QR Code.
- O App vai priorizar enviar comandos para esse IP.

### FASE 3: Sincronização Híbrida
- **Bíblia/Projeção:** Trafega 100% via Rede Local. O PC recebe o comando e atualiza a tela na hora.
- **Conteúdo:** Quando o usuário buscar uma música nova ou tema novo, o App vai no Supabase, baixa, e depois envia pro PC via Rede Local.

---

## 3. O Que Muda nas Funcionalidades?

| Funcionalidade | Hoje (Cloud) | Futuro (Local) |
| :--- | :--- | :--- |
| **Passar Versículos** | Via Supabase $$ | **Via Wi-Fi (Grátis)** 🚀 |
| **Trocar Fundo** | Via Supabase $$ | **Via Wi-Fi (Grátis)** 🚀 |
| **Baixar Músicas** | Supabase | Supabase (Continua Igual) |
| **Baixar Temas** | Supabase | Supabase (Continua Igual) |
| **Login** | "Anonimo" (ID 1) | **Descentralizado (IP Local)** |

---

## 4. Próximos Passos (Mão na Massa)

1. **Backend (Rust):** Instalar dependências de WebSocket no `src-tauri`.
2. **Frontend:** Criar a lógica de conectar no Socket e enviar JSON por ele.
3. **Teste:** Validar a velocidade e a desconexão do Supabase para projeção.

---
**Status:** Planejamento Aprovado. Pronto para iniciar Backend Rust.
