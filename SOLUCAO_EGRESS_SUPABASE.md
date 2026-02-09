# 🛡️ SOLUÇÃO: REDUÇÃO DE EGRESS NO SUPABASE (CORRIGIDA)

## Problema Identificado

Você excedeu o limite de **Egress** (5.64 GB de 5 GB) no Supabase Free Plan.

**Causa:** A tabela `projection_state` está sendo atualizada constantemente (a cada mudança de versículo, fundo, etc.), gerando muito tráfego de dados via Supabase Realtime.

---

## ✅ Soluções Implementadas (FUNCIONANDO)

### 1. ⚙️ **Otimização no Frontend (v0.2.25)**

**Status:** ✅ IMPLEMENTADO

**O que foi feito:**
Modificado o `BibleSearch.tsx` para não enviar o estilo (imagem, cores, fontes) repetidamente.
- Agora, o sistema compara se o estilo mudou desde o último envio.
- Se o estilo é idêntico, envia apenas o texto do versículo.
- **Resultado:** Redução de payloads de 5MB (imagem base64) para ~1KB (só texto) a cada troca de versículo.

---

### 2. ✅ **Cron Job de Limpeza Automática (A cada 1 hora)**

**Status:** ✅ ATIVO

**Job ID:** 3  
**Nome:** `cleanup-old-projection-updates`  
**Frequência:** A cada hora (`0 * * * *`)  
**Ação:** Limpa o campo `data` se não foi atualizado nos últimos 30 minutos

**Verificar status:**
```sql
SELECT jobid, jobname, schedule, command, active FROM cron.job;
```

**Executar manualmente:**
```sql
SELECT cleanup_old_projection_updates();
```

---

### 3. **Trigger Automático de Limitação de Tamanho**

**Status:** ✅ ATIVO

**O que faz:**
- Monitora cada INSERT/UPDATE na tabela `projection_state`
- Se o campo `data` ultrapassar **5 KB**, reduz automaticamente para apenas os campos essenciais:
  - `verseText`
  - `reference`
  - `timestamp`

**Vantagem:** Redução automática e instantânea, sem esperar o cron job.

---

### 3. **Edge Function de Limpeza**

**Status:** ✅ DEPLOYADA (mas não usada pelo cron - opcional)

**Nome:** `cleanup-projection-state`  
**URL:** `https://evrqtiibdxsgdjqllaqh.supabase.co/functions/v1/cleanup-projection-state`

**Testar manualmente:**
```bash
curl -X POST https://evrqtiibdxsgdjqllaqh.supabase.co/functions/v1/cleanup-projection-state
```

---

## 📊 Impacto Esperado

### Antes:
- ❌ Egress: **5.64 GB** (113% do limite)
- ❌ Campo `data` pode crescer indefinidamente
- ❌ Realtime transmite dados grandes constantemente

### Depois:
- ✅ Egress: **< 2 GB** (estimado)
- ✅ Campo `data` limitado a 5 KB máximo
- ✅ Limpeza automática a cada hora
- ✅ Dados antigos (>30 min) são removidos

**Redução esperada:** 60-70% no uso de Egress

---

## 🔍 Monitoramento

### **1. Verificar uso de Egress:**
Dashboard: https://supabase.com/dashboard/project/evrqtiibdxsgdjqllaqh/settings/billing

### **2. Verificar execução dos cron jobs:**
```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### **3. Verificar tamanho atual dos dados:**
```sql
SELECT 
  id, 
  updated_at,
  pg_column_size(data) as data_size_bytes,
  pg_size_pretty(pg_column_size(data)) as data_size_readable
FROM projection_state;
```

### **4. Verificar se o trigger está ativo:**
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'projection_state';
```

---

## 🛠️ Comandos Úteis

### **Executar limpeza manual imediata:**
```sql
SELECT cleanup_old_projection_updates();
```

### **Desabilitar cron job (se necessário):**
```sql
SELECT cron.unschedule('cleanup-old-projection-updates');
```

### **Reabilitar cron job:**
```sql
SELECT cron.schedule(
    'cleanup-old-projection-updates',
    '0 * * * *',
    'SELECT cleanup_old_projection_updates();'
);
```

### **Ver logs do trigger:**
```sql
-- Os logs aparecem no Supabase Dashboard > Logs > Postgres Logs
```

---

## 📝 Resumo da Correção

### O que estava errado:
❌ Job 1 tentava acessar `current_setting('app.settings.service_role_key')` que não existe  
❌ Sintaxe JSON inválida no comando do cron

### O que foi corrigido:
✅ Removido Job 1 problemático  
✅ Melhorado Job 2 para rodar **a cada 1 hora** (em vez de 3)  
✅ Reduzido tempo de retenção para **30 minutos** (em vez de 1 hora)  
✅ Adicionado **trigger automático** que limita tamanho em tempo real  

---

## 🎯 Próximos Passos

1. **Aguarde 24 horas** e monitore o uso de Egress
2. Se o uso ainda estiver alto, podemos:
   - Reduzir ainda mais o tempo de retenção (ex: 15 minutos)
   - Aumentar frequência do cron (ex: a cada 30 minutos)
   - Implementar cache local no código para reduzir chamadas ao Supabase

---

## ✅ Status Final

| Item | Status |
|------|--------|
| Cron Job | ✅ ATIVO (roda a cada hora) |
| Trigger de Limitação | ✅ ATIVO (automático) |
| Edge Function | ✅ DEPLOYADA (opcional) |
| pg_cron Extension | ✅ HABILITADA |

**Tudo funcionando! 🎉**

