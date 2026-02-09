# Fluxo Técnico de Projetos e Projeção - Versão Final (V9)

Este documento documenta as soluções técnicas implementadas para garantir a estabilidade do sistema Projection Church.

## 1. Isolamento de Projetos (.chama)
**Problema Anterior:** Ao mudar o fundo de um projeto, a alteração se propagava para outros projetos abertos ou salvos posteriormente, pois o "cache" da imagem era global.
**Solução V9:** 
- Ao **Carregar um Projeto**, o sistema força a limpeza do cache de imagem antigo e aplica EXATAMENTE a imagem salva no arquivo `.chama`.
- Isso garante que cada projeto tenha sua própria identidade visual única e isolada.

## 2. Imagens de Fundo (Upload Otimizado)
**Problema Anterior:** O envio de imagens pesadas (Base64) travava a rede e causava "Tela Verde" ou falha de conexão no celular.
**Solução V9:**
- Quando uma imagem é selecionada, ela é salva fisicamente na pasta `AppData/Roaming/Projection Church/uploads`.
- O sistema gera uma URL leve (host local) para essa imagem.
- A Projeção e o Celular carregam essa URL instantaneamente, sem travar o app.
- **Correção Adicional:** A pasta `uploads` é criada automaticamente na inicialização para evitar erros "404 Not Found".

## 3. Modo Offline (Supabase Tolerante)
**Problema Anterior:** Falhas no servidor Supabase travavam a inicialização do app.
**Solução V9:**
- O sistema detecta falhas de conexão com o Supabase.
- Se falhar, ele **ignora** o erro e inicia em **Modo Local (Offline)**.
- A sincronização continua funcionando perfeitamente via rede local (Porta 4523).

## 4. Bíblias no Celular (Descoberta de Arquivos)
**Problema Anterior:** O celular só via as Bíblias baixadas na pasta Documentos, ignorando as Bíblias que já vinham com o instalador.
**Solução V9:**
- O servidor (`main.rs`) agora varre múltiplos diretórios:
  1. Pasta `Documentos/CHAMA_ONLINE_BIBLES`.
  2. Pasta de Instalação do Programa (`resources/bibles`).
- Isso garante que todas as versões (ACF, NVI, KJA) apareçam no celular.

---
**Como Testar:**
1. Instale a versão gerada V9.
2. Abra um projeto, defina um fundo Azul. Salve.
3. Crie novo projeto, defina fundo Vermelho. Salve.
4. Abra o primeiro projeto. O fundo deve voltar a ser Azul.
5. Conecte o celular e verifique se as bíblias nativas aparecem na lista.
