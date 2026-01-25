# 📖 Bíblia Online

Uma aplicação moderna e elegante para leitura da Bíblia Sagrada online, desenvolvida com Next.js 15 e integrada com a API YouVersion.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8)

## ✨ Características

- 🌍 **Múltiplas Versões em Português**: Acesse todas as versões da Bíblia disponíveis em português através da API YouVersion
- 📚 **Navegação Intuitiva**: Interface moderna e responsiva para navegar entre livros, capítulos e versículos
- 🎨 **Design Premium**: Interface com glassmorphism, gradientes vibrantes e animações suaves
- 🌓 **Tema Claro/Escuro**: Alterne entre temas claro e escuro com um clique
- 📱 **Totalmente Responsivo**: Funciona perfeitamente em desktop, tablet e mobile
- 📋 **Copiar e Compartilhar**: Copie versículos ou compartilhe facilmente
- ⚡ **Performance Otimizada**: Cache de dados e carregamento rápido
- 🎯 **SEO Otimizado**: Metadados apropriados para melhor indexação

## 🚀 Tecnologias

- **Next.js 15** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização utilitária
- **YouVersion API** - Dados bíblicos
- **React Hooks** - Gerenciamento de estado

## 📦 Instalação

1. Clone o repositório:
```bash
git clone <seu-repositorio>
cd biblia-online
```

2. Instale as dependências:
```bash
npm install
```

3. Configure a variável de ambiente:
Crie um arquivo `.env.local` na raiz do projeto:
```env
NEXT_PUBLIC_YOUVERSION_API_KEY=SLYCefOBEYni8Ej4fV8A4BzqrdAl6HY1B2aK8erAt5GJQs76
```

4. Execute o projeto:
```bash
npm run dev
```

5. Abra [http://localhost:3000](http://localhost:3000) no navegador

## 🏗️ Estrutura do Projeto

```
biblia-online/
├── app/
│   ├── layout.tsx          # Layout principal
│   ├── page.tsx            # Página inicial
│   └── globals.css         # Estilos globais
├── components/
│   ├── BibleSelector.tsx   # Seletor de versão
│   ├── BookNavigator.tsx   # Navegação de livros
│   ├── ChapterSelector.tsx # Seletor de capítulos
│   └── PassageViewer.tsx   # Visualizador de passagens
├── lib/
│   └── api.ts              # Funções da API
├── types/
│   └── bible.ts            # Tipos TypeScript
└── .env.local              # Variáveis de ambiente
```

## 🎨 Design System

### Cores
- **Primary**: Purple/Pink gradient (`from-purple-600 to-pink-600`)
- **Background**: Gradient multi-camadas com glassmorphism
- **Text**: Sistema adaptativo claro/escuro

### Componentes
- **Glass Cards**: Efeito glassmorphism com backdrop blur
- **Gradient Text**: Texto com gradiente vibrante
- **Animações**: Fade in, slide up, scale in

### Tipografia
- **Fonte**: Inter (Google Fonts)
- **Tamanhos**: Sistema responsivo

## 📖 Como Usar

1. **Selecione uma Versão**: Clique no seletor de versão no topo para escolher entre as versões disponíveis em português
2. **Escolha um Livro**: Navegue pelos livros do Antigo ou Novo Testamento
3. **Selecione um Capítulo**: Clique no número do capítulo desejado
4. **Leia**: O texto será carregado automaticamente
5. **Copie ou Compartilhe**: Use os botões no final da passagem

## 🔧 Scripts Disponíveis

```bash
npm run dev      # Inicia servidor de desenvolvimento
npm run build    # Cria build de produção
npm run start    # Inicia servidor de produção
npm run lint     # Executa linter
```

## 🌐 API YouVersion

Esta aplicação utiliza a [YouVersion API](https://developers.youversion.com/) para obter os dados bíblicos.

### Endpoints Utilizados:
- `GET /bibles` - Lista de versões da Bíblia
- `GET /bibles/{bibleId}/books` - Livros de uma versão
- `GET /bibles/{bibleId}/books/{bookId}/chapters` - Capítulos de um livro
- `GET /bibles/{bibleId}/passages/{passageId}` - Texto de uma passagem

## 🎯 Funcionalidades Futuras

- [ ] Busca de versículos
- [ ] Favoritos e marcações
- [ ] Notas pessoais
- [ ] Planos de leitura
- [ ] Compartilhamento em redes sociais
- [ ] Modo de leitura noturno personalizado
- [ ] Histórico de leitura
- [ ] Comparação de versões

## 📝 Licença

Este projeto foi desenvolvido para fins educacionais e de estudo.

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## 📧 Contato

Desenvolvido com ❤️ usando Next.js e YouVersion API

---

**Nota**: Esta aplicação requer uma chave de API válida da YouVersion para funcionar. Certifique-se de configurar corretamente o arquivo `.env.local`.
